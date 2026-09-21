/* ═══════════════════════════════════════════════════════════
   HWPX 내려받기 모듈 (v3.5 패치 부속)
   ───────────────────────────────────────────────────────────
   v3.5 변경  제목 표를 PAIR 로고 서식으로 변경 (HY헤드라인M, 1행 9pt + 로고, 2행 20pt 가운데)
   v3.4.1 수정  글이 아래 표를 덮는 오류 수정 (줄 배치 정보 삭제 → 한 줄로 초기화)
   v3.4 변경  칸 줄 간격 오류 수정, 학생 특성 AI 추출값 사용
   v3.3 변경  핵심역량 체크박스 탭 정렬, 학생 지원 표 머리 문구 변경
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
const HH           = 'http://www.hancom.co.kr/hwpml/2011/head';
const TAB_POS      = [11000, 22500];
/* 제목 표 문구 — 로고 그림은 「 와 프로그램 사이에 들어간다 */
const TITLE_HEAD   = '생성형 AI 기반 「';
const TITLE_TAIL   = '프로그램」운영을 통한 맞춤형 특수교육 실천 연구';
const TITLE_FONT   = 'HY헤드라인M';   // 제목 1행·2행 글꼴
const TITLE_SIZE1  = 900;             // 1행 9pt
const TITLE_SIZE2  = 2000;            // 2행 20pt
const TITLE_USE_LOGO = true;          // false 로 두면 로고 대신 글자 'PAIR'   // 핵심역량 체크박스 2열·3열 시작 위치 (HWPUNIT, 셀 폭 약 33,800)

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

/* 줄 배치 정보를 '한 줄짜리'로 초기화한다 (v3.4.1)
   - 통째로 지우면 한글이 셀 높이를 다시 늘리지 않아 글이 아래 표를 덮는다
   - 서식의 여러 줄 정보를 그대로 두면 문단마다 빈 줄이 생긴다
   → 첫 줄 정보만 남기고 위치를 0 으로 맞추면 한글이 열 때 정상적으로 다시 배치한다 */
function resetLineseg(p){
  const arr = Array.from(p.getElementsByTagNameNS(HP,'linesegarray')).find(x => x.parentNode === p);
  if(!arr) return;
  const segs = Array.from(arr.getElementsByTagNameNS(HP,'lineseg'));
  if(!segs.length) return;
  segs.slice(1).forEach(s => arr.removeChild(s));
  segs[0].setAttribute('textpos','0');
  segs[0].setAttribute('vertpos','0');
}

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
    resetLineseg(p);
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

/* ── v3.5  제목 표 (PAIR 로고 서식) ──────────────────
   1행  작은 굵은 글씨 + 「 로고 프로그램」
   2행  큰 굵은 글씨 가운데 정렬 "( 교과 )과 교수·학습 과정안" */
function addFont(hdoc, face){
  const faces = Array.from(hdoc.getElementsByTagNameNS(HH,'fontface'));
  const hf = faces.find(f => f.getAttribute('lang') === 'HANGUL');
  if(!hf) return null;
  const fonts = Array.from(hf.getElementsByTagNameNS(HH,'font'));
  const hit = fonts.find(f => f.getAttribute('face') === face);
  if(hit) return hit.getAttribute('id');
  const f = fonts[0].cloneNode(false);
  f.setAttribute('id', String(fonts.length));
  f.setAttribute('face', face);
  f.setAttribute('type', 'TTF');
  f.setAttribute('isEmbedded', '0');
  hf.appendChild(f);
  hf.setAttribute('fontCnt', String(fonts.length + 1));
  return String(fonts.length);
}
function addCharPr(hdoc, baseId, opt){
  const box = hdoc.getElementsByTagNameNS(HH,'charProperties')[0];
  const list = Array.from(box.getElementsByTagNameNS(HH,'charPr')).filter(x => x.parentNode === box);
  const base = list.find(x => x.getAttribute('id') === String(baseId)) || list[0];
  const c = base.cloneNode(true);
  const id = String(maxId(list) + 1);
  c.setAttribute('id', id);
  c.setAttribute('height', String(opt.height));
  const fr = c.getElementsByTagNameNS(HH,'fontRef')[0];
  if(fr && opt.font != null) fr.setAttribute('hangul', opt.font);
  const sp = c.getElementsByTagNameNS(HH,'spacing')[0];
  if(sp && opt.spacing != null) sp.setAttribute('hangul', String(opt.spacing));
  if(!c.getElementsByTagNameNS(HH,'bold')[0]){
    const b = hdoc.createElementNS(HH,'hh:bold');
    const ul = c.getElementsByTagNameNS(HH,'underline')[0];
    ul ? c.insertBefore(b, ul) : c.appendChild(b);
  }
  box.appendChild(c);
  box.setAttribute('itemCnt', String(list.length + 1));
  return id;
}
function addCenterParaPr(hdoc, baseId){
  const pps = hdoc.getElementsByTagNameNS(HH,'paraProperties')[0];
  const list = Array.from(pps.getElementsByTagNameNS(HH,'paraPr')).filter(x => x.parentNode === pps);
  const base = list.find(x => x.getAttribute('id') === String(baseId)) || list[0];
  const pp = base.cloneNode(true);
  const id = String(maxId(list) + 1);
  pp.setAttribute('id', id);
  const al = pp.getElementsByTagNameNS(HH,'align')[0];
  if(al) al.setAttribute('horizontal','CENTER');
  Array.from(pp.getElementsByTagNameNS('*','intent')).forEach(x => x.setAttribute('value','0'));
  pps.appendChild(pp);
  pps.setAttribute('itemCnt', String(list.length + 1));
  return id;
}

