/* ═══════════════════════════════════════════════════════════
   공개수업 지도안 프롬프트 생성기 v3.4 패치
   ───────────────────────────────────────────────────────────
   v3.4 변경  학생 특성은 AI가 수업 관련 핵심만 추출, IEP 목표는 입력값 유지,
              AI 활용 개별 지원 방안 구체화, 칸 줄 간격 오류 수정
   v3.3 변경  핵심역량 체크박스 탭 정렬, 학생별 지원과 자료 유형 2줄 이내,
              학생 수행 줄마다 "- ", 유의점은 전개 활동당 1개 20자 이내,
              표 머리 "본 차시 AI 활용 개별적 지원 방안", "생성형 AI 활용 자료 개발 유형"
   v3.2 변경  전개 구체화 — 활동마다 교수 단계 3개(제시·시범 → 수행 → 확인·피드백),
              단계마다 교사 활동 1행 + 가·나·다 수준별 수행 1행
   v3.1 변경
   ① 자료·유의점 분량 축소  ◉ 3개 이내, ※ 1개 25자 이내 (프롬프트 + 후처리 이중 제한)
   ② 생성형 AI 활용 단계 표시  ▣ 제목 끝 [AI] → 미리보기 초록 배지, 한글 파일 초록 도형
   ③ 탑재용 과정안 66편 공통점 반영
      도입 ▣ 4개 고정, 수준별 학습목표, 【활동n】 목록, 큰따옴표 발문,
      촉구 위계 표기, 본문 도구명 제외
   사용법: 기존 생성기 HTML의 </body> 바로 앞에
           <script> … 이 파일 내용 … </script> 를 붙여넣으세요.
   ═══════════════════════════════════════════════════════════ */
(function(){

const MODEL = "claude-sonnet-4-6";
const AI_MARK = "[AI]";

/* ── 1. 버튼 주입 (HTML 수정 불필요) ───────────────────── */
document.addEventListener('DOMContentLoaded', injectButtons);
if(document.readyState !== 'loading') injectButtons();

function injectButtons(){
  const bar = document.querySelector('.mini-actions');
  if(!bar || document.getElementById('btnGenDoc')) return;

  const gen = document.createElement('button');
  gen.className = 'btn btn-secondary';
  gen.id = 'btnGenDoc';
  gen.style.cssText = 'background:var(--accent);color:#fff;border-color:var(--accent)';
  gen.textContent = '⚡ 과정안 바로 생성';
  gen.onclick = generateDocument;
  bar.insertBefore(gen, bar.firstChild);

  const hwp = document.createElement('button');
  hwp.className = 'btn btn-secondary';
  hwp.id = 'btnCopyHwp';
  hwp.textContent = '📄 한글로 복사';
  hwp.onclick = copyToHwp;
  bar.insertBefore(hwp, bar.children[1]);
}

/* ── 2. 생성 요청 (JSON만 수신) ───────────────────────── */
const ENDPOINT = "/api/generate";

async function askJSON(prompt, step){
  const r = await fetch(ENDPOINT, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ prompt, json:true })
  });
  if(!r.ok){
    let msg = "요청 실패 " + r.status;
    try{ const j = await r.json(); if(j.error) msg = j.error; }catch(_){}
    throw new Error(`[${step}] ${msg}`);
  }
  const j = await r.json();
  const txt = String(j.text || "");
  const s0 = txt.indexOf("{"), e0 = txt.lastIndexOf("}");
  if(s0 < 0) throw new Error(`[${step}] JSON 형식이 아닌 응답`);

  const body = txt.slice(s0, e0 >= s0 ? e0+1 : undefined);
  const tries = [
    body,
    escapeRawBreaks(body),
    repairJSON(txt.slice(s0)),
    repairJSON(escapeRawBreaks(txt.slice(s0)))
  ];
  for(const t of tries){
    if(!t) continue;
    try{ return JSON.parse(t); }catch(_){ }
  }
  window.__LASTRAW__ = txt;
  const head = txt.replace(/\s+/g, ' ').slice(0, 160);
  const cut  = j.stop === 'max_tokens' ? ' 길이제한' : '';
  throw new Error(`[${step}]${cut} 해석 실패 · 응답 앞부분 → ${head}`);
}

