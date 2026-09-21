/* ═══════════════════════════════════════════════════════════
   HWPX 내려받기 모듈 (v3.2 패치 부속)
   ───────────────────────────────────────────────────────────
   v3.2 변경  전개를 활동별 단계(교사 1행 + 가·나·다 1행) 반복 구조로 확장
   v3.1 변경  본문 [AI] 표기 → 초록 둥근 직사각형(생성형AI) 도형으로 변환
              도형은 서식 머리행의 범례 도형을 복제하므로 모양·색이 서식과 동일
   전제 1. 생성기 v3.1 패치(patch.js)를 먼저 붙여넣어 두었을 것
   전제 2. template.hwpx 를 HTML 과 같은 폴더에 둘 것
   ═══════════════════════════════════════════════════════════ */
(function(){

const TEMPLATE_URL = './template.hwpx';
const JSZIP_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const HP           = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
const AI_MARK      = '[AI]';
const AI_COLOR     = '#9BE5C8';

const ORDER = ['mimetype','version.xml','Contents/header.xml','BinData/image1.png',
  'Contents/section0.xml','Preview/PrvText.txt','settings.xml','Preview/PrvImage.png',
  'META-INF/container.rdf','Contents/content.hpf','META-INF/container.xml','META-INF/manifest.xml'];
const STORED = new Set(['mimetype','version.xml','BinData/image1.png','Preview/PrvImage.png']);

function inject(){
  const bar = document.querySelector('.mini-actions');
  if(!bar || document.getElementById('btnHwpx')) return;
  const b = document.createElement('button');
  b.className = 'btn btn-secondary';
  b.id = 'btnHwpx';
  b.style.cssText = 'background:#2d7a4f;color:#fff;border-color:#2d7a4f';
  b.textContent = '⬇ 한글파일 내려받기';
  b.onclick = exportHwpx;
  const anchor = document.getElementById('btnCopyHwp');
  anchor ? bar.insertBefore(b, anchor.nextSibling) : bar.insertBefore(b, bar.firstChild);
}
document.addEventListener('DOMContentLoaded', inject);
if(document.readyState !== 'loading') inject();

function loadJSZip(){
  if(window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((ok, no)=>{
    const s = document.createElement('script');
    s.src = JSZIP_CDN;
    s.onload  = ()=> ok(window.JSZip);
    s.onerror = ()=> no(new Error('JSZip 을 불러오지 못했습니다(외부망 차단 가능)'));
    document.head.appendChild(s);
  });
}

function makeDoc(xmlText){
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('템플릿 XML 해석 실패');
  return doc;
}
const tblsOf = doc => Array.from(doc.getElementsByTagNameNS(HP,'tbl'));

function cellAt(tbl, r, c){
  for(const tc of Array.from(tbl.getElementsByTagNameNS(HP,'tc'))){
    const a = tc.getElementsByTagNameNS(HP,'cellAddr')[0];
    if(!a) continue;
    if(+a.getAttribute('rowAddr') === r && +a.getAttribute('colAddr') === c) return tc;
  }
  return null;
}

function setCell(tbl, r, c, text){
  const tc = cellAt(tbl, r, c);
  if(!tc) return false;
  const sub = tc.getElementsByTagNameNS(HP,'subList')[0];
  if(!sub) return false;
  const ps = Array.from(sub.getElementsByTagNameNS(HP,'p')).filter(p=>p.parentNode===sub);
  if(!ps.length) return false;
  const proto = ps[0];
  ps.slice(1).forEach(p=>sub.removeChild(p));

  const lines = String(text==null ? '' : text).split('\n');
  lines.forEach((line, i)=>{
    const p = (i===0) ? proto : proto.cloneNode(true);
    const runs = Array.from(p.getElementsByTagNameNS(HP,'run')).filter(x=>x.parentNode===p);
    runs.slice(1).forEach(x=>p.removeChild(x));
    const run = runs[0];
    if(!run) return;
    const ts = Array.from(run.getElementsByTagNameNS(HP,'t')).filter(x=>x.parentNode===run);
    ts.slice(1).forEach(x=>run.removeChild(x));
    if(ts.length){ ts[0].textContent = line; }
    else {
      const t = p.ownerDocument.createElementNS(HP,'hp:t');
      t.textContent = line; run.appendChild(t);
    }
    if(i>0) sub.appendChild(p);
  });
  return true;
}

function fitStudentRows(tbl, n){
  const trs = Array.from(tbl.getElementsByTagNameNS(HP,'tr')).filter(x=>x.parentNode===tbl);
  const body = trs.slice(2);
  const cur = body.length;
  n = Math.max(1, n);
  if(n > cur){
    for(let k=0; k<n-cur; k++){
      const nr = body[body.length-1].cloneNode(true);
      Array.from(nr.getElementsByTagNameNS(HP,'cellAddr')).forEach(a=>a.setAttribute('rowAddr', String(cur+k+2)));
      tbl.appendChild(nr);
    }
  } else if(n < cur){
    body.slice(n).forEach(tr=>tbl.removeChild(tr));
  }
  tbl.setAttribute('rowCnt', String(n+2));
}

/* 과정안 표의 전개를 활동별 단계 수에 맞춘다 (v3.2)
   ks = [활동1 단계 수, 활동2 단계 수, …]
   한 단계 = 교사 활동 1행 + 가·나·다 1행
   학습과정·자료 칸은 활동 단위로 세로 병합, 전개 칸은 전개 전체를 세로 병합 */
function fitDevelopRows(tbl, ks){
  const rows  = () => Array.from(tbl.getElementsByTagNameNS(HP,'tr')).filter(x=>x.parentNode===tbl);
  const addr  = tc => tc.getElementsByTagNameNS(HP,'cellAddr')[0];
  const span  = tc => tc.getElementsByTagNameNS(HP,'cellSpan')[0];
  const cells = tr => Array.from(tr.getElementsByTagNameNS(HP,'tc')).filter(x=>x.parentNode===tr);
  const col   = tc => addr(tc).getAttribute('colAddr');
  const drop  = (tr, cs) => { cells(tr).forEach(tc => { if(cs.includes(col(tc))) tr.removeChild(tc); }); return tr; };

  const r = rows();
  const head = r.slice(0,2), intro = r[2], close = r[r.length-1];
  const firstTch = r[3];                    // 전개·학습과정·교사활동·자료
  const lvlRow   = r[4];                    // 가·나·다
  const nextTch  = r.length > 6 ? r[5] : drop(r[3].cloneNode(true), ['0']);   // 학습과정·교사활동·자료

  ks = (ks && ks.length ? ks : [1]).slice(0, 6).map(k => Math.max(1, Math.min(4, k|0 || 1)));
  const body = [], heads = [];
  ks.forEach((k, i) => {
    const t0 = (i===0 ? firstTch : nextTch).cloneNode(true);
    heads.push([t0, 2*k]);
    body.push(t0, lvlRow.cloneNode(true));
    for(let j=1; j<k; j++){
      body.push(drop(nextTch.cloneNode(true), ['0','1','5']), lvlRow.cloneNode(true));
    }
  });

  rows().forEach(tr => tbl.removeChild(tr));
  [...head, intro, ...body, close].forEach(tr => tbl.appendChild(tr));
  rows().forEach((tr, i) => cells(tr).forEach(tc => addr(tc).setAttribute('rowAddr', String(i))));

  heads.forEach(([tr, n]) => cells(tr).forEach(tc => {
    const c = col(tc);
    if(c === '1' || c === '5') span(tc).setAttribute('rowSpan', String(n));
    if(c === '0') span(tc).setAttribute('rowSpan', String(body.length));
  }));
  tbl.setAttribute('rowCnt', String(4 + body.length));
}

/* ── v3.1  [AI] → 초록 둥근 직사각형 ─────────────────── */
function findAiRect(doc){
  const rects = doc.getElementsByTagNameNS(HP,'rect');
  for(let i=0; i<rects.length; i++){
    const b = rects[i].getElementsByTagNameNS('*','winBrush')[0];
    if(b && (b.getAttribute('faceColor')||'').toUpperCase() === AI_COLOR) return rects[i];
  }
  return null;
}
const rid = () => String(1000000000 + Math.floor(Math.random()*1000000000));

function applyAiMarks(doc){
  const proto = findAiRect(doc);
  const ts = Array.from(doc.getElementsByTagNameNS(HP,'t'))
    .filter(t => (t.textContent||'').indexOf(AI_MARK) >= 0);
  if(!proto){                       // 서식에 범례 도형이 없으면 표기만 지운다
    ts.forEach(t => t.textContent = t.textContent.split(AI_MARK).join('').replace(/\s+$/,''));
    return -1;
  }
  let n = 0;
  ts.forEach(t => {
    const run = t.parentNode;
    const parts = t.textContent.split(AI_MARK);
    t.textContent = parts[0].replace(/\s+$/,'') + ' ';
    let after = t;
    for(let i=1; i<parts.length; i++){
      const r = proto.cloneNode(true);
      r.setAttribute('id', rid());
      r.setAttribute('instid', rid());
      run.insertBefore(r, after.nextSibling); after = r;
      const rest = parts[i].replace(/^\s+/,'');
      if(rest){
        const t2 = doc.createElementNS(HP,'hp:t');
        t2.textContent = ' ' + rest;
        run.insertBefore(t2, after.nextSibling); after = t2;
      }
      n++;
    }
    /* 도형 높이가 줄 배치 정보에 없으므로 지워서 한글이 다시 계산하게 한다 */
    const p = run.parentNode;
    const ls = Array.from(p.getElementsByTagNameNS(HP,'linesegarray')).find(x => x.parentNode === p);
    if(ls) p.removeChild(ls);
  });
  return n;
}

async function exportHwpx(){
  const DOC = window.__DOC__;
  if(!DOC){ showToast('먼저 “⚡ 과정안 바로 생성”을 눌러 주세요.'); return; }
  const btn = document.getElementById('btnHwpx');
  btn.disabled = true; btn.textContent = '⏳ 만드는 중…';

  try{
    const JSZipLib = await loadJSZip();
    const res = await fetch(TEMPLATE_URL);
    if(!res.ok) throw new Error('템플릿 파일을 찾을 수 없습니다 — template.hwpx 를 HTML 과 같은 폴더에 두세요');
    const zip = await JSZipLib.loadAsync(await res.arrayBuffer());

    const doc = makeDoc(await zip.file('Contents/section0.xml').async('string'));
    writeAll(doc, DOC);
    const marks = applyAiMarks(doc);

    const xml = new XMLSerializer().serializeToString(doc);
    const out = new JSZipLib();
    for(const name of ORDER){
      const f = zip.file(name);
      if(!f) continue;
      const data = (name==='Contents/section0.xml') ? xml : await f.async('uint8array');
      out.file(name, data, { compression: STORED.has(name) ? 'STORE' : 'DEFLATE' });
    }
    const blob = await out.generateAsync({ type:'blob', mimeType:'application/hwp+zip' });

    const d = DOC.d;
    const safe = s => String(s||'').replace(/[\\/:*?"<>|]/g,'_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safe(d.subject)}_${safe(d.unit)}_교수학습과정안.hwpx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    showToast(marks < 0
      ? '내려받았습니다. 서식에 AI 표시 도형이 없어 표시는 생략했습니다.'
      : `한글파일을 내려받았습니다. AI 활용 표시 ${marks}곳`);
  }catch(err){
    showToast('실패: ' + err.message);
  }
  btn.disabled = false; btn.textContent = '⬇ 한글파일 내려받기';
}

function writeAll(doc, {a, b, e, d, tools}){
  let T = tblsOf(doc);
  const plans = d.studentPlans || [];
  fitStudentRows(T[3], plans.length || 1);
  T = tblsOf(doc);
  const S = (ti,r,c,v) => setCell(T[ti], r, c, v);

  S(0,0,0, `생성형 AI 기반 「프로그램」운영을 통한 맞춤형 특수교육 실천 역량 강화 방안 연구\n( ${fieldText(d.subject)} )과 교수·학습 과정안`);

  S(1,0,1, fieldText(d.lessonDate));
  S(1,0,3, fieldText(d.targetClass));
  S(1,0,5, d.teacherName);
  S(1,1,1, fieldText(d.unit));
  S(1,1,3, fieldText(d.place));
  S(1,1,5, d.supportStaff);
  S(1,2,3, fieldText(d.lessonNo));
  S(1,3,1, fieldText(d.lessonGoal));

  S(2,0,1, (d.achCode ? d.achCode+' ' : '') + fieldText(d.achStd));
  const C15 = ['자기관리','지식정보처리','창의적 사고','심미적 감성','의사소통','공동체'];
  const C22 = ['자기관리','지식정보처리','창의적 사고','심미적 감성','협력적 소통','공동체'];
  const pick = a.competency || [];
  const is22 = d.curriculumVersion !== '2015';
  const box = (arr,on) => {
    const m = arr.map(x => (on.includes(x) ? '■ ' : '□ ') + x + ' 역량');
    return m.slice(0,3).join('   ') + '\n' + m.slice(3).join('   ');
  };
  S(2,1,2, box(C15, is22 ? [] : pick));
  S(2,2,2, box(C22, is22 ? pick : []));
  S(2,3,1, a.intent || '');

  const sup = {}; (e.students||[]).forEach(s => sup[s.label] = s);
  plans.forEach((p, i) => {
    const x = sup[p.label] || {};
    S(3, 2+i, 0, p.label);
    S(3, 2+i, 1, fieldText(p.char));
    S(3, 2+i, 2, fieldText(p.goal));
    S(3, 2+i, 3, x.support || '');
    S(3, 2+i, 4, x.aiMaterial || '');
  });

  const TOOLS = ['ChatGPT','Claude','Gemini','Grok','Kling','기타'];
  S(4,1,1, TOOLS.map(t => (d.aiTools.includes(t)?'■ ':'□ ')+t).join('  ')
           + (d.customAiTool ? '  ('+d.customAiTool+')' : ''));
  S(4,2,1, a.aiPlan || '');

  const dev = (b.develop || []).filter(x => x && (x.process || (x.steps && x.steps.length) || x.teacher));
  if(!dev.length) dev.push({});
  dev.forEach(x => {
    if(!Array.isArray(x.steps) || !x.steps.length)
      x.steps = [{ teacher:x.teacher, levelA:x.levelA, levelB:x.levelB, levelC:x.levelC }];
  });
  fitDevelopRows(T[5], dev.map(x => x.steps.length));
  T = tblsOf(doc);
  const io_ = b.intro || {}, cl = b.close || {};

  S(5,2,1, io_.process || '');  S(5,2,2, io_.teacher || '');  S(5,2,5, io_.material || '');
  let r = 3;
  dev.forEach(x => {
    S(5, r, 1, x.process  || '');
    S(5, r, 5, x.material || '');
    x.steps.forEach(s => {
      S(5, r,   2, s.teacher || '');
      S(5, r+1, 2, s.levelA  || '');
      S(5, r+1, 3, s.levelB  || '');
      S(5, r+1, 4, s.levelC  || '');
      r += 2;
    });
  });
  const rc = r;
  S(5,rc,1, cl.process || '');  S(5,rc,2, cl.teacher || '');  S(5,rc,5, cl.material || '');

  (e.evaluation || []).slice(0,3).forEach((x, i) => {
    S(6, 2+i, 1, x.method || '');
    S(6, 2+i, 2, x.high || '');
    S(6, 2+i, 3, x.mid || '');
    S(6, 2+i, 4, x.low || '');
  });
}

window.exportHwpx = exportHwpx;
window.applyAiMarks = applyAiMarks;   // 붙여넣기 경로(paste.js)에서도 호출 가능
})();