function writeTitle(doc, hdoc, subject){
  const tc = cellAt(tblsOf(doc)[0], 0, 0);
  if(!tc) return;
  const sub = tc.getElementsByTagNameNS(HP,'subList')[0];
  const ps = Array.from(sub.getElementsByTagNameNS(HP,'p')).filter(p => p.parentNode === sub);
  const p1 = ps[0];
  const pic = p1.getElementsByTagNameNS(HP,'pic')[0];
  const run0 = Array.from(p1.getElementsByTagNameNS(HP,'run')).find(r => r.parentNode === p1);
  const baseChar = run0.getAttribute('charPrIDRef');
  const basePara = p1.getAttribute('paraPrIDRef');

  const fid = addFont(hdoc, TITLE_FONT);
  const c1 = addCharPr(hdoc, baseChar, { height: TITLE_SIZE1, font: fid, spacing: 0 });
  const c2 = addCharPr(hdoc, baseChar, { height: TITLE_SIZE2, font: fid, spacing: 0 });
  const pc = addCenterParaPr(hdoc, basePara);

  ps.slice(1).forEach(p => sub.removeChild(p));
  const p2 = p1.cloneNode(true);

  const mkT = s => { const t = doc.createElementNS(HP,'hp:t'); t.textContent = s; return t; };
  const fill = (p, charId, nodes) => {
    Array.from(p.getElementsByTagNameNS(HP,'run')).filter(r => r.parentNode === p).forEach(r => p.removeChild(r));
    const run = doc.createElementNS(HP,'hp:run');
    run.setAttribute('charPrIDRef', charId);
    nodes.forEach(n => run.appendChild(n));
    const ls = Array.from(p.getElementsByTagNameNS(HP,'linesegarray')).find(x => x.parentNode === p);
    ls ? p.insertBefore(run, ls) : p.appendChild(run);
    resetLineseg(p);
  };
  fill(p1, c1, (pic && TITLE_USE_LOGO) ? [mkT(TITLE_HEAD), pic, mkT(TITLE_TAIL)]
                                        : [mkT(TITLE_HEAD + 'PAIR ' + TITLE_TAIL)]);
  p2.setAttribute('paraPrIDRef', pc);
  fill(p2, c2, [mkT(`( ${subject} )과 교수·학습 과정안`)]);
  sub.appendChild(p2);
}

/* ── v3.3  핵심역량 체크박스 탭 정렬 ───────────────────
   header.xml 에 탭 위치가 고정된 문단 모양을 하나 추가하고,
   체크박스 칸의 \t 를 한글 탭으로 바꾼다 */
function maxId(list){ let m = -1; list.forEach(x => m = Math.max(m, +x.getAttribute('id') || 0)); return m; }