function escapeRawBreaks(t){
  let out = '', inStr = false, esc = false;
  for(let i=0; i<t.length; i++){
    const ch = t[i];
    if(inStr){
      if(esc){ out += ch; esc = false; continue; }
      if(ch === '\\'){ out += ch; esc = true; continue; }
      if(ch === '"'){ inStr = false; out += ch; continue; }
      if(ch === '\n'){ out += '\\n'; continue; }
      if(ch === '\r'){ continue; }
      if(ch === '\t'){ out += '\\t'; continue; }
      out += ch; continue;
    }
    if(ch === '"'){ inStr = true; }
    out += ch;
  }
  return out;
}

function repairJSON(t){
  const stack = []; let inStr = false, esc = false, lastSafe = -1;
  for(let i=0; i<t.length; i++){
    const ch = t[i];
    if(inStr){
      if(esc){ esc = false; }
      else if(ch === '\\'){ esc = true; }
      else if(ch === '"'){ inStr = false; }
      continue;
    }
    if(ch === '"'){ inStr = true; }
    else if(ch === '{' || ch === '['){ stack.push(ch === '{' ? '}' : ']'); }
    else if(ch === '}' || ch === ']'){ stack.pop(); if(!stack.length) return t.slice(0, i+1); }
    else if(ch === ',' && stack.length){ lastSafe = i; }
  }
  if(!stack.length) return null;
  let head = inStr && lastSafe > 0 ? t.slice(0, lastSafe) : t;
  if(inStr && lastSafe <= 0) return null;
  head = head.replace(/[,\s]+$/, '');
  return head + stack.reverse().join('');
}

/* ── 3. 공통 컨텍스트 ─────────────────────────────────── */
function baseCtx(){
  const d = data();
  const tools = [...d.aiTools];
  if(d.customAiTool) tools.push(d.customAiTool);

  const text = `당신은 특수교육 기본 교육과정과 생성형 AI 활용 수업 설계에 정통한 공개수업 지도안 작성 전문가입니다.

중요 원칙: 생성형 AI 활용의 주체는 학생이 아니라 교사입니다. 학생이 AI를 직접 사용하는 장면으로 쓰지 말고,
교사가 생성형 AI로 제작·검토·재구성한 교육자료를 학생 교육에 활용하는 장면으로 작성하세요.

[수업 기본 정보]
일시: ${fieldText(d.lessonDate)} / 대상: ${fieldText(d.targetClass)} / 대상 학생 수: ${fieldText(d.total)}명
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
${formatStudentPlans(d.studentPlans)}

[생성형 AI 활용 정보]
사용 도구(교사용): ${arrText(tools)}
활용 구상: ${fieldText(d.aiUsePlan)}
수업설계 의도 참고: ${fieldText(d.designIntent)}

[수업유형별 강조점]
${getTypeExtra(d.lessonType)}`;

  return { d, tools, text };
}

const RULE = `

출력 규칙: JSON 객체 하나만 출력한다. 설명·머리말·마크다운 코드펜스를 붙이지 않는다.
특수교육대상학생을 존중하는 표현을 쓰고, 결핍보다 참여 방식과 지원 조건을 중심으로 쓴다.
괄호는 쓰지 않는다. ( ) 「 」 [ ] 모두 금지이며 "교사 검토 필요" 같은 덧붙임 표시도 넣지 않는다.
단, 생성형 AI 표시 [AI] 와 활동 목록 표기 【활동1】 두 가지만 예외로 허용한다.`;

/* 과정안 본문 공통 규칙 (v3.1) */
const PLAN_RULE = `

생성형 AI 표시 규칙:
- 교사가 생성형 AI로 제작한 자료를 쓰는 ▣ 제목 줄의 맨 끝에만 [AI] 를 붙인다. 예: "▣ 동기 유발하기 [AI]"
- 세부 항목 줄, 학생 활동 칸, 자료 칸에는 [AI] 를 쓰지 않는다.
- 본문에 AI 도구 이름을 쓰지 않는다. "AI로 제작한 대화 카드"처럼만 쓴다.

자료·유의점 칸 규칙:
- 자료는 ◉ 로 시작하는 명사형 20자 이내. AI로 만든 자료는 앞에 "AI 제작"을 붙인다. 예: "◉ AI 제작 대화 장면 카드"
- 유의점은 ※ 로 시작하는 한 줄, 20자 이내, 명사형으로 끝낸다. 예: "※ 음량 사전 점검"
- 유의점은 전개 활동마다 1개만 쓴다. 안전 위험이 있으면 안전을, 없으면 개별 지원을 쓴다.`;

