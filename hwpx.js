/* ═══════════════════════════════════════════════════════════
   HWPX 내려받기 모듈 (v3 패치 부속)
   ───────────────────────────────────────────────────────────
   전제 1. 생성기_v3_패치.js 를 먼저 붙여넣어 두었을 것
   전제 2. 교수학습과정안_템플릿.hwpx 를 HTML 과 같은 폴더에 둘 것
   사용법  </body> 앞에 <script> … 이 파일 … </script>
   ═══════════════════════════════════════════════════════════ */
(function(){

const TEMPLATE_URL = './template.hwpx';
const JSZIP_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const HP           = 'http://www.hancom.co.kr/hwpml/2011/paragraph';

/* 원본 hwpx 의 압축 방식 — mimetype 은 반드시 무압축·첫 번째 */
const ORDER = ['mimetype','version.xml','Contents/header.xml','BinData/image1.png',
  'Contents/section0.xml','Preview/PrvText.txt','settings.xml','Preview/PrvImage.png',
  'META-INF/container.rdf','Contents/content.hpf','META-INF/container.xml','META-INF/manifest.xml'];
const STORED = new Set(['mimetype','version.xml','BinData/image1.png','Preview/PrvImage.png']);

/* ── 버튼 주입 ─────────────────────────────────────────── */
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

/* ── JSZip 지연 로드 ───────────────────────────────────── */
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

/* ── XML 셀 조작 ───────────────────────────────────────── */
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

/* 셀에 글을 쓴다. \n 은 문단 분리. 서식(글꼴·정렬·테두리)은 원본 그대로 유지된다. */
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

/* 학생 표(4번째 표)의 행 수를 인원수에 맞춘다 */
function fitStudentRows(tbl, n){
  const trs = Array.from(tbl.getElementsByTagNameNS(HP,'tr')).filter(x=>x.parentNode===tbl);
  const body = trs.slice(2);                 // 제목행·머리글행 제외
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

/* 과정안 표의 전개 활동 수를 n 개로 맞춘다.
   한 활동 = 2행(공통 교수활동 + 수준별). 전개 셀의 세로 병합과 rowCnt 도 함께 고친다. */
function fitDevelopRows(tbl, n){
  const rows = () => Array.from(tbl.getElementsByTagNameNS(HP,'tr')).filter(x=>x.parentNode===tbl);
  const addr = tc => tc.getElementsByTagNameNS(HP,'cellAddr')[0];
  const span = tc => tc.getElementsByTagNameNS(HP,'cellSpan')[0];
  const cells = tr => Array.from(tr.getElementsByTagNameNS(HP,'tc')).filter(x=>x.parentNode===tr);

  let r = rows();
  const head = r.slice(0,2), intro = r[2], close = r[r.length-1];
  let blocks = [];
  for(let i=3; i<r.length-1; i+=2) blocks.push([r[i], r[i+1]]);

  n = Math.max(1, Math.min(6, n));
  if(n > blocks.length){
    const [pa, pb] = blocks[blocks.length-1];
    for(let k=blocks.length; k<n; k++){
      const a = pa.cloneNode(true), b = pb.cloneNode(true);
      cells(a).forEach(tc => { if(addr(tc).getAttribute('colAddr') === '0') a.removeChild(tc); });
      blocks.push([a, b]);
    }
  } else if(n < blocks.length){
    blocks = blocks.slice(0, n);
  }

  rows().forEach(tr => tbl.removeChild(tr));
  [...head, intro, ...blocks.flat(), close].forEach(tr => tbl.appendChild(tr));

  rows().forEach((tr, i) => cells(tr).forEach(tc => addr(tc).setAttribute('rowAddr', String(i))));
  cells(rows()[3]).forEach(tc => {
    if(addr(tc).getAttribute('colAddr') === '0') span(tc).setAttribute('rowSpan', String(2*n));
  });
  tbl.setAttribute('rowCnt', String(4 + 2*n));
}

/* ── 본 작업 ───────────────────────────────────────────── */
async function exportHwpx(){
  const DOC = window.__DOC__;
  if(!DOC){ showToast('먼저 “⚡ 과정안 바로 생성”을 눌러 주세요.'); return; }
  const btn = document.getElementById('btnHwpx');
  btn.disabled = true; btn.textContent = '⏳ 만드는 중…';

  try{
    const JSZipLib = await loadJSZip();
    const res = await fetch(TEMPLATE_URL);
    if(!res.ok) throw new Error('템플릿 파일을 찾을 수 없습니다 — 교수학습과정안_템플릿.hwpx 를 HTML 과 같은 폴더에 두세요');
    const zip = await JSZipLib.loadAsync(await res.arrayBuffer());

    const doc = makeDoc(await zip.file('Contents/section0.xml').async('string'));
    writeAll(doc, DOC);

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
    showToast('한글파일을 내려받았습니다.');
  }catch(err){
    showToast('실패: ' + err.message);
  }
  btn.disabled = false; btn.textContent = '⬇ 한글파일 내려받기';
}

/* ── JSON → 셀 주소 매핑 ───────────────────────────────── */
function writeAll(doc, {a, b, e, d, tools}){
  let T = tblsOf(doc);
  const plans = d.studentPlans || [];
  fitStudentRows(T[3], plans.length || 1);
  T = tblsOf(doc);
  const S = (ti,r,c,v) => setCell(T[ti], r, c, v);

  /* 0. 제목 */
  S(0,0,0, `생성형 AI 기반 「프로그램」운영을 통한 맞춤형 특수교육 실천 역량 강화 방안 연구\n( ${fieldText(d.subject)} )과 교수·학습 과정안`);

  /* 1. 기본 정보 */
  S(1,0,1, fieldText(d.lessonDate));
  S(1,0,3, fieldText(d.targetClass));
  S(1,0,5, d.teacherName);
  S(1,1,1, fieldText(d.unit));
  S(1,1,3, fieldText(d.place));
  S(1,1,5, d.supportStaff);
  S(1,2,3, fieldText(d.lessonNo));
  S(1,3,1, fieldText(d.lessonGoal));

  /* 2. 성취기준 · 역량 · 설계 의도 */
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

  /* 3. 학생별 개별 지원 */
  const sup = {}; (e.students||[]).forEach(s => sup[s.label] = s);
  plans.forEach((p, i) => {
    const x = sup[p.label] || {};
    S(3, 2+i, 0, p.label);
    S(3, 2+i, 1, fieldText(p.char));
    S(3, 2+i, 2, fieldText(p.goal));
    S(3, 2+i, 3, x.support || '');
    S(3, 2+i, 4, x.aiMaterial || '');
  });

  /* 4. 생성형 AI 활용 계획 */
  const TOOLS = ['ChatGPT','Claude','Gemini','Grok','Kling','기타'];
  S(4,1,1, TOOLS.map(t => (d.aiTools.includes(t)?'■ ':'□ ')+t).join('  ')
           + (d.customAiTool ? '  ('+d.customAiTool+')' : ''));
  S(4,2,1, a.aiPlan || '');

  /* 5. 교수·학습 과정안 — 활동 수에 맞춰 표를 늘린 뒤 채운다 */
  const dev = (b.develop || []).filter(x => x && (x.teacher || x.process || x.levelA));
  if(!dev.length) dev.push({});
  fitDevelopRows(T[5], dev.length);
  T = tblsOf(doc);
  const io_ = b.intro || {}, cl = b.close || {};

  S(5,2,1, io_.process || '');  S(5,2,2, io_.teacher || '');  S(5,2,5, io_.material || '');
  dev.forEach((x, i) => {
    const r = 3 + 2*i;
    S(5, r,   1, x.process  || '');
    S(5, r,   2, x.teacher  || '');
    S(5, r,   5, x.material || '');
    S(5, r+1, 2, x.levelA   || '');
    S(5, r+1, 3, x.levelB   || '');
    S(5, r+1, 4, x.levelC   || '');
  });
  const rc = 3 + 2*dev.length;
  S(5,rc,1, cl.process || '');  S(5,rc,2, cl.teacher || '');  S(5,rc,5, cl.material || '');

  /* 6. 평가 계획 */
  (e.evaluation || []).slice(0,3).forEach((x, i) => {
    S(6, 2+i, 1, x.method || '');
    S(6, 2+i, 2, x.high || '');
    S(6, 2+i, 3, x.mid || '');
    S(6, 2+i, 4, x.low || '');
  });
}

window.exportHwpx = exportHwpx;
})();
