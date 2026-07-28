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
function slots(n){
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
    list.push([`전개${k}-교사`, `b.develop.${i}.teacher`]);
    list.push([`전개${k}-가`,   `b.develop.${i}.levelA`]);
    list.push([`전개${k}-나`,   `b.develop.${i}.levelB`]);
    list.push([`전개${k}-다`,   `b.develop.${i}.levelC`]);
    list.push([`전개${k}-자료`, `b.develop.${i}.material`]);
  }
  list.push(['정리-과정', 'b.close.process']);
  list.push(['정리-교사', 'b.close.teacher']);
  list.push(['정리-자료', 'b.close.material']);
  return list;
}
const devCount = () => {
  const el = document.getElementById('devCount');
  return el ? (parseInt(el.value,10) || 2) : 2;
};
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
· 괄호를 절대 쓰지 않습니다. ( ) 「 」 [ ] 모두 금지입니다.
  "교사 검토 필요", "해당 없음" 같은 덧붙임 표시도 넣지 않습니다.
  보충 설명이 필요하면 쉼표로 잇거나 문장을 나눕니다.
· 교사 칸은 "▣"로 활동을 묶고 그 아래 " - "로 세부 항목. 모든 항목을 "~하기" 로 끝냅니다.
· 학생 칸은 모든 줄을 "- " 로 시작합니다. 관찰 가능한 수행 행동만 쓰고 "~한다." 로 끝냅니다.
  한 칸에 2줄, 가·나·다의 차이가 촉진 위계인 독립 수행, 언어·시각 촉진, 신체 촉진으로 드러나게 합니다.
· 자료 칸은 매우 짧게 씁니다. 칸이 좁아 분량이 넘치면 표가 밀립니다.
  ◉ 로 시작하는 자료 2줄, ※ 로 시작하는 유의점 2줄, 모두 합해 4줄을 넘기지 않습니다.
  각 줄은 20자 안팎의 명사구로 끝냅니다. 문장으로 풀어 쓰지 않습니다.
  ※ 중 하나는 안전에 관한 것으로 합니다.
  보기 - ◉ 드립백 필터, 원두 ◉ 순서 그림카드 ※ 뜨거운 물 취급 주의 ※ 촉진은 점차 줄이기
· 전개 활동은 정확히 ${devCount()}개입니다. 라벨에 있는 만큼만 쓰고 임의로 늘리거나 줄이지 않습니다.
· 과정 칸은 짧은 낱말을 줄바꿈으로 나열합니다.
· 평가의 잘함·보통·노력요함은 촉진 횟수나 수행 단계 수로 구분되는 문장으로 씁니다.

${slots(devCount()).map(([l]) => `[[${l}]]`).join('\n')}
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
  /* 붙여넣은 라벨에서 전개 활동 수를 직접 읽는다 */
  let n = 0;
  Object.keys(map).forEach(k => {
    const m = k.match(/^전개(\d+)-/);
    if(m) n = Math.max(n, parseInt(m[1],10));
  });
  if(!n) n = devCount();

  const doc = { a:{}, b:{ intro:{}, close:{}, develop:[] }, e:{ students:[], evaluation:[], reflection:[] }, d, tools };
  for(let i=0;i<n;i++) doc.b.develop.push({});

  slots(n).forEach(([label, path]) => {
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

  const missing = slots(n).filter(([l]) => !map[l]).map(([l]) => l);
  return { doc, missing, n };
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
      <label style="align-self:center;font-size:12.5px;color:#556070">전개 활동
        <select id="devCount" style="margin-left:5px;padding:6px 8px;border:1.5px solid #d0dae8;border-radius:7px">
          <option>2</option><option>3</option><option>4</option>
        </select> 개</label>
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
      const { doc, missing, n } = buildDoc(raw);
      window.__DOC__ = doc;
      if(typeof renderDoc === 'function'){ try{ renderDoc(doc); }catch(_){ } }
      if(typeof window.exportHwpx === 'function'){
        window.exportHwpx();
        msg(`전개 활동 ${n}개로 변환했습니다.` + (missing.length ? ` 비어 있는 칸: ${missing.join(', ')}` : ''));
      } else {
        msg('hwpx.js 가 로드되지 않았습니다. 스크립트 순서를 확인해 주세요.');
      }
    }catch(err){ msg('실패: ' + err.message); }
  };

  function msg(t){ document.getElementById('pasteMsg').textContent = t; }
}

})();