/* ── 4. 3분할 프롬프트 ─────────────────────────────────── */
const P1 = c => `${c}

위 수업의 (1) 수업설계 의도, (2) 생성형 AI 활용 구상, (3) 해당 핵심역량을 작성하라.
- intent: 4~6문장. 단원 속 위치, 학생들의 이질적 수준, 그래서 왜 이 자료가 필요한지, IEP·개별화 지원과의 연결. 마지막에 AI 생성 자료를 교사가 검토·재구성했음을 명시.
- aiPlan: 3~4문장. 어떤 자료를 어떻게 제작하고 교사가 어떻게 검토·재구성하는지.
- competency: 이 수업에 해당하는 역량명만 배열로. (자기관리 / 지식정보처리 / 창의적 사고 / 심미적 감성 / 협력적 소통 / 공동체)

{"intent":"...","aiPlan":"...","competency":["..."]}${RULE}`;

const P2A = c => `${c}

교수·학습 과정안의 도입(5분)과 정리(5분)만 작성하라.

intro.teacher 규칙:
- ▣ 4개를 이 순서로 쓴다. ▣ 수업 준비하기 / ▣ 동기 유발하기 / ▣ 학습목표 확인하기 / ▣ 학습활동 안내하기
- 수업 준비하기, 동기 유발하기 아래에는 " - "로 시작하는 세부 항목을 1~2줄, 줄마다 30자 이내로 쓰고 "~하기"로 끝낸다.
- 동기 유발하기 세부 항목에 교사 발문을 큰따옴표로 1개 넣는다. 예: - "무슨 일이 생겼을까요?" 발문하기
- 학습목표 확인하기 아래에는 수준별 목표 3줄을 " • 가 : ~할 수 있다." " • 나 : ~할 수 있다." " • 다 : ~할 수 있다." 형식으로 쓴다. 수준 차이는 촉구 정도로 구분한다.
- 학습활동 안내하기 아래에는 아무것도 쓰지 않는다. 프로그램이 전개 활동 목록을 채운다.

close.teacher 규칙:
- ▣ 3개를 이 순서로 쓴다. ▣ 정리 및 평가하기 / ▣ 차시 예고하기 / ▣ 인사하기
- 각 ▣ 아래 " - " 세부 항목 1~2줄, 줄마다 30자 이내, "~하기"로 끝낸다.

material 규칙: intro 와 close 는 ◉ 2개 이내만 쓰고 유의점 ※ 은 쓰지 않는다.
[AI] 는 도입에서 1개 이내, 정리에서는 AI 제작 자료를 실제로 쓸 때만 붙인다.
process(학습 과정)는 줄바꿈 \\n 으로 구분한다.

{"intro":{"process":"수업 준비\\n동기 유발\\n학습목표 확인\\n학습활동 안내","teacher":"...","material":"..."},
"close":{"process":"정리 및 평가\\n차시 예고\\n인사·마무리","teacher":"...","material":"..."}}${PLAN_RULE}${RULE}`;

