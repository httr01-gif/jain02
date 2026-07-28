/* ═══════════════════════════════════════════════════════════
   공개수업 지도안 프롬프트 생성기 v3.0 패치
   ───────────────────────────────────────────────────────────
   사용법: 기존 생성기 HTML의 </body> 바로 앞에
           <script> … 이 파일 내용 … </script> 를 붙여넣으세요.
   기존 코드는 한 줄도 지우지 않습니다. 버튼 2개만 추가됩니다.
   ═══════════════════════════════════════════════════════════ */
(function(){

const MODEL = "claude-sonnet-4-6";

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

/* ── 2. 생성 요청 (JSON만 수신) ─────────────────────────
   배포용: 자기 서버(/api/generate)를 거쳐 키를 숨깁니다.
   ※ 클로드 대화창 안에서 시험할 때만 아래 ENDPOINT 를
     "https://api.anthropic.com/v1/messages" 로 바꾸고
     body 를 {model, max_tokens, messages} 형태로 두세요.        */
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

  /* ① 그대로  ② 줄바꿈 정리  ③ 잘린 것 복구  ④ 둘 다 */
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
  /* 여기까지 왔으면 원인을 눈으로 봐야 한다. 원문을 남기고 앞부분을 보여준다. */
  window.__LASTRAW__ = txt;
  const head = txt.replace(/\s+/g, ' ').slice(0, 160);
  const cut  = j.stop === 'max_tokens' ? ' 길이제한' : '';
  throw new Error(`[${step}]${cut} 해석 실패 · 응답 앞부분 → ${head}`);
}

/* 문자열 안에 들어간 진짜 줄바꿈·탭을 \\n \\t 로 바꾼다.
   모델이 여러 줄 내용을 넣을 때 가장 흔히 깨지는 지점이다. */
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

/* 문자열·배열·객체가 열린 채로 끝난 JSON 을 닫아 준다 */
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
  let head = inStr && lastSafe > 0 ? t.slice(0, lastSafe) : t;   // 문자열 도중이면 직전 항목까지
  if(inStr && lastSafe <= 0) return null;
  head = head.replace(/[,\s]+$/, '');
  return head + stack.reverse().join('');
}

/* ── 3. 공통 컨텍스트 (기존 함수 그대로 재사용) ─────────── */
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
괄호는 절대 쓰지 않는다. ( ) 「 」 [ ] 모두 금지이며 "교사 검토 필요" 같은 덧붙임 표시도 넣지 않는다.`;

/* ── 4. 3분할 프롬프트 ─────────────────────────────────── */
const P1 = c => `${c}

위 수업의 (1) 수업설계 의도, (2) 생성형 AI 활용 구상, (3) 해당 핵심역량을 작성하라.
- intent: 4~6문장. 단원 속 위치, 학생들의 이질적 수준, 그래서 왜 이 자료가 필요한지, IEP·개별화 지원과의 연결. 마지막에 AI 생성 자료를 교사가 검토·재구성했음을 명시.
- aiPlan: 3~4문장. 어떤 자료를 어떻게 제작하고 교사가 어떻게 검토·재구성하는지.
- competency: 이 수업에 해당하는 역량명만 배열로. (자기관리 / 지식정보처리 / 창의적 사고 / 심미적 감성 / 협력적 소통 / 공동체)

{"intent":"...","aiPlan":"...","competency":["..."]}${RULE}`;

const P2A = c => `${c}

교수·학습 과정안의 도입(5분)과 정리(5분)만 작성하라.

칸 구분 규칙:
- teacher(교사의 활동): 교사가 제시·발문·시범·촉진하는 내용. 모든 항목을 "~하기" 로 끝낸다. "▣"로 활동을 묶고 그 아래 " - "로 세부 항목.
- material: 자료는 ◉, 유의점은 ※ 로 시작.
- process(학습 과정)는 줄바꿈 \\n 으로 구분한다.

{"intro":{"process":"수업 준비\\n동기 유발\\n학습목표 확인\\n학습활동 안내","teacher":"...","material":"..."},
"close":{"process":"정리 및 평가\\n차시 예고\\n인사·마무리","teacher":"...","material":"..."}}${RULE}`;

const P2B = c => `${c}

교수·학습 과정안의 전개(30분)만 작성하라. 활동은 정확히 2개.

칸 구분 규칙(반드시 지킬 것):
- teacher(교사의 활동): 교사가 제시·발문·시범·촉진하는 내용. 모든 항목을 "~하기" 로 끝낸다. "▣"로 묶고 그 아래 " - "로 세부 항목.
- levelA / levelB / levelC(학생의 활동): 학생의 관찰 가능한 수행 행동만. 모든 문장을 "~한다." 로 끝낸다. 교사 행동을 여기 쓰지 않는다.
- 가·나·다 수준의 차이가 촉진 위계(독립 수행 → 언어·시각 촉진 → 신체 촉진)로 분명히 드러나게 한다.
- material: 자료는 ◉, 유의점은 ※ 로 시작. 안전 관련 유의점을 반드시 1개 포함.
- 각 칸은 3줄을 넘기지 않도록 간결하게 쓴다.

