/* ═══════════════════════════════════════════════════════════
   붙여넣기 → 한글파일 변환 경로 (v3.3)
   ───────────────────────────────────────────────────────────
   v3.3 변경  학생별 지원과 자료 유형 2줄 이내, 학생 수행 줄마다 "- ", 유의점 전개 활동당 1개
   v3.2 변경  API 경로와 같은 규칙 적용
     ① 전개 단계 구조  활동마다 단계 2~4개, 단계마다 교사 + 가·나·다
     ② 생성형 AI 표시  ▣ 제목 끝 [AI] → 한글 파일 초록 도형
     ③ 자료·유의점 축소  ◉ 3개 이내, ※ 1개 25자 이내 + 후처리
     ④ 도입 구성  ▣ 4개, 수준별 학습목표, 【활동n】 목록 자동 채움
   </body> 앞, patch.js → hwpx.js 뒤에 <script src="paste.js"></script>
   ═══════════════════════════════════════════════════════════ */
(function(){

/* ── 라벨 정의 : [[라벨]] → 들어갈 자리 ───────────────── */
function slots(n, s){
  const list = [
    ['수업설계의도', 'a.intent'],
    ['AI활용구상',   'a.aiPlan'],
    ['도입-과정',    'b.intro.process'],
    ['도입-교사',    'b.intro.teacher'],
    ['도입-자료',    'b.intro.material'],
  ];
  for(let i=0; i<n; i++){
    const k = i+1;
    list.push([`전개${k}-과정`, `b.develop.${i}.process`]);
    for(let j=0; j<s; j++){
      const t = j+1;
      list.push([`전개${k}-${t}단계-교사`, `b.develop.${i}.steps.${j}.teacher`]);
      list.push([`전개${k}-${t}단계-가`,   `b.develop.${i}.steps.${j}.levelA`]);
      list.push([`전개${k}-${t}단계-나`,   `b.develop.${i}.steps.${j}.levelB`]);
      list.push([`전개${k}-${t}단계-다`,   `b.develop.${i}.steps.${j}.levelC`]);
    }
    list.push([`전개${k}-자료`, `b.develop.${i}.material`]);
  }
  list.push(['정리-과정', 'b.close.process']);
  list.push(['정리-교사', 'b.close.teacher']);
  list.push(['정리-자료', 'b.close.material']);
  return list;
}
const selNum = (id, def) => {
  const el = document.getElementById(id);
  return el ? (parseInt(el.value,10) || def) : def;
};
const devCount  = () => selNum('devCount', 2);
const stepCount = () => selNum('stepCount', 3);
const EVAL = [['지식이해','지식·이해'],['과정기능','과정·기능'],['가치태도','가치·태도']];

/* ── 프롬프트 생성 ─────────────────────────────────────── */
function buildPastePrompt(){
  const d = data();
  const tools = [...d.aiTools]; if(d.customAiTool) tools.push(d.customAiTool);
  const plans = d.studentPlans || [];
  const n = devCount(), s = stepCount();

  const stuLabels = plans.map(p =>
`[[학생${p.label}-지원]]
[[학생${p.label}-AI자료]]`).join('\n');

  const evalLabels = EVAL.map(([k]) =>
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
· 괄호를 쓰지 않습니다. ( ) 「 」 [ ] 모두 금지이며 "교사 검토 필요" 같은 덧붙임 표시도 넣지 않습니다.
  단, 생성형 AI 표시 [AI] 와 활동 목록 표기 【활동1】 두 가지만 예외로 허용합니다.

· 생성형 AI 표시
  교사가 생성형 AI로 제작한 자료를 쓰는 ▣ 제목 줄의 맨 끝에만 [AI] 를 붙입니다. 보기 - ▣ 동기 유발하기 [AI]
  도입은 1개 이내, 전개는 적어도 1개 활동에 표시, 정리는 AI 제작 자료를 실제로 쓸 때만 표시합니다.
  세부 항목 줄, 학생 칸, 자료 칸에는 [AI] 를 쓰지 않습니다.
  본문에 AI 도구 이름을 쓰지 않고 "AI로 제작한 대화 카드"처럼만 씁니다.

· 도입-교사
  ▣ 4개를 이 순서로 씁니다. ▣ 수업 준비하기 / ▣ 동기 유발하기 / ▣ 학습목표 확인하기 / ▣ 학습활동 안내하기
  수업 준비하기, 동기 유발하기 아래에는 " - " 세부 항목 1~2줄, 줄마다 30자 이내, "~하기"로 끝냅니다.
  동기 유발하기에 교사 발문을 큰따옴표로 1개 넣습니다.
  학습목표 확인하기 아래에는 " • 가 : ~할 수 있다." " • 나 : ~할 수 있다." " • 다 : ~할 수 있다." 3줄을 씁니다.
  학습활동 안내하기 아래에는 아무것도 쓰지 않습니다. 프로그램이 전개 활동 목록을 채웁니다.

· 정리-교사
  ▣ 3개를 이 순서로 씁니다. ▣ 정리 및 평가하기 / ▣ 차시 예고하기 / ▣ 인사하기
  각 ▣ 아래 " - " 세부 항목 1~2줄, "~하기"로 끝냅니다.

· 전개 — 과정안에서 가장 구체적인 부분입니다
  활동은 정확히 ${n}개, 활동마다 단계는 정확히 ${s}개입니다. 라벨에 있는 만큼만 씁니다.
  단계 흐름은 자료 제시와 시범 → 학생 수행 → 확인과 피드백 순서로 짭니다.
  전개-과정 칸은 "활동1 ▶ 활동 제목" 형식 한 줄, 제목은 15자 이내입니다.
  단계-교사 칸은 첫 줄 "▣ 단계 제목하기", 그 아래 " - " 세부 항목 2~3줄입니다.
    무엇을 어떻게 제시하는지, 큰따옴표 발문, 촉구나 피드백 방법이 구체적으로 드러나야 합니다. 모든 항목을 "~하기"로 끝냅니다.
  단계-가·나·다 칸은 1~2줄, 칸당 30~60자입니다. 수행 하나를 한 줄로 쓰고 줄마다 "- "로 시작하며 "~한다."로 끝냅니다.
    바로 위 교사 단계에 대응하는 관찰 가능한 수행만 쓰고, 개수·횟수·반응 방식을 밝힙니다.
    촉구 위계를 드러냅니다. 가 "스스로", 나 "언어적 촉구를 받아", 다 "신체적 촉구를 받아" 또는 "그림 카드를 가리켜".

· 자료 칸은 매우 짧게 씁니다. 칸이 좁아 분량이 넘치면 표가 밀립니다.
  ◉ 로 시작하는 자료는 명사형 20자 이내, 전개는 3줄 이내, 도입과 정리는 2줄 이내입니다.
  AI로 만든 자료는 앞에 "AI 제작"을 붙입니다. 보기 - ◉ AI 제작 대화 장면 카드
  ※ 로 시작하는 유의점은 전개 활동마다 정확히 1줄, 20자 이내 명사형입니다. 도입과 정리에는 쓰지 않습니다.
  안전 위험이 있으면 안전을, 없으면 개별 지원을 씁니다. 보기 - ※ 음량 사전 점검

· 도입-과정, 정리-과정 칸은 짧은 낱말을 줄바꿈으로 나열합니다.
· 학생-지원 칸은 AI로 제작한 자료로 이 학생을 어떻게 지원하는지 핵심만 1~2줄, 줄마다 "- "로 시작, 30자 이내 명사형입니다.
· 학생-AI자료 칸은 교사가 생성형 AI로 개발하는 자료 유형 1~2줄, 줄마다 "- "로 시작, 20자 이내 명사형입니다. 보기 - 상황 그림 카드
· 평가의 잘함·보통·노력요함은 촉진 횟수나 수행 단계 수로 구분되는 문장으로 씁니다.

${slots(n, s).map(([l]) => `[[${l}]]`).join('\n')}
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

  /* 붙여넣은 라벨에서 활동 수와 단계 수를 직접 읽는다 */
  let n = 0, s = 0;
  Object.keys(map).forEach(k => {
    const m = k.match(/^전개(\d+)-(?:(\d+)단계-)?/);
    if(m){ n = Math.max(n, +m[1]); if(m[2]) s = Math.max(s, +m[2]); }
  });
  if(!n) n = devCount();
  if(!s) s = 1;

  const doc = { a:{}, b:{ intro:{}, close:{}, develop:[] }, e:{ students:[], evaluation:[], reflection:[] }, d, tools };
  for(let i=0;i<n;i++) doc.b.develop.push({ steps: [] });

  slots(n, s).forEach(([label, path]) => {
    if(map[label] != null) setPath(doc, path, map[label]);
  });

  /* 이전 형식 라벨(전개1-교사, 전개1-가 …)도 받아 준다 */
  doc.b.develop.forEach((x, i) => {
    const k = i+1;
    if(map[`전개${k}-교사`] != null) x.teacher = map[`전개${k}-교사`];
    ['가','나','다'].forEach((lv, j) => {
      const v = map[`전개${k}-${lv}`];
      if(v != null) x[['levelA','levelB','levelC'][j]] = v;
    });
    x.steps = (x.steps || []).filter(Boolean);
  });

  /* API 경로와 같은 후처리: 자료 개수 제한, 단계 정리, 【활동n】 목록 채움 */
  if(typeof window.__tidyPlan__ === 'function') window.__tidyPlan__(doc.b);

  doc.a.competency = [];
  const tidyStu = window.__tidyStudents__ || (x => x);

  (d.studentPlans||[]).forEach(p => {
    doc.e.students.push({
      label: p.label,
      support:    map[`학생${p.label}-지원`]   || '',
      aiMaterial: map[`학생${p.label}-AI자료`] || ''
    });
  });

  tidyStu(doc.e.students);

  EVAL.forEach(([k, name]) => {
    doc.e.evaluation.push({
      domain: name,
      method: map[`평가-${k}-방법`]     || '',
      high:   map[`평가-${k}-잘함`]     || '',
      mid:    map[`평가-${k}-보통`]     || '',
      low:    map[`평가-${k}-노력요함`] || ''
    });
  });

  const legacy = Object.keys(map).some(k => /^전개\d+-교사$/.test(k));
  const missing = legacy ? [] : slots(n, s).filter(([l]) => !map[l]).map(([l]) => l);
  return { doc, missing, n, s };
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

  const sel = 'margin-left:5px;padding:6px 8px;border:1.5px solid #d0dae8;border-radius:7px';
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
      <code>[AI]</code> 표시는 한글 파일에서 초록 도형으로 바뀝니다.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <label style="align-self:center;font-size:12.5px;color:#556070">전개 활동
        <select id="devCount" style="${sel}"><option>2</option><option>3</option><option>4</option></select> 개</label>
      <label style="align-self:center;font-size:12.5px;color:#556070">활동당 단계
        <select id="stepCount" style="${sel}"><option>2</option><option selected>3</option><option>4</option></select> 개</label>
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
      const { doc, missing, n, s } = buildDoc(raw);
      window.__DOC__ = doc;
      if(typeof window.__renderDoc__ === 'function'){ try{ window.__renderDoc__(doc); }catch(_){ } }
      if(typeof window.exportHwpx === 'function'){
        window.exportHwpx();
        msg(`전개 활동 ${n}개, 활동당 ${s}단계로 변환했습니다.` + (missing.length ? ` 비어 있는 칸: ${missing.join(', ')}` : ''));
      } else {
        msg('hwpx.js 가 로드되지 않았습니다. 스크립트 순서를 확인해 주세요.');
      }
    }catch(err){ msg('실패: ' + err.message); }
  };

  function msg(t){ document.getElementById('pasteMsg').textContent = t; }
}

})();