const P2B = c => `${c}

교수·학습 과정안의 전개(30분)만 작성하라. 전개는 과정안에서 가장 구체적인 부분이다. 활동은 정확히 2개.

활동 구성 규칙(반드시 지킬 것):
- process: "활동1 ▶ 활동 제목" 형식, 제목은 15자 이내.
- steps: 활동마다 교수 단계 3개. 흐름은 ① 자료 제시와 시범 → ② 학생 수행 → ③ 확인과 피드백 순서로 짠다.
- steps[].teacher(교사의 활동): 첫 줄은 "▣ 단계 제목하기", 그 아래 " - " 세부 항목 2~3줄.
  세부 항목에는 무엇을 어떻게 제시하는지, 교사 발문, 촉구나 피드백 방법이 구체적으로 드러나야 한다.
  발문은 큰따옴표로 쓴다. 모든 항목을 "~하기"로 끝낸다.
  AI 제작 자료를 제시하는 단계의 ▣ 제목 끝에 [AI] 를 붙인다. 두 활동 중 적어도 1개 활동에는 [AI] 가 있어야 한다.
- steps[].levelA / levelB / levelC(학생의 활동): 바로 위 교사 단계에 대응하는 학생 수행 1~2줄, 칸당 30~60자.
  수행 하나를 한 줄로 쓰고 줄마다 "- "로 시작하며 "~한다."로 끝낸다.
  무엇을, 어떤 방식으로, 얼마나 하는지 관찰 가능하게 쓴다. 예: 개수, 횟수, 반응 방식.
  촉구 위계를 드러낸다. 가 "스스로", 나 "언어적 촉구를 받아", 다 "신체적 촉구를 받아" 또는 "그림 카드를 가리켜".
  교사 행동을 여기 쓰지 않는다.
- material: 활동 전체에 대해 ◉ 3개 이내와 ※ 정확히 1개. 자료 칸은 짧게 유지한다.

{"develop":[{"process":"활동1 ▶ ...","steps":[{"teacher":"▣ ...\\n - ...\\n - ...","levelA":"...","levelB":"...","levelC":"..."},{"teacher":"...","levelA":"...","levelB":"...","levelC":"..."},{"teacher":"...","levelA":"...","levelB":"...","levelC":"..."}],"material":"..."},
{"process":"활동2 ▶ ...","steps":[...],"material":"..."}]}${PLAN_RULE}${RULE}`;

const P3 = c => `${c}

(1) 학생별 "학생 특성", "본 차시 AI 활용 개별적 지원 방안", "생성형 AI 활용 자료 개발 유형"을 작성.
    char: 교사가 입력한 학생 특성을 그대로 옮기지 말고 분석하여, 이 수업의 활동과 목표에 직접 관련된 핵심 특성만 1~2줄.
          줄마다 "- "로 시작, 35자 이내, 명사형으로 끝낸다. 수업과 관계없는 특성은 뺀다. IEP 목표는 쓰지 않는다.
    support: 어느 활동에서 어떤 AI 제작 자료를 어떻게 제시하고 어떤 촉구로 수행을 돕는지 구체적으로 1~2줄.
          줄마다 "- "로 시작, 40~60자, 명사형으로 끝낸다. 예: "- 활동1에서 AI 제작 장면 카드를 2장으로 줄여 제시하고 손짓 촉구로 선택 지원"
    aiMaterial: 교사가 생성형 AI로 개발하는 자료 유형 1~2줄. 줄마다 "- "로 시작, 20자 이내 명사형. 예: "- 상황 그림 카드", "- 짧은 대화 영상"
    students 배열의 label 은 위 학생 정보의 라벨(A, B, C …)을 그대로 쓴다.
    AI 도구 이름은 쓰지 않는다.
(2) 평가계획을 지식·이해 / 과정·기능 / 가치·태도 3영역으로 작성. high·mid·low 는 촉진 횟수나 수행 단계 수로 구분되는 관찰 가능한 문장.
(3) 수업 나눔 질문 3개. 참관자가 협의회에서 논의할 만한 것으로.

{"students":[{"label":"A","char":"...","support":"...","aiMaterial":"..."}],
"evaluation":[{"domain":"지식·이해","method":"관찰평가\\n수행평가","high":"...","mid":"...","low":"..."}],
"reflection":["...","...","..."]}${RULE}`;

