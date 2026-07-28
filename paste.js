/* ═══════════════════════════════════════════════════════════
   붙여넣기 → 한글파일 변환 경로
   ───────────────────────────────────────────────────────────
   API 없이도 과정안을 만든다.
   ① [[라벨]] 프롬프트 복사 → ChatGPT·Claude 아무 데나 붙여넣기
   ② 결과를 그대로 복사해서 아래 칸에 붙여넣기
   ③ 변환 → 한글파일 내려받기
   </body> 앞, hwpx.js 뒤에 <script src="paste.js"></script>
   ═══════════════════════════════════════════════════════════ */
(function(){

/* ── 라벨 정의 : [[라벨]] → 들어갈 자리 ───────────────── */
const SLOTS = [
  ['수업설계의도',  'a.intent'],
  ['AI활용구상',    'a.aiPlan'],
  ['도입-과정',     'b.intro.process'],
  ['도입-교사',     'b.intro.teacher'],
  ['도입-자료',     'b.intro.material'],
  ['전개1-과정',    'b.develop.0.process'],
  ['전개1-교사',    'b.develop.0.teacher'],
  ['전개1-가',      'b.develop.0.levelA'],
  ['전개1-나',      'b.develop.0.levelB'],
  ['전개1-다',      'b.develop.0.levelC'],
  ['전개1-자료',    'b.develop.0.material'],
  ['전개2-과정',    'b.develop.1.process'],
  ['전개2-교사',    'b.develop.1.teacher'],
  ['전개2-가',      'b.develop.1.levelA'],
  ['전개2-나',      'b.develop.1.levelB'],
  ['전개2-다',      'b.develop.1.levelC'],
  ['전개2-자료',    'b.develop.1.material'],
  ['정리-과정',     'b.close.process'],
  ['정리-교사',     'b.close.teacher'],
  ['정리-자료',     'b.close.material'],
];
const EVAL = [['지식이해','지식·이해'],['과정기능','과정·기능'],['가치태도','가치·태도']];

/* ── 프롬프트 생성 ─────────────────────────────────────── */
function buildPastePrompt(){
  const d = data();
  const tools = [...d.aiTools]; if(d.customAiTool) tools.push(d.customAiTool);
  const plans = d.studentPlans || [];

  const stuLabels = plans.map(p =>
`[[학생${p.label}-지원]]
[[학생${p.label}-AI자료]]`).join('\n');

  const evalLabels = EVAL.map(([k,n]) =>
`[[평가-${k}-방법]]
[[평가-${k}-잘함]]
[[평가-${k}-보통]]
[[평가-${k}-노력요함]]`).join('\n');

  return `당신은 특수교육 기본 교육과정과 생성형 AI 활용 수업 설계에 정통한 공개수업 지도안 작성 전문가입니다.

중요 원칙: 생성형 AI 활용의 주체는 학생이 아니라 교사입니다. 학생이 AI를 직접 사용하는 장면으로 쓰지 말고,
교사가 생성형 AI로 제작·검토·재구성한 교육자료를 학생 교육에 활용하는 장면으로 작성하세요.

[수업 기본 정보]
일시: ${fieldText(d.lessonDate)} / 대상: ${fieldText(d.targetClass)} / 학생 수: ${fieldText(d.total)}명
적용 교육과정: ${fieldText(d.curriculumLabel)}
학교급·학년군: ${fieldText(d.schoolGroup)} / 교과: ${fieldText(d.subject)}
단원(제재): ${fieldText(d.unit)} / 차시: ${fieldText(d.lessonNo)} / 수업 시간: ${fieldText(d.duration)}
장소: ${fieldText(d.place)} / 수업 지원: ${fieldText(d.supportStaff)}
수업유형: ${fieldText(d.lessonType)} / 수업 형태: ${arrText(d.lessonForms)}

[교육과정 및 본시 목표]
${getCurriculumInputGuide(d)}

[학생 수준 및 개별 지원]
전체 ${fieldText(d.total)}명 · 가/A ${fieldText(d.countA)}명 · 나/B ${fieldText(d.countB)}명 · 다/C ${fieldText(d.countC)}명
추가 지원 필요: ${arrText(d.supports)}
${formatStudentPlans(plans)}

[생성형 AI 활용 정보]
사용 도구(교사용): ${arrText(tools)}
활용 구상: ${fieldText(d.aiUsePlan)}
수업설계 의도 참고: ${fieldText(d.designIntent)}

[수업유형별 강조점]
${getTypeExtra(d.lessonType)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식 — 반드시 지킬 것
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
아래 라벨 목록을 그대로 쓰고, 각 라벨 다음 줄부터 내용을 씁니다.
라벨은 수정하지 말고, 표·마크다운·번호매기기를 쓰지 마세요.
설명이나 머리말 없이 첫 줄부터 [[수업설계의도]] 로 시작하세요.

작성 규칙
· 교사 칸(-교사)은 "▣"로 활동을 묶고 그 아래 " - "로 세부 항목. 모든 항목을 "~하기" 로 끝냅니다.
· 학생 칸(-가 / -나 / -다)은 관찰 가능한 수행 행동만. 모든 문장을 "~한다." 로 끝냅니다.
  가·나·다의 차이가 촉진 위계(독립 수행 → 언어·시각 촉진 → 신체 촉진)로 드러나게 합니다.
· 자료 칸(-자료)은 자료를 ◉, 유의점을 ※ 로 시작. 안전 유의점을 하나 넣습니다.
· 과정 칸(-과정)은 짧은 낱말을 줄바꿈으로 나열합니다.
· 평가의 잘함·보통·노력요함은 촉진 횟수나 수행 단계 수로 구분되는 문장으로 씁니다.

[[수업설계의도]]
[[AI활용구상]]
[[도입-과정]]
[[도입-교사]]
[[도입-자료]]
[[전개1-과정]]
[[전개1-교사]]
[[전개1-가]]
[[전개1-나]]
[[전개1-다]]
[[전개1-자료]]
[[전개2-과정]]
[[전개2-교사]]
[[전개2-가]]
[[전개2-나]]
[[전개2-다]]
[[전개2-자료]]
[[정리-과정]]
[[정리-교사]]
[[정리-자료]]
${stuLabels}
${evalLabels}`;
}

/* ── 붙여넣은 글 해석 ──────────────────────────────────── */
function parseLabeled(text){
  const map = {};
  const re = /\[\[\s*([^\]]+?)\s*\]\]/g;
  const hits = [];
  let m;
  while((m = re.exec(text)) !== null) hits.push({ key: m[1], start: m.index, end: re.lastIndex });
  hits.forEach((h, i) => {
    const to = i+1 < hits.length ? hits[i+1].start : text.length;
    map[h.key] = text.slice(h.end, to).replace(/^\s*\n/, '').replace(/\s+$/, '');
  });
  return map;
}

function setPath(obj, path, val){
  const parts = path.split('.');
  let cur = obj;
  parts.forEach((p, i) => {
    const last = i === parts.length-1;
    const idx = /^\d+$/.test(parts[i+1]);
    if(last){ cur[p] = val; return; }
    if(cur[p] == null) cur[p] = idx ? [] : {};
    cur = cur[p];
  });
}

function buildDoc(text){
  const map = parseLabeled(text);
  if(!Object.keys(map).length) throw new Error('[[라벨]] 을 찾지 못했습니다. 결과 전체를 그대로 붙여넣으셨는지 확인해 주세요.');

  const d = data();
  const tools = [...d.aiTools]; if(d.customAiTool) tools.push(d.customAiTool);
  const doc = { a:{}, b:{ intro:{}, close:{}, develop:[{},{}] }, e:{ students:[], evaluation:[], reflection:[] }, d, tools };

  SLOTS.forEach(([label, path]) => {
    if(map[label] != null) setPath(doc, path, map[label]);
  });

  doc.a.competency = [];   // 역량은 폼에서 고른 값을 쓰지 않으므로 비워 둔다

  (d.studentPlans||[]).forEach(p => {
    doc.e.students.push({
      label: p.label,
      support:    map[`학생${p.label}-지원`]   || '',
      aiMaterial: map[`학생${p.label}-AI자료`] || ''
    });
  });

  EVAL.forEach(([k, name]) => {
    doc.e.evaluation.push({
      domain: name,
      method: map[`평가-${k}-방법`]     || '',
      high:   map[`평가-${k}-잘함`]     || '',
      mid:    map[`평가-${k}-보통`]     || '',
      low:    map[`평가-${k}-노력요함`] || ''
    });
  });

  const missing = SLOTS.filter(([l]) => !map[l]).map(([l]) => l);
  return { doc, missing };
}

/* ── 화면 ──────────────────────────────────────────────── */
function inject(){
  const bar = document.querySelector('.mini-actions');
  if(!bar || document.getElementById('btnPasteMode')) return setTimeout(inject, 200);

  const b = document.createElement('button');
  b.className = 'btn btn-secondary';
  b.id = 'btnPasteMode';
  b.style.cssText = 'background:#5b4b8a;color:#fff;border-color:#5b4b8a';
  b.textContent = '📥 붙여넣어 변환';
  b.onclick = openPanel;
  bar.appendChild(b);
}
document.addEventListener('DOMContentLoaded', inject);
if(document.readyState !== 'loading') inject();

function openPanel(){
  let box = document.getElementById('pastePanel');
  if(box){ box.scrollIntoView({behavior:'smooth'}); return; }

  const host = document.querySelector('.output') || document.body;
  box = document.createElement('div');
  box.id = 'pastePanel';
  box.style.cssText = 'border-top:2px solid #5b4b8a;padding:20px 24px;background:#fbfaff';
  box.innerHTML = `
    <div style="font-weight:800;color:#5b4b8a;margin-bottom:6px">붙여넣어 한글파일 만들기</div>
    <div style="font-size:12.5px;color:#556070;line-height:1.8;margin-bottom:12px">
      ① <b>프롬프트 복사</b> → ChatGPT나 클로드에 붙여넣기 &nbsp;·&nbsp;
      ② 나온 결과를 <b>전체 복사</b> → 아래 칸에 붙여넣기 &nbsp;·&nbsp;
      ③ <b>한글파일 만들기</b><br>
      라벨 <code>[[ ]]</code> 은 지우지 마세요. 내용은 마음껏 고치셔도 됩니다.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn btn-secondary" id="btnCopyPastePrompt">📋 프롬프트 복사</button>
      <button class="btn" id="btnMakeHwpx"
        style="background:#5b4b8a;color:#fff;border:0;font-weight:800">⬇ 한글파일 만들기</button>
      <span id="pasteMsg" style="align-self:center;font-size:12px;color:#556070"></span>
    </div>
    <textarea id="pasteArea" placeholder="여기에 결과 전체를 붙여넣으세요.&#10;&#10;[[수업설계의도]]&#10;본 차시는 …"
      style="width:100%;min-height:260px;border:1.5px solid #d0dae8;border-radius:8px;padding:12px;
             font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.7"></textarea>`;
  host.appendChild(box);
  box.scrollIntoView({behavior:'smooth'});

  document.getElementById('btnCopyPastePrompt').onclick = () => {
    const t = buildPastePrompt();
    navigator.clipboard.writeText(t)
      .then(()=> msg('프롬프트를 복사했습니다. ChatGPT나 클로드에 붙여넣으세요.'))
      .catch(()=> { const a=document.getElementById('pasteArea'); a.value=t; msg('복사 실패 — 아래 칸에 넣었으니 직접 복사하세요.'); });
  };

  document.getElementById('btnMakeHwpx').onclick = () => {
    const raw = document.getElementById('pasteArea').value.trim();
    if(!raw){ msg('붙여넣은 내용이 없습니다.'); return; }
    try{
      const { doc, missing } = buildDoc(raw);
      window.__DOC__ = doc;
      if(typeof renderDoc === 'function'){ try{ renderDoc(doc); }catch(_){ } }
      if(typeof window.exportHwpx === 'function'){
        window.exportHwpx();
        msg(missing.length ? `변환했습니다. 다만 비어 있는 칸: ${missing.join(', ')}` : '변환했습니다.');
      } else {
        msg('hwpx.js 가 로드되지 않았습니다. 스크립트 순서를 확인해 주세요.');
      }
    }catch(err){ msg('실패: ' + err.message); }
  };

  function msg(t){ document.getElementById('pasteMsg').textContent = t; }
}

})();