function addTabParaPr(hdoc, baseId){
  const tps = hdoc.getElementsByTagNameNS(HH,'tabProperties')[0];
  const pps = hdoc.getElementsByTagNameNS(HH,'paraProperties')[0];
  if(!tps || !pps) return null;
  const tabList  = Array.from(tps.getElementsByTagNameNS(HH,'tabPr'));
  const paraList = Array.from(pps.getElementsByTagNameNS(HH,'paraPr')).filter(x => x.parentNode === pps);
  const base = paraList.find(x => x.getAttribute('id') === String(baseId));
  if(!base) return null;

  const tabId = String(maxId(tabList) + 1);
  const tp = hdoc.createElementNS(HH,'hh:tabPr');
  tp.setAttribute('id', tabId); tp.setAttribute('autoTabLeft','0'); tp.setAttribute('autoTabRight','0');
  TAB_POS.forEach(pos => {
    const it = hdoc.createElementNS(HH,'hh:tabItem');
    it.setAttribute('pos', String(pos)); it.setAttribute('type','LEFT'); it.setAttribute('leader','NONE');
    tp.appendChild(it);
  });
  tps.appendChild(tp);
  tps.setAttribute('itemCnt', String(tabList.length + 1));

  const paraId = String(maxId(paraList) + 1);
  const pp = base.cloneNode(true);
  pp.setAttribute('id', paraId);
  pp.setAttribute('tabPrIDRef', tabId);
  const al = pp.getElementsByTagNameNS(HH,'align')[0];
  if(al) al.setAttribute('horizontal','LEFT');      // 양쪽 정렬이면 탭 간격이 벌어지므로 왼쪽 정렬
  pps.appendChild(pp);
  pps.setAttribute('itemCnt', String(paraList.length + 1));
  return paraId;
}

/* 셀 안 \t → <hp:tab/>, 문단 모양 교체 */
function tabifyCell(tc, paraId){
  if(!tc) return;
  const doc = tc.ownerDocument;
  Array.from(tc.getElementsByTagNameNS(HP,'p')).forEach(p => {
    if(paraId) p.setAttribute('paraPrIDRef', paraId);
    Array.from(p.getElementsByTagNameNS(HP,'t')).forEach(t => {
      const s = t.textContent || '';
      if(s.indexOf('\t') < 0) return;
      while(t.firstChild) t.removeChild(t.firstChild);
      s.split('\t').forEach((part, i) => {
        if(i > 0){
          const tab = doc.createElementNS(HP,'hp:tab');
          tab.setAttribute('width','4000'); tab.setAttribute('leader','0'); tab.setAttribute('type','1');
          t.appendChild(tab);
        }
        if(part) t.appendChild(doc.createTextNode(part));
      });
    });
    resetLineseg(p);
  });
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
    resetLineseg(run.parentNode);
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

    const doc  = makeDoc(await zip.file('Contents/section0.xml').async('string'));
    const hdoc = makeDoc(await zip.file('Contents/header.xml').async('string'));
    writeAll(doc, DOC);
    writeTitle(doc, hdoc, fieldText(DOC.d.subject));

    /* 핵심역량 체크박스 탭 정렬 */
    const T2 = tblsOf(doc)[2];
    const c1 = cellAt(T2,1,2), c2 = cellAt(T2,2,2);
    const p0 = c1 && c1.getElementsByTagNameNS(HP,'p')[0];
    const tabPara = p0 ? addTabParaPr(hdoc, p0.getAttribute('paraPrIDRef')) : null;
    tabifyCell(c1, tabPara); tabifyCell(c2, tabPara);

    const marks = applyAiMarks(doc);

    const xml  = new XMLSerializer().serializeToString(doc);
    const hxml = new XMLSerializer().serializeToString(hdoc);
    const out = new JSZipLib();
    for(const name of ORDER){
      const f = zip.file(name);
      if(!f) continue;
      const data = (name==='Contents/section0.xml') ? xml
                 : (name==='Contents/header.xml')   ? hxml
                 : await f.async('uint8array');
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

  /* 0. 제목은 writeTitle() 에서 서식째 작성 */

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
    return m.slice(0,3).join('\t') + '\n' + m.slice(3).join('\t');
  };
  S(2,1,2, box(C15, is22 ? [] : pick));
  S(2,2,2, box(C22, is22 ? pick : []));
  S(2,3,1, a.intent || '');

  S(3,1,3, '본 차시 AI 활용\n개별적 지원 방안');
  S(3,1,4, '생성형 AI 활용\n자료 개발 유형');
  const sup = {}; (e.students||[]).forEach(s => sup[s.label] = s);
  plans.forEach((p, i) => {
    const x = sup[p.label] || {};
    S(3, 2+i, 0, p.label);
    S(3, 2+i, 1, x.char || fieldText(p.char));   // AI가 추린 수업 관련 특성, 없으면 입력값
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