/* ── 4-1. 후처리 (v3.1) ───────────────────────────────── */
/* 자료 칸: ◉·※ 개수 제한, 빈 줄 제거, 잘못 들어간 [AI] 제거 */
const NOTE_MAX = 22;          // ※ 한 줄 글자 수 상한 (※ 제외, 공백 포함)
function trimNote(s){
  let t = s.replace(/^※\s*/, '').trim();
  if(t.length > NOTE_MAX){
    const cut = t.search(/[,，]|\s(?:및|또는)\s/);
    t = (cut > 4 && cut <= NOTE_MAX) ? t.slice(0, cut) : t.slice(0, NOTE_MAX).replace(/\s+\S*$/, '');
  }
  return '※ ' + t.replace(/[.\s]+$/, '');
}
function limitMaterial(text, maxMat, maxNote){
  let m = 0, n = 0;
  return String(text || '').split('\n')
    .map(s => s.split(AI_MARK).join('').trim())
    .filter(s => {
      if(!s) return false;
      if(s.startsWith('◉')) return ++m <= maxMat;
      if(s.startsWith('※')) return ++n <= maxNote;
      return false;
    })
    .map(s => s.startsWith('※') ? trimNote(s) : s)
    .join('\n');
}
/* 학생 수행 칸: 수행 하나를 한 줄로, 줄마다 "- " */
function dashLines(text){
  return String(text || '').split(AI_MARK).join('')
    .split('\n')
    .flatMap(s => s.split(/(?<=다\.)\s+/))
    .map(s => s.replace(/^\s*[-–—·•]\s*/, '').trim())
    .filter(Boolean)
    .map(s => '- ' + s)
    .join('\n');
}
/* 학생별 지원·자료 유형: 핵심 2줄 이내, 줄마다 "- " */
function tidyStudents(list){
  (list || []).forEach(x => {
    ['char', 'support', 'aiMaterial'].forEach(k => {
      x[k] = String(x[k] || '').split('\n')
        .map(s => s.replace(/^\s*[-–—·•]\s*/, '').trim())
        .filter(Boolean).slice(0, 2)
        .map(s => '- ' + s).join('\n');
    });
  });
  return list;
}
const noMark = s => String(s || '').split(AI_MARK).join('').trim();

/* 학습활동 안내하기 아래를 전개 활동 제목으로 채운다 */
function fillActList(intro, develop){
  if(!intro || !intro.teacher) return;
  const titles = (develop || []).map((x, i) => {
    const t = String(x.process || '').replace(/^\s*활동\s*\d+\s*▶?\s*/, '').trim();
    return t ? ` 【활동${i+1}】 ${t}` : '';
  }).filter(Boolean);
  const lines = intro.teacher.split('\n');
  const k = lines.findIndex(s => /▣\s*학습\s*활동\s*안내/.test(s));
  if(k < 0){ if(titles.length) intro.teacher += '\n\n▣ 학습활동 안내하기\n' + titles.join('\n'); return; }
  let e = k + 1;
  while(e < lines.length && !/^\s*▣/.test(lines[e])) e++;
  intro.teacher = [...lines.slice(0, k+1), ...titles, ...lines.slice(e)].join('\n');
}

function tidy(b){
  const io_ = b.intro || {}, cl = b.close || {};
  io_.material = limitMaterial(io_.material, 2, 0);
  cl.material  = limitMaterial(cl.material, 2, 0);
  (b.develop || []).forEach(x => {
    x.material = limitMaterial(x.material, 3, 1);
    x.process = noMark(x.process);
    /* 구형 응답(teacher·level 단일)도 steps 1개로 맞춘다 */
    if(!Array.isArray(x.steps) || !x.steps.length)
      x.steps = [{ teacher:x.teacher, levelA:x.levelA, levelB:x.levelB, levelC:x.levelC }];
    x.steps = x.steps.filter(s => s && (s.teacher || s.levelA || s.levelB || s.levelC)).slice(0, 4);
    if(!x.steps.length) x.steps = [{}];
    x.steps.forEach(s => {
      s.teacher = String(s.teacher || '');
      s.levelA = dashLines(s.levelA); s.levelB = dashLines(s.levelB); s.levelC = dashLines(s.levelC);
    });
  });
  fillActList(io_, b.develop);
  return b;
}

/* ── 5. 실행 ───────────────────────────────────────────── */
let DOC = null;