{"develop":[{"process":"활동1 ...","teacher":"...","levelA":"...","levelB":"...","levelC":"...","material":"..."},
{"process":"활동2 ...","teacher":"...","levelA":"...","levelB":"...","levelC":"...","material":"..."}]}${RULE}`;

const P3 = c => `${c}

(1) 학생별 "본 차시 개별적 지원 방안"과 "생성형 AI 활용 자료 유형"을 학생 특성·IEP 목표에 맞춰 각각 2~3줄("-"로 시작)로 작성.
    students 배열의 label 은 위 학생 정보의 라벨(A, B, C …)을 그대로 쓴다.
(2) 평가계획을 지식·이해 / 과정·기능 / 가치·태도 3영역으로 작성. high·mid·low 는 촉진 횟수나 수행 단계 수로 구분되는 관찰 가능한 문장.
(3) 수업 나눔 질문 3개. 참관자가 협의회에서 논의할 만한 것으로.

{"students":[{"label":"A","support":"...","aiMaterial":"..."}],
"evaluation":[{"domain":"지식·이해","method":"관찰평가\\n수행평가","high":"...","mid":"...","low":"..."}],
"reflection":["...","...","..."]}${RULE}`;

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
    const b = { intro: b1.intro, close: b1.close, develop: b2.develop || [] };
    DOC = { a, b, e, d: c.d, tools: c.tools };
    window.__DOC__ = DOC;          // hwpx 모듈이 읽어 간다
    renderDoc(DOC);
    showToast('과정안이 생성되었습니다. 한글로 복사해 보세요.');
  }catch(err){
    panel.innerHTML = `<div class="empty"><div class="big">⚠️</div><b>생성 실패: ${escapeHtml(err.message)}</b>
      <span>외부망이 차단된 환경일 수 있습니다. 이 경우 <b>📝 프롬프트</b> 탭의 기존 방식을 사용하세요.</span></div>`;
  }
  btn.disabled = false;
}

/* ── 6. 서식대로 렌더링 ────────────────────────────────── */
function renderDoc({a, b, e, d, tools}){
  const B = '1px solid #000';
  const td = (t, s='') => `<td style="border:${B};padding:5px 6px;vertical-align:top;white-space:pre-wrap;${s}">${escapeHtml(t||'')}</td>`;
  const th = (t, s='', at='') => `<th${at} style="border:${B};background:#eef2f7;padding:6px;text-align:center;vertical-align:middle;font-weight:700;white-space:pre-wrap;${s}">${escapeHtml(t)}</th>`;
  const lbl = t => td(t, 'background:#f4f6f9;text-align:center;font-weight:700;vertical-align:middle');
  const tbl = r => `<table style="width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.6;margin-bottom:10px;table-layout:fixed">${r}</table>`;
  const cap = (t, n) => `<tr><td colspan="${n}" style="border:${B};background:#e4e9f0;text-align:center;font-weight:800;letter-spacing:.25em;padding:6px">${escapeHtml(t)}</td></tr>`;

  const C15 = ["자기관리","지식정보처리","창의적 사고","심미적 감성","의사소통","공동체"];
  const C22 = ["자기관리","지식정보처리","창의적 사고","심미적 감성","협력적 소통","공동체"];
  const pick = a.competency || [];
  const is22 = d.curriculumVersion !== '2015';
  const box = (arr, on) => arr.map(x => (on && on.includes(x) ? "■ " : "□ ") + x + " 역량").join("　");

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

  /* 기본 정보 */
  h += tbl(
    `<colgroup><col width="11%"><col width="24%"><col width="10%"><col width="21%"><col width="13%"><col width="21%"></colgroup>` +
    `<tr>${lbl('일 시')}${td(fieldText(d.lessonDate),'text-align:center')}${lbl('대 상')}${td(fieldText(d.targetClass),'text-align:center')}${lbl('지도교사')}${td(d.teacherName)}</tr>` +
    `<tr>${lbl('단 원\n(제재)')}${td(fieldText(d.unit),'text-align:center')}${lbl('장 소')}${td(fieldText(d.place),'text-align:center')}${lbl('수업 지원')}${td(d.supportStaff)}</tr>` +
    `<tr>${lbl('차 시')}${td(fieldText(d.lessonNo),'text-align:center')}${lbl('수업유형')}${td(fieldText(d.lessonType),'')}${lbl('수업 형태')}${td(arrText(d.lessonForms))}</tr>` +
    `<tr>${lbl('학습목표')}<td colspan="5" style="border:${B};padding:5px 6px;white-space:pre-wrap">${escapeHtml(fieldText(d.lessonGoal))}</td></tr>`
  );

  /* 성취기준 · 역량 · 설계 의도 */
  h += tbl(
    `<colgroup><col width="13%"><col width="17%"><col width="70%"></colgroup>` +
    `<tr>${lbl('교육과정\n성취기준')}<td colspan="2" style="border:${B};padding:5px 6px">${escapeHtml((d.achCode? d.achCode+' ':'') + fieldText(d.achStd))}</td></tr>` +
    `<tr><td rowspan="2" style="border:${B};background:#f4f6f9;text-align:center;font-weight:700;vertical-align:middle">핵심역량</td>` +
      `${lbl('2015 개정\n특수교육 교육과정')}${td(box(C15, is22?[]:pick),'font-size:11px')}</tr>` +
    `<tr>${lbl('2022 개정\n특수교육 교육과정')}${td(box(C22, is22?pick:[]),'font-size:11px')}</tr>` +
    `<tr>${lbl('수업설계 의도')}<td colspan="2" style="border:${B};padding:5px 6px;white-space:pre-wrap">${escapeHtml(a.intent||'')}</td></tr>`
  );

  /* 학생별 개별 지원 */
  const sup = {}; (e.students||[]).forEach(s => sup[s.label] = s);
  const rows = (d.studentPlans||[]).map(p => {
    const x = sup[p.label] || {};
    return `<tr>${lbl(p.label)}${td(fieldText(p.char))}${td(fieldText(p.goal))}${td(x.support||'')}${td(x.aiMaterial||'')}</tr>`;
  }).join('') || `<tr><td colspan="5" style="border:${B};padding:14px;text-align:center;color:#888">학생 정보 미입력</td></tr>`;

  h += tbl(
    `<colgroup><col width="8%"><col width="22%"><col width="22%"><col width="26%"><col width="22%"></colgroup>` +
    cap('대상 학생 특성 및 개별적 지원 계획', 5) +
    `<tr>${th('학생')}${th('학생 특성')}${th('IEP 관련 목표')}${th('본 차시 개별적 지원 방안')}${th('생성형 AI 활용 자료 유형')}</tr>` + rows
  );

  /* AI 활용 계획 */
  h += tbl(
    `<colgroup><col width="16%"><col width="42%"><col width="42%"></colgroup>` +
    cap('생성형 인공지능 활용 계획', 3) +
    `<tr>${lbl('사용 도구\n(교사용)')}<td colspan="2" style="border:${B};padding:5px 6px">${
      AITOOLS.map(t=>(d.aiTools.includes(t)?'■ ':'□ ')+t).join('　')}${d.customAiTool?'　('+escapeHtml(d.customAiTool)+')':''}</td></tr>` +
    `<tr>${lbl('생성형 AI\n활용 구상')}<td colspan="2" style="border:${B};padding:5px 6px;white-space:pre-wrap">${escapeHtml(a.aiPlan||'')}</td></tr>` +
    `<tr>${lbl('생성형 AI\n윤리 준수 여부')}${td(ETHICS.map(r=>'☑ '+r[0]).join('\n'))}${td(ETHICS.map(r=>'☑ '+r[1]).join('\n'))}</tr>`
  );

  /* 교수·학습 과정안 */
  const stage = (name, time, s) =>
    `<tr>${lbl(name + (time?'\n('+time+')':''))}${lbl(s.process||'')}${td(s.teacher||'')}${td(s.levelA||'')}${td(s.levelB||'')}${td(s.levelC||'')}${td(s.material||'')}</tr>`;

  const dev = b.develop || [];
  let devRows = dev.map((s,i) =>
    `<tr>${i===0 ? `<td rowspan="${dev.length}" style="border:${B};background:#f4f6f9;text-align:center;font-weight:700;vertical-align:middle;white-space:pre-wrap">전개\n(30´)</td>` : ''}` +
    `${lbl(s.process||'')}${td(s.teacher||'')}${td(s.levelA||'')}${td(s.levelB||'')}${td(s.levelC||'')}${td(s.material||'')}</tr>`
  ).join('');

  h += tbl(
    `<colgroup><col width="8%"><col width="12%"><col width="24%"><col width="14%"><col width="14%"><col width="14%"><col width="14%"></colgroup>` +
    `<tr>${th('학습\n단계','',' rowspan="2"')}${th('학습\n과정','',' rowspan="2"')}${th('교사의 활동\n(생성형 AI 활용)','',' rowspan="2"')}${th('학생의 활동','',' colspan="3"')}${th('자료(◉) 및\n유의점(※)','',' rowspan="2"')}</tr>` +
    `<tr>${th('가 수준')}${th('나 수준')}${th('다 수준')}</tr>` +
    stage('도입','5´', b.intro||{}) + devRows + stage('정리','5´', b.close||{})
  );

  /* 평가 계획 */
  const ev = (e.evaluation||[]).map(x =>
    `<tr>${lbl(x.domain)}${td(x.method,'text-align:center')}${td(x.high)}${td(x.mid)}${td(x.low)}</tr>`).join('');
  h += tbl(
    `<colgroup><col width="12%"><col width="13%"><col width="25%"><col width="25%"><col width="25%"></colgroup>` +
    cap('평 가 계 획', 5) +
    `<tr>${th('평 가 항 목')}${th('평 가 방 법')}${th('잘 함')}${th('보 통')}${th('노 력 요 함')}</tr>` + ev
  );

  /* 수업 성찰 나눔 */
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

})();