async function generateDocument(){
  const btn = document.getElementById('btnGenDoc');
  const c = baseCtx();

  if(!c.d.subject || !c.d.unit){ showToast('교과와 단원을 먼저 입력하세요.'); return; }

  btn.disabled = true;
  switchTab('preview');
  const panel = document.getElementById('previewPanel');
  const say = m => panel.innerHTML =
    `<div class="empty"><div class="big">⚙️</div><b>${m}</b><span>생성에는 30초 안팎이 걸립니다.</span></div>`;

  try{
    say('1/4 · 수업설계 의도를 작성하고 있습니다');    const a  = await askJSON(P1(c.text),  '설계의도');
    say('2/4 · 도입과 정리를 구성하고 있습니다');      const b1 = await askJSON(P2A(c.text), '도입·정리');
    say('3/4 · 전개 활동을 구성하고 있습니다');        const b2 = await askJSON(P2B(c.text), '전개');
    say('4/4 · 개별지원과 평가계획을 작성하고 있습니다'); const e  = await askJSON(P3(c.text),  '개별지원·평가');
    tidyStudents(e.students);
    const b = tidy({ intro: b1.intro, close: b1.close, develop: b2.develop || [] });
    DOC = { a, b, e, d: c.d, tools: c.tools };
    window.__DOC__ = DOC;
    renderDoc(DOC);
    showToast('과정안이 생성되었습니다. 한글파일로 내려받아 보세요.');
  }catch(err){
    panel.innerHTML = `<div class="empty"><div class="big">⚠️</div><b>생성 실패: ${escapeHtml(err.message)}</b>
      <span>외부망이 차단된 환경일 수 있습니다. 이 경우 <b>📝 프롬프트</b> 탭의 기존 방식을 사용하세요.</span></div>`;
  }
  btn.disabled = false;
}

/* ── 6. 서식대로 렌더링 ────────────────────────────────── */
const AI_BADGE = '<span style="display:inline-block;padding:0 6px;margin:0 2px;border-radius:8px;background:#9BE5C8;font-size:.82em;line-height:1.55;font-weight:700">생성형AI</span>';
const withBadge = html => String(html).split(AI_MARK).join(AI_BADGE);

function renderDoc({a, b, e, d, tools}){
  const B = '1px solid #000';
  const td = (t, s='') => `<td style="border:${B};padding:5px 6px;vertical-align:top;white-space:pre-wrap;${s}">${withBadge(escapeHtml(t||''))}</td>`;
  const th = (t, s='', at='') => `<th${at} style="border:${B};background:#eef2f7;padding:6px;text-align:center;vertical-align:middle;font-weight:700;white-space:pre-wrap;${s}">${withBadge(escapeHtml(t))}</th>`;
  const lbl = t => td(t, 'background:#f4f6f9;text-align:center;font-weight:700;vertical-align:middle');
  const tbl = r => `<table style="width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.6;margin-bottom:10px;table-layout:fixed">${r}</table>`;
  const cap = (t, n) => `<tr><td colspan="${n}" style="border:${B};background:#e4e9f0;text-align:center;font-weight:800;letter-spacing:.25em;padding:6px">${escapeHtml(t)}</td></tr>`;

  const C15 = ["자기관리","지식정보처리","창의적 사고","심미적 감성","의사소통","공동체"];
  const C22 = ["자기관리","지식정보처리","창의적 사고","심미적 감성","협력적 소통","공동체"];
  const pick = a.competency || [];
  const is22 = d.curriculumVersion !== '2015';
  const box = (arr, on) => arr.map(x => `<span style="display:inline-block;width:33%">${(on && on.includes(x) ? "■ " : "□ ") + x} 역량</span>`).join("");

  const AITOOLS = ["ChatGPT","Claude","Gemini","Grok","Kling","기타"];
  const ETHICS = [
    ["생성형 AI 생성 자료의 오류 교사 차원의 검토","개인정보 및 민감 정보 미입력 원칙 준수"],
    ["생성형 AI 결과물의 교육적 재구성 여부 명시","학생의 생성형 AI 의존도 과잉 방지 전략 수립"],
    ["결과물의 편향성 및 윤리적 문제 검토 완료","생성형 AI 활용 사실 및 출처 명확히 표기"]
  ];

  let h = `<div style="font-family:바탕,Batang,serif;color:#000">
  <div style="text-align:center;font-size:14px;font-weight:800;line-height:1.8;margin-bottom:12px">
    생성형 AI 기반 「프로그램」 운영을 통한 맞춤형 특수교육 실천 역량 강화 방안 연구<br>
    ( ${escapeHtml(fieldText(d.subject))} )과 교수·학습 과정안</div>`;

  h += tbl(
    `<colgroup><col width="11%"><col width="24%"><col width="10%"><col width="21%"><col width="13%"><col width="21%"></colgroup>` +
    `<tr>${lbl('일 시')}${td(fieldText(d.lessonDate),'text-align:center')}${lbl('대 상')}${td(fieldText(d.targetClass),'text-align:center')}${lbl('지도교사')}${td(d.teacherName)}</tr>` +
    `<tr>${lbl('단 원\n(제재)')}${td(fieldText(d.unit),'text-align:center')}${lbl('장 소')}${td(fieldText(d.place),'text-align:center')}${lbl('수업 지원')}${td(d.supportStaff)}</tr>` +
    `<tr>${lbl('차 시')}${td(fieldText(d.lessonNo),'text-align:center')}${lbl('수업유형')}${td(fieldText(d.lessonType),'')}${lbl('수업 형태')}${td(arrText(d.lessonForms))}</tr>` +
    `<tr>${lbl('학습목표')}<td colspan="5" style="border:${B};padding:5px 6px;white-space:pre-wrap">${escapeHtml(fieldText(d.lessonGoal))}</td></tr>`
  );

  h += tbl(
    `<colgroup><col width="13%"><col width="17%"><col width="70%"></colgroup>` +
    `<tr>${lbl('교육과정\n성취기준')}<td colspan="2" style="border:${B};padding:5px 6px">${escapeHtml((d.achCode? d.achCode+' ':'') + fieldText(d.achStd))}</td></tr>` +
    `<tr><td rowspan="2" style="border:${B};background:#f4f6f9;text-align:center;font-weight:700;vertical-align:middle">핵심역량</td>` +
      `${lbl('2015 개정\n특수교육 교육과정')}<td style="border:${B};padding:5px 6px;font-size:11px">${box(C15, is22?[]:pick)}</td></tr>` +
    `<tr>${lbl('2022 개정\n특수교육 교육과정')}<td style="border:${B};padding:5px 6px;font-size:11px">${box(C22, is22?pick:[])}</td></tr>` +
    `<tr>${lbl('수업설계 의도')}<td colspan="2" style="border:${B};padding:5px 6px;white-space:pre-wrap">${escapeHtml(a.intent||'')}</td></tr>`
  );

  const sup = {}; (e.students||[]).forEach(s => sup[s.label] = s);
  const rows = (d.studentPlans||[]).map(p => {
    const x = sup[p.label] || {};
    return `<tr>${lbl(p.label)}${td(x.char || fieldText(p.char))}${td(fieldText(p.goal))}${td(x.support||'')}${td(x.aiMaterial||'')}</tr>`;
  }).join('') || `<tr><td colspan="5" style="border:${B};padding:14px;text-align:center;color:#888">학생 정보 미입력</td></tr>`;

  h += tbl(
    `<colgroup><col width="8%"><col width="22%"><col width="22%"><col width="26%"><col width="22%"></colgroup>` +
    cap('대상 학생 특성 및 개별적 지원 계획', 5) +
    `<tr>${th('학생')}${th('학생 특성')}${th('IEP 관련 목표')}${th('본 차시 AI 활용\n개별적 지원 방안')}${th('생성형 AI 활용\n자료 개발 유형')}</tr>` + rows
  );

  h += tbl(
    `<colgroup><col width="16%"><col width="42%"><col width="42%"></colgroup>` +
    cap('생성형 인공지능 활용 계획', 3) +
    `<tr>${lbl('사용 도구\n(교사용)')}<td colspan="2" style="border:${B};padding:5px 6px">${
      AITOOLS.map(t=>(d.aiTools.includes(t)?'■ ':'□ ')+t).join('　')}${d.customAiTool?'　('+escapeHtml(d.customAiTool)+')':''}</td></tr>` +
    `<tr>${lbl('생성형 AI\n활용 구상')}<td colspan="2" style="border:${B};padding:5px 6px;white-space:pre-wrap">${escapeHtml(a.aiPlan||'')}</td></tr>` +
    `<tr>${lbl('생성형 AI\n윤리 준수 여부')}${td(ETHICS.map(r=>'☑ '+r[0]).join('\n'))}${td(ETHICS.map(r=>'☑ '+r[1]).join('\n'))}</tr>`
  );

  /* 과정안: 한글 서식과 같은 6열 구조 (교사 활동 1행 + 가·나·다 1행 반복) */
  const cell = (t, at='', s='') => `<td${at} style="border:${B};padding:5px 6px;vertical-align:top;white-space:pre-wrap;${s}">${withBadge(escapeHtml(t||''))}</td>`;
  const lab  = (t, at='') => cell(t, at, 'background:#f4f6f9;text-align:center;font-weight:700;vertical-align:middle');
  const dev = b.develop || [];
  const devTotal = dev.reduce((n, x) => n + 2*(x.steps||[{}]).length, 0);
  const one = (name, s) => `<tr>${lab(name)}${lab(s.process||'')}${cell(s.teacher||'',' colspan="3"')}${cell(s.material||'')}</tr>`;
  let devRows = '';
  dev.forEach((x, i) => {
    const st = x.steps || [{}], k = 2*st.length;
    st.forEach((s, j) => {
      devRows += '<tr>' +
        (i===0 && j===0 ? lab('전개\n(30´)', ` rowspan="${devTotal}"`) : '') +
        (j===0 ? lab(x.process||'', ` rowspan="${k}"`) : '') +
        cell(s.teacher||'', ' colspan="3"') +
        (j===0 ? cell(x.material||'', ` rowspan="${k}"`) : '') + '</tr>';
      devRows += `<tr>${cell(s.levelA)}${cell(s.levelB)}${cell(s.levelC)}</tr>`;
    });
  });

  h += tbl(
    `<colgroup><col width="8%"><col width="11%"><col width="22%"><col width="22%"><col width="22%"><col width="15%"></colgroup>` +
    `<tr>${th('학습\n단계','',' rowspan="2"')}${th('학습\n과정','',' rowspan="2"')}${th('교수·학습 활동\n('+AI_MARK+' 생성형 AI 활용)','',' colspan="3"')}${th('자료(◉) 및\n유의점(※)','',' rowspan="2"')}</tr>` +
    `<tr>${th('가 수준')}${th('나 수준')}${th('다 수준')}</tr>` +
    one('도입\n(5´)', b.intro||{}) + devRows + one('정리\n(5´)', b.close||{})
  );

  const ev = (e.evaluation||[]).map(x =>
    `<tr>${lbl(x.domain)}${td(x.method,'text-align:center')}${td(x.high)}${td(x.mid)}${td(x.low)}</tr>`).join('');
  h += tbl(
    `<colgroup><col width="12%"><col width="13%"><col width="25%"><col width="25%"><col width="25%"></colgroup>` +
    cap('평 가 계 획', 5) +
    `<tr>${th('평 가 항 목')}${th('평 가 방 법')}${th('잘 함')}${th('보 통')}${th('노 력 요 함')}</tr>` + ev
  );

  const rf = (e.reflection||[]).map(q => `<tr>${td('○ '+q)}${td(' ')}</tr>`).join('');
  h += tbl(
    `<colgroup><col width="55%"><col width="45%"></colgroup>` +
    cap('수 업 성 찰 나 눔', 2) +
    `<tr>${th('수업 나눔 질문')}${th('협의 내용')}</tr>` + rf
  );

  h += '</div>';
  document.getElementById('previewPanel').innerHTML = h;
}

/* ── 7. 한글로 복사 ────────────────────────────────────── */
async function copyToHwp(){
  const panel = document.getElementById('previewPanel');
  if(!DOC){ showToast('먼저 “과정안 바로 생성”을 눌러 주세요.'); return; }
  const html = `<html><head><meta charset="utf-8"></head><body>${panel.innerHTML}</body></html>`;
  try{
    await navigator.clipboard.write([ new ClipboardItem({
      "text/html":  new Blob([html], {type:"text/html"}),
      "text/plain": new Blob([panel.innerText], {type:"text/plain"})
    })]);
    showToast('복사했습니다. 한글에서 Ctrl+V 로 붙여넣으세요.');
  }catch(err){
    showToast('복사 실패 — 미리보기를 드래그해 직접 복사해 주세요.');
  }
}

window.generateDocument = generateDocument;
window.copyToHwp = copyToHwp;
window.__tidyPlan__ = tidy;
window.__tidyStudents__ = tidyStudents;
window.__renderDoc__ = d => { DOC = d; renderDoc(d); };   // 붙여넣기 경로 미리보기     // 붙여넣기 경로(paste.js)에서도 같은 후처리를 쓰도록 공개

})();
