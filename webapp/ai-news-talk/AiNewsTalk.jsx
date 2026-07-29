import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ══════════════════════════════════════════════════════════════
   AI 글로벌 뉴스 톡 v7.0
   ─────────────────────────────────────────────────────────────
   ① 매일 정해진 시각 자동 새로고침 (요일 + 다중 시각 스케줄)
   ② 주기 자동 새로고침 (간격 선택)
   ③ 6개 코너 : 뉴스톡 / 핫AI / 경험하기 / 주요지식 / 체크시사 / 나노마음건강
══════════════════════════════════════════════════════════════ */

/* 네트워크 사용 가능 여부.
   아티팩트 빌드는 이 값을 false로 바꾼다 — 게시 환경의 CSP가 외부 호스트를
   전부 차단하는데, 차단 로그는 브라우저가 직접 출력해 try/catch로 못 막는다.
   요청을 아예 보내지 않아야 콘솔이 깨끗해진다. false면 뉴스는 내장 데모로,
   동기화는 오프라인으로 즉시 떨어진다(두 경로 모두 기존 폴백을 그대로 탄다). */
const NET = true;

/* iframe에 임베드되어 실행되는지 여부. 아티팩트 빌드는 이 값을 true로 바꾼다.
   호스트는 자식이 보고한 scrollHeight에 맞춰 iframe 높이를 조정하는데, 이때
   콘텐츠가 100vh처럼 뷰포트 높이에 의존하면 되먹임 루프가 된다 —
   높이가 커지면 100vh도 커지고, 그래서 또 커진다. 수렴하지 않아 화면이
   영원히 자라고 로딩이 끝나지 않는다. 임베드 시에는 뷰포트 기준 높이를 쓰지
   않고 콘텐츠 높이에 맡긴다(배경은 호스트 CSS가 칠한다). */
const EMBED = false;

/* ══════════════════════════════════════════════════════════════
   글로벌 CSS
══════════════════════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #eef4fa; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #eef4fa; }
  ::-webkit-scrollbar-thumb { background: #c6d7e6; border-radius: 2px; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideDown { from{opacity:0;max-height:0;transform:translateY(-4px)} to{opacity:1;max-height:900px;transform:translateY(0)} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes bar       { from{width:0} to{width:100%} }
  @keyframes glow      { 0%,100%{box-shadow:0 0 6px #005c4a40} 50%{box-shadow:0 0 14px #005c4a70} }
  @keyframes pulse     { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:.75} }
  @keyframes flame     { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-2px) scale(1.12)} }
  @keyframes pop       { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }

  .item { animation:fadeUp .28s ease both; border-bottom:1px solid #dbe6f0; }
  .item:last-child { border-bottom:none; }
  .item:hover { background:rgba(0,92,74,.016)!important; }

  .card { animation:fadeUp .28s ease both; }
  .card:hover { border-color:rgba(0,92,74,.28)!important; }

  .cat-tab  { transition:color .15s,border-color .15s; cursor:pointer; }
  .cat-tab:hover { color:#19527a!important; }

  .nav-tab { transition:all .16s; cursor:pointer; }
  .nav-tab:hover { color:#0b5a54!important; }

  .cat-badge { cursor:pointer; transition:filter .15s; }
  .cat-badge:hover { filter:brightness(1.25); }

  .live-btn { transition:all .2s; cursor:pointer; }
  .live-btn:hover:not(:disabled) { filter:brightness(1.18); }

  .auto-btn { transition:all .2s; cursor:pointer; }
  .auto-btn:hover { opacity:.82; }

  .toggle-btn { transition:all .18s; cursor:pointer; }
  .toggle-btn:hover { filter:brightness(1.2); }

  .src-link { transition:color .15s; }
  .src-link:hover { color:#174b85!important; }

  .title-link { text-decoration:none; color:inherit; }
  .title-link:hover { color:#174b85!important; }

  .ext-btn { transition:all .18s; cursor:pointer; text-decoration:none; }
  .ext-btn:hover { filter:brightness(1.2); }

  .chip { transition:all .15s; cursor:pointer; }
  .chip:hover { filter:brightness(1.25); }

  .panel { animation:slideDown .22s ease forwards; overflow:hidden; }
  .pop   { animation:pop .2s ease both; }

  .sol-tag { display:inline-block; padding:1px 6px; border-radius:3px;
             font-size:9.5px; font-weight:800; letter-spacing:.6px; }

  .time-input {
    background:#ffffff; border:1px solid #c6d7e6; color:#005c4a;
    border-radius:4px; padding:3px 6px; font-size:11.5px; font-weight:700;
    color-scheme:dark; outline:none;
  }
  .time-input:focus { border-color:rgba(0,92,74,.5); }

  .breath-ring { transition: transform 3.6s cubic-bezier(.4,0,.2,1), background .8s, box-shadow .8s; }
`;

/* ══════════════════════════════════════════════════════════════
   토큰
══════════════════════════════════════════════════════════════ */
const KR   = "'Noto Sans KR','Apple SD Gothic Neo',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CATS = ["전체","AI 모델","AI 에이전트","AI 인프라","AI 비즈니스","AI 규제"];

const CAT = {
  "AI 모델":    {c:"#174b85",bg:"rgba(23,75,133,.12)",  bd:"rgba(23,75,133,.3)"},
  "AI 에이전트":{c:"#5a1fb4",bg:"rgba(90,31,180,.12)", bd:"rgba(90,31,180,.3)"},
  "AI 인프라":  {c:"#0b5a54",bg:"rgba(11,90,84,.12)",  bd:"rgba(11,90,84,.3)"},
  "AI 비즈니스":{c:"#7a4405",bg:"rgba(122,68,5,.12)",  bd:"rgba(122,68,5,.3)"},
  "AI 규제":    {c:"#9e2a1f",bg:"rgba(158,42,31,.12)", bd:"rgba(158,42,31,.3)"},
};
const SOL = {
  A10:      {bg:"rgba(23,75,133,.14)",  bd:"rgba(23,75,133,.42)",  c:"#174b85"},
  WEHAGO:   {bg:"rgba(90,31,180,.14)", bd:"rgba(90,31,180,.42)", c:"#5a1fb4"},
  OmniEsol: {bg:"rgba(11,90,84,.14)",  bd:"rgba(11,90,84,.42)",  c:"#0b5a54"},
  FoEX:     {bg:"rgba(122,68,5,.14)",  bd:"rgba(122,68,5,.42)",  c:"#6d4d05"},
  NSM10:    {bg:"rgba(15,85,39,.14)",  bd:"rgba(15,85,39,.42)",  c:"#0f5527"},
  iCUBE:    {bg:"rgba(157,16,73,.14)", bd:"rgba(157,16,73,.42)", c:"#9d1049"},
};
const IMP = {
  high:  {label:"높음",c:"#9e2a1f",bg:"rgba(158,42,31,.1)",bd:"rgba(158,42,31,.32)",w:3},
  medium:{label:"중간",c:"#7a4405",bg:"rgba(122,68,5,.1)", bd:"rgba(122,68,5,.32)",w:2},
  low:   {label:"낮음",c:"#0f5527",bg:"rgba(15,85,39,.1)", bd:"rgba(15,85,39,.32)",w:1},
};
const PRI = {
  "즉시검토":  {c:"#9e2a1f",w:4},
  "단기검토":  {c:"#7a4405",w:3},
  "중장기검토":{c:"#174b85",w:2},
  "모니터링":  {c:"#475569",w:1},
};

const STEPS = [
  {e:"🔍",t:"뉴스 수집 중"},
  {e:"🤖",t:"AI 분석 중"},
  {e:"📊",t:"전략 정리 중"},
  {e:"✨",t:"완성 중"},
];

/* 메인 코너 탭 */
const NAVS = [
  {k:"news",  icon:"📰", label:"뉴스톡",       desc:"글로벌 AI 뉴스 + DZ 전략분석"},
  {k:"hot",   icon:"🔥", label:"핫AI코너",     desc:"지금 가장 뜨거운 AI 이슈 랭킹"},
  {k:"exp",   icon:"🧪", label:"경험하기",     desc:"오늘 바로 따라하는 AI 체험"},
  {k:"know",  icon:"🎓", label:"주요지식",     desc:"나에게 꼭 필요한 핵심 지식"},
  {k:"quiz",  icon:"✅", label:"체크시사",     desc:"AI 시사 체크 퀴즈"},
  {k:"mind",  icon:"🌿", label:"나노마음건강", desc:"60초 마이크로 마음 케어"},
];

const DAYS = ["일","월","화","수","목","금","토"];
const INTERVALS = [
  {v:30,   t:"30초"},
  {v:60,   t:"1분"},
  {v:300,  t:"5분"},
  {v:600,  t:"10분"},
  {v:1800, t:"30분"},
];

/* ══════════════════════════════════════════════════════════════
   폴백 뉴스
══════════════════════════════════════════════════════════════ */
const DEMO = [
  {id:1,title:"OpenAI, GPT-5 Turbo 공개 — 추론 3배·비용 40% 절감",source:"openai.com",
   summary:"OpenAI가 GPT-4o 대비 추론 속도 3배 개선·비용 40% 절감한 GPT-5 Turbo를 발표했다. 구조화 데이터 처리와 함수 호출 정확도가 대폭 향상됐다.",
   points:142,time:"1시간 전",category:"AI 모델",
   analysis:{solutions:["A10","OmniEsol"],importance:"high",direction:"A10 ERP 자연어 입력 인터페이스 및 OmniEsol 챗봇 엔진 업그레이드에 즉시 적용 가능. API 비용 절감으로 AI 기능 전사 확대 타당성이 크게 증가했다.",priority:"즉시검토"}},
  {id:2,title:"Microsoft Copilot, Dynamics 365 전 모듈 네이티브 통합 발표",source:"microsoft.com",
   summary:"Dynamics 365 전 모듈에 Copilot AI 네이티브 통합이 발표됐다. 자연어 분개 입력·자동 보고서 생성 기능이 2026 Q3 출시 예정이다.",
   points:98,time:"3시간 전",category:"AI 비즈니스",
   analysis:{solutions:["A10","WEHAGO"],importance:"high",direction:"A10 ERP AI 어시스턴트 기능 로드맵 수립 시 경쟁사 동향으로 필수 참조. WEHAGO AI 자동화 기능 선제 강화 필요하다.",priority:"즉시검토"}},
  {id:3,title:"Anthropic Claude 4 MCP 파트너 500개 돌파 — ERP 연동 템플릿 공개",source:"anthropic.com",
   summary:"Anthropic이 MCP 기반 기업 연동 파트너를 500개로 확장했다. ERP·CRM·회계 시스템 직접 연동 템플릿도 함께 공개됐다.",
   points:87,time:"5시간 전",category:"AI 에이전트",
   analysis:{solutions:["A10","NSM10","OmniEsol"],importance:"high",direction:"A10 ERP MCP 서버 구축 시 외부 연동 비용 대폭 절감 가능. NSM10 프로젝트 관리 AI 에이전트화 우선 검토를 권장한다.",priority:"즉시검토"}},
  {id:4,title:"EU AI Act 기업 세부 가이드라인 확정 — 2026년 8월 전면 시행",source:"ec.europa.eu",
   summary:"EU가 AI Act 기업 준수 세부 지침을 확정했다. 고위험 AI 시스템 분류 기준과 데이터 거버넌스 요건이 명확화됐다.",
   points:73,time:"6시간 전",category:"AI 규제",
   analysis:{solutions:["A10","WEHAGO"],importance:"medium",direction:"해외 진출 고객사 AI 컴플라이언스 컨설팅 신규 라인업화 검토. WEHAGO 데이터 거버넌스 모듈 강화 기회로 활용 가능하다.",priority:"단기검토"}},
  {id:5,title:"AWS, 기업용 RAG 파이프라인 완전 관리형 서비스 출시",source:"aws.amazon.com",
   summary:"AWS가 벡터DB·임베딩·검색 파이프라인을 통합한 완전 관리형 RAG 서비스를 출시했다. 사내 문서 기반 AI Q&A 구축 기간이 3개월에서 2주로 단축된다.",
   points:65,time:"8시간 전",category:"AI 인프라",
   analysis:{solutions:["FoEX","NSM10"],importance:"medium",direction:"FoEX 교육 콘텐츠 기반 AI Q&A 및 NSM10 지식 베이스 구축에 활용 가능. 내부 구축 vs SaaS 비교 검토가 필요하다.",priority:"단기검토"}},
  {id:6,title:"구글 Gemini 2.5 Pro 기업 API 50% 인하 — 멀티모달 대중화",source:"cloud.google.com",
   summary:"구글이 Gemini 2.5 Pro 기업용 API 가격을 50% 인하했다. 100만 토큰 컨텍스트 윈도우를 저비용으로 활용할 수 있게 됐다.",
   points:54,time:"10시간 전",category:"AI 모델",
   analysis:{solutions:["WEHAGO","OmniEsol"],importance:"low",direction:"WEHAGO 문서 자동 처리·OmniEsol 로그 분석에 비용 효율적 적용 검토. 현행 Claude API와의 멀티 벤더 전략 수립이 필요하다.",priority:"모니터링"}},
  {id:7,title:"Meta, Llama 4 Scout 오픈소스 공개 — 온프레미스 기업 배포 지원",source:"ai.meta.com",
   summary:"Meta가 기업 온프레미스 배포에 최적화된 Llama 4 Scout를 오픈소스로 공개했다. 상업적 이용이 허용되며 fine-tuning 가이드도 함께 제공됐다.",
   points:49,time:"12시간 전",category:"AI 모델",
   analysis:{solutions:["A10","iCUBE"],importance:"medium",direction:"더존 고객사 프라이빗 클라우드 환경에서 데이터 유출 없이 AI 기능 구현 가능. A10 ERP 온프레미스 AI 모델 통합 POC 검토를 권장한다.",priority:"단기검토"}},
  {id:8,title:"Salesforce, Agentforce 2.0 발표 — ERP 연동 자율 업무 처리",source:"salesforce.com",
   summary:"Salesforce가 ERP 시스템과 직접 연동해 자율적으로 업무를 처리하는 Agentforce 2.0을 발표했다. 주문·청구·재고 프로세스 자동화가 핵심이다.",
   points:43,time:"14시간 전",category:"AI 에이전트",
   analysis:{solutions:["A10","WEHAGO","NSM10"],importance:"high",direction:"ERP AI 에이전트 시장 경쟁 직접 압박 신호. A10 기반 자율 업무 처리 에이전트 로드맵 조기 수립이 필요하다.",priority:"즉시검토"}},
];

/* ══════════════════════════════════════════════════════════════
   🔥 핫AI코너 — 급상승 키워드 (뉴스와 별개로 상시 노출)
══════════════════════════════════════════════════════════════ */
const HOT_KEYWORDS = [
  {k:"AI 에이전트",   d:"+312%", c:"#5a1fb4"},
  {k:"MCP 연동",      d:"+248%", c:"#005c4a"},
  {k:"온프레미스 LLM",d:"+186%", c:"#174b85"},
  {k:"AI 컴플라이언스",d:"+154%",c:"#9e2a1f"},
  {k:"RAG 관리형",    d:"+131%", c:"#0b5a54"},
  {k:"토큰 단가 인하", d:"+118%", c:"#7a4405"},
  {k:"업무 자동화",   d:"+97%",  c:"#84168e"},
  {k:"멀티모달 ERP",  d:"+84%",  c:"#025380"},
];

/* ══════════════════════════════════════════════════════════════
   🧪 경험하기 — 오늘 바로 따라하는 AI 체험 카드
══════════════════════════════════════════════════════════════ */
const EXPS = [
  {id:"e1",icon:"📊",title:"엑셀 원본 붙여넣고 3줄 요약 받기",tool:"Claude / ChatGPT",
   level:"입문",min:3,free:true,sol:["A10","WEHAGO"],
   goal:"월 마감 데이터를 붙여넣기만 하면 임원 보고용 3줄 요약이 나온다.",
   steps:["엑셀에서 표 영역을 그대로 복사한다","아래 프롬프트를 붙여넣고 그 아래에 표를 붙인다","숫자 근거가 포함됐는지 한 번 검증한다"],
   prompt:"아래는 우리 부서 월별 실적 표다. ① 핵심 3줄 요약 ② 전월 대비 가장 큰 변화 1건과 원인 가설 ③ 임원이 물어볼 질문 3개를 예상해서 답까지 달아라. 숫자는 반드시 표에서 인용하고, 표에 없는 값은 추정이라고 명시하라.",
   tip:"'표에 없는 값은 추정이라고 명시' 한 줄이 환각을 크게 줄인다."},
  {id:"e2",icon:"🧾",title:"회의록 → 실행 과제 자동 추출",tool:"Claude / Copilot",
   level:"입문",min:2,free:true,sol:["NSM10","WEHAGO"],
   goal:"흘러가는 회의 메모를 담당자·기한이 붙은 액션 아이템으로 바꾼다.",
   steps:["회의 메모를 그대로 복사한다","프롬프트 실행 후 표 형태로 받는다","담당자 미지정 항목만 직접 채운다"],
   prompt:"다음 회의 메모에서 실행 과제만 뽑아 표로 만들어라. 열은 [과제 / 담당자 / 기한 / 선행조건 / 리스크]. 담당자나 기한이 메모에 없으면 '미지정'으로 두고 절대 임의로 만들지 마라. 마지막에 '이번 주 안에 안 하면 지연되는 것' 을 따로 정리하라.",
   tip:"'임의로 만들지 마라'를 빼면 AI가 담당자를 지어낸다."},
  {id:"e3",icon:"🤖",title:"내 업무용 미니 에이전트 설계해보기",tool:"Claude Projects",
   level:"중급",min:8,free:true,sol:["A10","OmniEsol"],
   goal:"반복 업무 1개를 골라 지시문·입력·출력이 고정된 나만의 도우미를 만든다.",
   steps:["주 3회 이상 반복하는 업무를 1개 고른다","역할/입력/출력/금지사항 4단 구조로 지시문을 쓴다","실제 사례 3건으로 테스트하고 지시문을 고친다"],
   prompt:"너는 [업무명] 전담 어시스턴트다.\n[역할] 내가 주는 원자료를 정해진 양식으로 변환한다.\n[입력] 원자료 텍스트 또는 표\n[출력] ① 요약 3줄 ② 표 ③ 확인이 필요한 항목 목록\n[금지] 원자료에 없는 수치 생성, 추측을 사실처럼 쓰기\n준비됐으면 '입력을 주세요'만 답하라.",
   tip:"[금지] 항목이 품질의 80%를 결정한다. 실패할 때마다 여기에 한 줄씩 추가한다."},
  {id:"e4",icon:"🔍",title:"경쟁사 발표를 우리 관점으로 번역하기",tool:"Claude",
   level:"중급",min:5,free:true,sol:["A10","WEHAGO","NSM10"],
   goal:"경쟁사 보도자료를 '우리가 지금 무엇을 해야 하는가'로 바꾼다.",
   steps:["경쟁사 보도자료 원문을 붙여넣는다","우리 솔루션명을 명시해 관점을 고정한다","즉시/단기/중장기로 나뉜 결론만 취한다"],
   prompt:"아래는 경쟁사 발표 원문이다. 우리 회사 관점(ERP·그룹웨어·클라우드 사업)에서 ① 이 발표가 실제로 위협인 지점 ② 과장·마케팅 문구로 걸러야 할 지점 ③ 즉시/단기/중장기 대응안을 각각 2개씩 제시하라. 근거 없는 낙관은 쓰지 마라.",
   tip:"'과장으로 걸러야 할 지점'을 꼭 물어야 균형 잡힌 답이 나온다."},
  {id:"e5",icon:"🗂️",title:"사내 문서 RAG Q&A 30분 프로토타입",tool:"NotebookLM / Claude",
   level:"중급",min:30,free:true,sol:["FoEX","NSM10"],
   goal:"규정·매뉴얼 PDF를 올려 '문서에 근거한' 질의응답을 체험한다.",
   steps:["공개 가능한 사내 문서 5~10개를 준비한다","도구에 업로드하고 인덱싱을 기다린다","반드시 출처 표시를 켜고 오답률을 기록한다"],
   prompt:"업로드한 문서만 근거로 답하라. 문서에 없으면 '문서에 없음'이라고 답하고 추측하지 마라. 모든 문장 끝에 근거 문서명과 쪽수를 붙여라. 질문: [여기에 질문]",
   tip:"기밀 문서는 절대 외부 서비스에 올리지 않는다. 반드시 공개 가능 문서로만."},
  {id:"e6",icon:"✍️",title:"고객 메일 3종 톤 자동 생성",tool:"Copilot / Claude",
   level:"입문",min:2,free:true,sol:["WEHAGO","OmniEsol"],
   goal:"같은 내용을 정중형·간결형·설득형 3가지로 뽑아 상황에 맞춰 고른다.",
   steps:["전달할 핵심 사실 3가지를 적는다","3종 톤으로 동시에 생성한다","가장 가까운 안을 골라 손본다"],
   prompt:"다음 핵심 사실만 사용해 고객 안내 메일을 3가지 버전으로 써라. ①정중·격식 ②간결·실무 ③설득·제안형. 각 200자 이내. 사실에 없는 약속(일정 확정, 할인 등)은 절대 넣지 마라. 핵심 사실: [여기에 입력]",
   tip:"'사실에 없는 약속 금지'가 대외 리스크를 막는다."},
  {id:"e7",icon:"🧮",title:"수치 검산 이중 확인 습관 만들기",tool:"모든 LLM 공통",
   level:"필수",min:1,free:true,sol:["A10","NSM10"],
   goal:"AI가 낸 숫자를 그대로 쓰지 않는 최소 안전장치를 몸에 익힌다.",
   steps:["AI 답변을 받는다","같은 질문을 검산 프롬프트로 한 번 더 던진다","불일치가 나오면 원자료로 직접 확인한다"],
   prompt:"방금 네가 계산한 값을 다시 검산하라. ① 계산에 사용한 수식을 그대로 쓰고 ② 각 항의 출처를 표시하고 ③ 처음 답과 달라지면 어디서 틀렸는지 밝혀라. 확신도(상/중/하)도 표기하라.",
   tip:"보고서에 들어가는 숫자는 예외 없이 이 단계를 거친다."},
  {id:"e8",icon:"🛡️",title:"내 프롬프트 정보보안 셀프 점검",tool:"체크리스트",
   level:"필수",min:2,free:true,sol:["WEHAGO","iCUBE"],
   goal:"외부 AI에 넣어도 되는 정보와 안 되는 정보의 선을 스스로 긋는다.",
   steps:["최근 사용한 프롬프트 3건을 꺼내본다","고객사명·계약금액·개인정보 포함 여부를 확인한다","마스킹 규칙을 1줄로 만들어 고정한다"],
   prompt:"다음 텍스트에서 외부 유출 시 문제가 될 수 있는 항목(개인정보, 거래처명, 금액, 내부 코드)을 모두 찾아 [MASK-분류] 형태로 치환한 버전을 만들어라. 원문은 바꾸지 말고 치환본만 출력하라.",
   tip:"고객사명은 A사·B사로, 금액은 자릿수만 남기는 것이 기본 규칙."},
];
const LEVEL_C = {"입문":"#0f5527","중급":"#7a4405","필수":"#9e2a1f"};

/* ══════════════════════════════════════════════════════════════
   🎓 나에게 꼭 필요한 주요지식 — 역할별 3단계 깊이
══════════════════════════════════════════════════════════════ */
const ROLES = ["전체","기획","영업","개발","경영"];
const KNOWS = [
  {id:"k1",role:"기획",must:true,icon:"🧠",title:"컨텍스트 윈도우 — 기능 기획의 실질 한계선",
   tag:"모델 기초",sol:["A10","OmniEsol"],
   s30:"모델이 한 번에 읽을 수 있는 글자 수의 상한. 이 값이 기능 설계의 물리적 제약이 된다.",
   s3:"100만 토큰이면 A4 약 1,500쪽 분량이다. 하지만 넣을수록 비용과 지연이 함께 늘고, 중간 구간의 정보는 놓치기 쉽다(중간 소실 현상). 그래서 '전부 넣기'가 아니라 '검색해서 필요한 것만 넣기(RAG)'가 표준이 된다.",
   s10:"기획 시 확인할 3가지 — ① 1회 요청 평균 토큰 수 × 예상 호출 수 = 월 비용, ② 응답 지연 허용치(사용자는 3초 넘으면 이탈), ③ 컨텍스트에 넣는 사내 데이터의 보안 등급. ERP처럼 데이터가 방대한 도메인은 전량 주입이 불가능하므로, 화면·업무 단위로 컨텍스트를 좁히는 설계가 필수다.",
   kw:["토큰","RAG","중간 소실","단가 산정"]},
  {id:"k2",role:"기획",must:true,icon:"🔌",title:"MCP — AI가 우리 시스템에 접속하는 표준 규격",
   tag:"에이전트",sol:["A10","NSM10"],
   s30:"AI 모델과 외부 시스템을 연결하는 공통 규격. 연동 1건마다 새로 만들던 것을 한 번에 표준화한다.",
   s3:"기존에는 AI×시스템 조합마다 개별 커넥터가 필요해 N×M 개의 연동이 생겼다. MCP는 그 사이에 표준 계층을 둬서 N+M으로 줄인다. 우리 제품에 MCP 서버를 한 번 붙이면 이를 지원하는 모든 AI 도구가 곧바로 연결된다.",
   s10:"전략적 의미는 '연동 비용 절감'보다 '유통 채널 확보'에 가깝다. 우리 ERP가 MCP 서버를 제공하면 고객이 쓰는 AI 도구 안에서 우리 데이터가 소비된다. 반대로 제공하지 않으면 경쟁사 데이터만 흐른다. 검토 순서 — ① 외부 공개 가능한 읽기 API 정의 ② 권한·감사 로그 설계 ③ 쓰기 작업의 승인 절차 ④ 과금 모델.",
   kw:["표준 연동","N+M","권한 설계","유통 채널"]},
  {id:"k3",role:"영업",must:true,icon:"💬",title:"고객이 'AI 되나요?' 물을 때의 3단 답변 구조",
   tag:"고객 대응",sol:["A10","WEHAGO"],
   s30:"기능 나열 대신 ①업무 → ②절감 시간 → ③검증 방법 순으로 답하면 신뢰도가 올라간다.",
   s3:"고객의 진짜 질문은 '되나요'가 아니라 '내 업무가 실제로 편해지나요'다. 따라서 답변은 고객 업무 1개를 특정하고, 그 업무에서 줄어드는 시간을 숫자로 제시하고, 틀렸을 때 어떻게 확인하는지까지 말해야 한다. 마지막 항목이 빠지면 도입 심사에서 반드시 막힌다.",
   s10:"실전 스크립트 — '월마감 시 전표 분류에 3일 쓰신다고 하셨죠(①). AI 자동 분류로 초안까지 반나절, 검토 포함 1일 수준으로 줄어듭니다(②). 다만 자동 분류는 100%가 아니어서 신뢰도 낮은 건은 별도 큐로 빠지고 담당자가 확인합니다(③).' 과장하지 않는 ③이 오히려 계약을 앞당긴다.",
   kw:["업무 특정","정량 효과","검증 절차","리스크 고지"]},
  {id:"k4",role:"영업",must:false,icon:"⚖️",title:"AI 도입 계약에서 꼭 짚어야 할 4개 조항",
   tag:"계약·규제",sol:["A10","WEHAGO"],
   s30:"데이터 학습 사용 여부, 정확도 책임 범위, 로그 보관 기간, 모델 교체 시 통지 — 이 4개가 분쟁 지점이다.",
   s3:"고객 데이터가 모델 학습에 쓰이지 않는다는 조항은 이제 기본 요구사항이다. 정확도는 보증 대상이 아니라 '보조 도구'임을 명시해야 하며, 최종 판단 책임은 사용자에게 있다는 문구가 필요하다. 로그는 감사 대응을 위해 보관하되 기간을 명시한다.",
   s10:"EU AI Act 등 규제가 시행되면 고위험 분류(인사·신용평가 등) 여부에 따라 요구 문서가 달라진다. 해외 사업장을 둔 고객사는 사전 점검이 필요하며, 이는 컨설팅 매출 기회이기도 하다. 제안서에 '컴플라이언스 점검 항목표'를 첨부하면 차별화된다.",
   kw:["학습 배제","책임 범위","로그 보관","고위험 분류"]},
  {id:"k5",role:"개발",must:true,icon:"🗂️",title:"RAG — 환각을 줄이는 가장 현실적인 방법",
   tag:"아키텍처",sol:["FoEX","NSM10"],
   s30:"질문과 관련된 사내 문서를 먼저 검색해 근거로 함께 넣어주는 구조.",
   s3:"문서를 잘게 나눠(청킹) 벡터로 변환해 저장하고, 질문이 오면 유사한 조각을 찾아 프롬프트에 붙인다. 모델은 그 근거 안에서만 답하게 되므로 환각이 줄고 출처 표시가 가능해진다. 품질의 대부분은 모델이 아니라 청킹·검색 단계에서 결정된다.",
   s10:"실패 원인 톱3 — ① 청크가 너무 커서 노이즈가 섞임(권장 300~800자, 겹침 10~20%), ② 검색이 키워드만 보거나 벡터만 봄(하이브리드 권장), ③ 근거를 찾지 못했을 때 모델이 그냥 답해버림('근거 없으면 없다고 답하라'를 시스템 프롬프트에 고정). 관리형 서비스는 구축 기간을 크게 줄여주지만 청킹 전략은 여전히 직접 튜닝해야 한다.",
   kw:["청킹","벡터 검색","하이브리드","출처 표시"]},
  {id:"k6",role:"개발",must:false,icon:"🏠",title:"온프레미스 LLM — 언제 쓰는 게 맞나",
   tag:"인프라",sol:["A10","iCUBE"],
   s30:"데이터 반출이 불가능한 고객에게 쓰는 선택지. 성능보다 규제 대응이 목적이다.",
   s3:"오픈소스 모델을 고객 인프라 안에서 구동해 데이터가 외부로 나가지 않는다. 대신 GPU 비용, 모델 업데이트, 운영 인력이 모두 우리 몫이 된다. 소규모 모델은 최신 상용 모델 대비 품질 격차가 있으므로 적용 업무를 좁혀야 한다.",
   s10:"판단 기준 — 월 호출량이 매우 크고(단가 역전), 데이터 반출이 계약상 금지되며, 대상 업무가 정형화되어 작은 모델로도 충분한 경우에만 유리하다. 세 조건 중 둘 이하라면 상용 API + 마스킹이 총소유비용에서 낫다. POC 시에는 반드시 동일 데이터로 상용 API와 품질을 나란히 비교한 표를 남긴다.",
   kw:["데이터 반출","TCO","GPU","품질 격차"]},
  {id:"k7",role:"경영",must:true,icon:"📉",title:"AI 투자 회수를 설명하는 3개 지표",
   tag:"경영 판단",sol:["A10","NSM10"],
   s30:"절감 공수(시간), 처리 리드타임, 오류 재작업률 — 이 3개면 대부분의 투자 심의를 통과한다.",
   s3:"'AI를 도입했다'는 성과가 아니다. 도입 전후로 같은 업무를 몇 시간에, 며칠 만에, 몇 % 오류로 처리하는지를 비교해야 한다. 반드시 도입 전 기준값(베이스라인)을 먼저 측정해 둬야 하며, 이걸 놓치면 나중에 어떤 숫자도 증명할 수 없다.",
   s10:"측정 설계 순서 — ① 대상 업무 1~2개로 좁힌다 ② 4주간 베이스라인을 측정한다 ③ 파일럿 그룹과 대조 그룹을 나눈다 ④ 8주 후 3개 지표를 비교한다. 전사 확대는 이 표가 나온 뒤에 결정한다. 단가 인하 뉴스가 나올 때마다 재계산하면 확대 시점을 앞당길 수 있다.",
   kw:["베이스라인","리드타임","재작업률","파일럿"]},
  {id:"k8",role:"경영",must:false,icon:"🧭",title:"AI 거버넌스 최소 세트 — 3장이면 시작된다",
   tag:"내부 통제",sol:["WEHAGO","iCUBE"],
   s30:"허용 도구 목록, 데이터 반출 금지 항목, 검증 책임자 — 이 3장으로 최소 거버넌스가 성립한다.",
   s3:"완벽한 규정을 만들려다 아무 규정도 없는 상태가 가장 위험하다. 먼저 회사가 승인한 도구를 명시하고, 넣으면 안 되는 정보를 열거하고, AI 산출물을 최종 확인하는 사람을 정한다. 나머지는 사례가 쌓이면서 붙이면 된다.",
   s10:"운영 팁 — 위반 사례를 처벌 대상이 아니라 학습 사례로 공유하면 신고율이 올라가고 실제 위험은 내려간다. 분기 1회 사용 현황을 집계해 승인 도구 목록을 갱신하고, 고위험 업무(인사 평가, 채용, 신용 판단)는 별도 승인 절차를 둔다.",
   kw:["허용 도구","반출 금지","검증 책임","사례 공유"]},
  {id:"k9",role:"기획",must:false,icon:"🎯",title:"환각(Hallucination) — 없앨 수 없고 관리하는 것",
   tag:"모델 기초",sol:["A10","OmniEsol"],
   s30:"모델이 그럴듯한 거짓을 만드는 현상. 제거 대상이 아니라 설계로 통제할 대상이다.",
   s3:"모델은 사실을 조회하는 것이 아니라 다음에 올 말을 예측한다. 그래서 모르는 영역에서도 자신 있게 답한다. 근거 주입(RAG), 모른다고 답하도록 지시, 신뢰도 표기, 사람 검토 단계 — 이 4개를 겹쳐 쌓아 허용 수준까지 낮춘다.",
   s10:"제품 설계 원칙 — ① 되돌릴 수 없는 작업(전표 확정, 발송, 결제)은 절대 자동 실행하지 않는다 ② 신뢰도 낮은 결과는 별도 검토 큐로 보낸다 ③ 화면에 항상 근거를 함께 노출한다 ④ 사용자가 틀렸다고 표시할 수 있는 버튼을 둔다. ④의 데이터가 다음 개선의 재료가 된다.",
   kw:["근거 주입","확신도","검토 큐","되돌리기"]},
  {id:"k10",role:"영업",must:false,icon:"🧊",title:"경쟁사 AI 발표를 3분 만에 판별하는 법",
   tag:"경쟁 분석",sol:["A10","WEHAGO","NSM10"],
   s30:"출시일·과금·제한사항이 없는 발표는 대부분 로드맵이지 제품이 아니다.",
   s3:"보도자료에서 확인할 것은 딱 셋이다. 실제 GA 날짜가 있는가, 가격이 공개됐는가, 지원하지 않는 범위가 명시됐는가. 세 가지가 다 없으면 데모 단계일 가능성이 높고, 고객 앞에서 과잉 반응할 필요가 없다.",
   s10:"대응 문장 예시 — '해당 기능은 현재 프리뷰 단계로 GA 일정과 과금이 공개되지 않았습니다. 저희는 지금 운영 중인 환경에서 동일 업무를 이렇게 처리합니다.' 이렇게 사실 확인 + 현재 가능한 것 제시가 가장 효과적이다. 확인되지 않은 경쟁사 정보를 비방하듯 말하는 것은 오히려 신뢰를 떨어뜨린다.",
   kw:["GA 일정","가격 공개","제한 명시","프리뷰"]},
];

/* ══════════════════════════════════════════════════════════════
   ✅ 체크시사 — 고정 문항 풀 (뉴스 기반 문항이 추가로 합쳐짐)
══════════════════════════════════════════════════════════════ */
const QUIZ_POOL = [
  {q:"RAG를 도입하면 AI의 환각(없는 사실 생성)이 완전히 사라진다.",
   opts:["O","X"],a:1,
   why:"RAG는 근거 문서를 함께 넣어 환각을 '줄이는' 기법이다. 검색이 잘못된 조각을 가져오거나 근거가 없을 때 모델이 그냥 답해버리면 여전히 환각이 발생한다. 완전 제거는 불가능하며 사람 검토 단계가 함께 필요하다."},
  {q:"MCP(Model Context Protocol)의 핵심 효과로 가장 적절한 것은?",
   opts:["모델 자체의 추론 성능 향상","AI와 외부 시스템 간 연동 방식의 표준화","GPU 학습 비용 절감","한국어 번역 품질 개선"],a:1,
   why:"MCP는 모델 성능이 아니라 '연결 규격'을 표준화한다. 개별 커넥터를 매번 만들던 N×M 구조를 N+M으로 줄여 연동 비용을 낮추고, 우리 데이터가 여러 AI 도구에서 소비될 수 있는 통로를 만든다."},
  {q:"컨텍스트 윈도우가 크면 항상 프롬프트에 자료를 많이 넣는 것이 유리하다.",
   opts:["O","X"],a:1,
   why:"넣을수록 비용과 응답 지연이 함께 증가하고, 긴 입력의 중간 구간 정보는 상대적으로 덜 반영되는 현상도 있다. 그래서 전량 주입보다 필요한 부분만 검색해 넣는 방식이 표준이다."},
  {q:"AI 투자 효과를 경영진에게 설명할 때 가장 먼저 확보해야 할 것은?",
   opts:["도입 후 사용자 만족도 설문","도입 전 업무의 베이스라인 측정값","경쟁사 도입 사례 목록","모델 벤치마크 점수"],a:1,
   why:"도입 전 기준값이 없으면 이후 어떤 개선 수치도 증명할 수 없다. 대상 업무를 좁혀 절감 공수·리드타임·재작업률의 베이스라인을 먼저 측정하는 것이 순서다."},
  {q:"고객이 데이터 반출을 금지하면 온프레미스 LLM이 항상 정답이다.",
   opts:["O","X"],a:1,
   why:"반출 금지는 조건 중 하나일 뿐이다. 호출량이 충분히 크고 대상 업무가 정형화되어 작은 모델로도 품질이 나오는 경우에만 유리하다. 그렇지 않으면 상용 API + 마스킹이 총소유비용에서 더 낫다."},
  {q:"경쟁사 AI 발표의 실체를 판별할 때 확인해야 할 항목이 아닌 것은?",
   opts:["정식 출시(GA) 일정","공개된 과금 체계","지원하지 않는 범위 명시","보도자료의 문장 길이"],a:3,
   why:"GA 일정·가격·제한사항이 모두 빠진 발표는 제품이 아니라 로드맵일 가능성이 높다. 문장 길이는 판별 기준과 무관하다."},
  {q:"AI가 계산한 숫자는 확신도가 '상'으로 표기되면 검산 없이 보고서에 써도 된다.",
   opts:["O","X"],a:1,
   why:"확신도 표기는 모델의 자기 보고일 뿐 정확성의 보증이 아니다. 보고서에 들어가는 수치는 예외 없이 원자료 대조 또는 재계산 단계를 거쳐야 한다."},
  {q:"AI 거버넌스를 처음 만들 때 최소 구성으로 가장 적절한 것은?",
   opts:["전사 AI 윤리 헌장 제정","허용 도구·반출 금지 항목·검증 책임자 3종","모델 성능 벤치마크 정례화","전 직원 대상 자격증 취득"],a:1,
   why:"완벽한 규정을 만들려다 무규정 상태가 지속되는 것이 가장 위험하다. 승인 도구, 넣으면 안 되는 정보, 최종 확인 책임자 3가지만 정해도 최소 통제가 성립한다."},
];

/* ══════════════════════════════════════════════════════════════
   🌿 나노마음건강
══════════════════════════════════════════════════════════════ */
const MOODS = [
  {e:"😄",t:"아주 좋음",c:"#0f5527",msg:"좋은 상태예요. 오늘의 컨디션을 만든 요인을 한 줄만 기록해두면 다음에 재현하기 쉬워집니다."},
  {e:"🙂",t:"괜찮음",  c:"#0b5a54",msg:"안정적이에요. 무리해서 끌어올리기보다 이 상태를 유지하는 리듬을 지키는 편이 좋습니다."},
  {e:"😐",t:"보통",    c:"#7a4405",msg:"평범한 날도 충분합니다. 60초 호흡 한 번이면 오후 집중력이 눈에 띄게 달라집니다."},
  {e:"😟",t:"지침",    c:"#8f4207",msg:"지쳐 있네요. 지금 할 일을 하나만 남기고 나머지는 잠시 미뤄도 괜찮습니다."},
  {e:"😞",t:"많이 힘듦",c:"#9e2a1f",msg:"많이 힘든 날입니다. 혼자 버티지 말고 가까운 사람이나 사내 상담 창구에 한마디 건네보세요."},
];
const LINES = [
  "오늘 다 못 끝내도 괜찮습니다. 내일의 나도 같은 팀입니다.",
  "집중은 의지가 아니라 환경에서 나옵니다. 알림 하나만 꺼보세요.",
  "완벽한 보고서보다 제때 나온 초안이 팀을 더 많이 돕습니다.",
  "숨을 참고 일하고 있진 않나요. 지금 한 번 길게 내쉬어 보세요.",
  "비교는 성장의 연료가 아니라 대부분 소음입니다.",
  "‘조금만 더’가 반복되면 회복이 아니라 부채가 쌓입니다.",
  "모르는 걸 묻는 데 걸리는 3분이, 혼자 헤매는 3시간을 아껴줍니다.",
  "몸이 보내는 신호는 대체로 마음보다 정확합니다.",
  "잘한 일 하나를 적어두는 것만으로 하루의 해석이 달라집니다.",
  "쉬는 것도 업무 능력의 일부입니다. 계획에 넣어두세요.",
];
const ROUTINE = [
  {icon:"👀",t:"20-20-20",     d:"20분마다 6m 밖을 20초 바라보기 — 눈 피로와 두통 예방"},
  {icon:"🧍",t:"어깨 내리기",   d:"어깨를 귀에서 3cm 떨어뜨리고 10초 유지 — 목·승모근 긴장 해소"},
  {icon:"💧",t:"물 한 컵",      d:"카페인 대신 물 한 컵 — 오후 집중력 저하를 늦춰줍니다"},
  {icon:"🚶",t:"60초 걷기",     d:"자리에서 일어나 1분만 걷기 — 혈류 회복, 아이디어 전환"},
  {icon:"📵",t:"알림 5분 끄기", d:"딥워크 직전 알림 차단 — 전환 비용 최대 23분 절감"},
];
const BREATH = [
  {t:"들이쉬기",s:4,scale:1.32,c:"#005c4a"},
  {t:"멈추기",  s:4,scale:1.32,c:"#174b85"},
  {t:"내쉬기",  s:4,scale:0.78,c:"#5a1fb4"},
  {t:"멈추기",  s:4,scale:0.78,c:"#475569"},
];

/* ══════════════════════════════════════════════════════════════
   유틸
══════════════════════════════════════════════════════════════ */
function parseJSON(text) {
  const s = text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
  try { return JSON.parse(s); } catch(_) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch(_) {} }
  return null;
}

/* 다음 예약 실행 시각 계산 — days: [0~6], times: ["HH:MM"] */
function calcNextRun(times, days, fromMs) {
  if (!times.length || !days.length) return null;
  const sorted = times.slice().sort();
  const base = new Date(fromMs);
  for (let d = 0; d < 8; d++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
    if (days.indexOf(day.getDay()) === -1) continue;
    for (let i = 0; i < sorted.length; i++) {
      const parts = sorted[i].split(":");
      const h = parseInt(parts[0], 10);
      const mi = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(mi)) continue;
      const cand = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0, 0);
      if (cand.getTime() > fromMs) return cand.getTime();
    }
  }
  return null;
}

/* 남은 시간 포맷 */
function fmtLeft(ms) {
  if (ms == null || ms < 0) return "--:--:--";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return (d > 0 ? d + "일 " : "") + pad(h) + ":" + pad(m) + ":" + pad(s);
}

function fmtWhen(ms) {
  if (ms == null) return "예약 없음";
  const dt = new Date(ms);
  return (dt.getMonth() + 1) + "/" + dt.getDate() + "(" + DAYS[dt.getDay()] + ") " +
         String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0");
}

/* 클립보드 복사 (실패해도 앱이 죽지 않도록 전부 방어) */
function copyText(t) {
  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (_) {}
  return false;
}

/* 결정적 셔플 — 새로고침 횟수를 시드로 사용 */
function seedPick(arr, count, seed) {
  const out = [];
  const used = {};
  const n = arr.length;
  if (n === 0) return out;
  let k = (seed * 7 + 3) % n;
  while (out.length < Math.min(count, n)) {
    if (!used[k]) { used[k] = 1; out.push(arr[k]); }
    k = (k + 3) % n;
    if (out.length >= n) break;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════
   💾 localStorage 저장소
   ─────────────────────────────────────────────────────────────
   · 사용 불가 환경(사생활 보호 모드, 스토리지 차단, SSR)에서도
     앱이 죽지 않도록 모든 접근을 try/catch로 감싼다.
   · 저장값이 손상·변조돼도 검증 함수를 통과하지 못하면
     기본값으로 되돌린다.
══════════════════════════════════════════════════════════════ */
const LS_PREFIX = "dzAiTalk.v1.";

const LS = (function(){
  let ok = false;
  try {
    const probe = LS_PREFIX + "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    ok = true;
  } catch(_) { ok = false; }

  return {
    ok: ok,
    get(key, fallback, validate){
      if(!ok) return fallback;
      try{
        const raw = window.localStorage.getItem(LS_PREFIX + key);
        if(raw == null) return fallback;
        const v = JSON.parse(raw);
        if(validate && !validate(v)) return fallback;
        return v;
      }catch(_){ return fallback; }
    },
    set(key, val){
      if(!ok) return false;
      try{ window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); return true; }
      catch(_){ return false; }
    },
    clear(){
      if(!ok) return 0;
      try{
        const del = [];
        for(let i = 0; i < window.localStorage.length; i++){
          const k = window.localStorage.key(i);
          if(k && k.indexOf(LS_PREFIX) === 0) del.push(k);
        }
        del.forEach(k=>window.localStorage.removeItem(k));
        return del.length;
      }catch(_){ return 0; }
    },
  };
})();

/* 저장되는 state 훅 — 값이 바뀔 때마다 자동 기록 */
function usePersist(key, initial, validate) {
  const [val, setVal] = useState(()=>LS.get(key, initial, validate));
  useEffect(()=>{ LS.set(key, val); }, [key, val]);
  return [val, setVal];
}

/* 검증 함수 */
const TIME_RE = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
const vBool  = (v)=>typeof v === "boolean";
const vTimes = (v)=>Array.isArray(v) && v.length <= 8 && v.every(t=>typeof t === "string" && TIME_RE.test(t));
const vDays  = (v)=>Array.isArray(v) && v.length <= 7 && v.every(d=>Number.isInteger(d) && d >= 0 && d <= 6);
const vIntv  = (v)=>INTERVALS.some(i=>i.v === v);
const vObj   = (v)=>!!v && typeof v === "object" && !Array.isArray(v);
const vIn    = (arr)=>(v)=>arr.indexOf(v) !== -1;
const vStr   = (v)=>typeof v === "string" && v.length < 40;

/* ══════════════════════════════════════════════════════════════
   ☁️ 서버 동기화
   ─────────────────────────────────────────────────────────────
   · 동기화 코드 1개 = 설정 한 벌. 코드를 아는 기기끼리 공유된다.
   · 서버가 없거나 꺼져 있어도 앱은 localStorage만으로 정상 동작한다.
   · 낙관적 동시성 — rev가 어긋나면(409) 서버 쪽을 받아온다.
══════════════════════════════════════════════════════════════ */

/* 서버에 올리는 키 목록 (동기화 설정 자체는 제외) */
const SYNC_KEYS = ["daily","times","days","auto","interval","nav","cat","lastAuto",
                   "expDone","knowRole","mind","quizStat"];

const SYNC_POLL_MS = 8000;   /* 연결 중일 때 변경 감지 주기 */

function joinUrl(base, path) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return b + path;
}

/* 모든 실패를 정상 반환값으로 바꿔 호출부가 try/catch 없이 쓰게 한다 */
async function syncFetch(url, opts) {
  if (!NET) return {ok:false, status:0, body:null, netError:true};
  try {
    const res = await fetch(url, Object.assign({
      headers: {"Content-Type":"application/json"},
    }, opts || {}));
    let body = null;
    try { body = await res.json(); } catch(_) {}
    return {ok:res.ok, status:res.status, body:body, netError:false};
  } catch(_) {
    return {ok:false, status:0, body:null, netError:true};
  }
}

/* 코드 표기 정규화 — 대소문자·하이픈·공백을 흡수 (서버 규칙과 동일) */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function normalizeCode(raw) {
  let s = String(raw || "").toUpperCase().replace(new RegExp("[^A-Z0-9]", "g"), "");
  if (s.indexOf("DZAI") === 0) s = s.slice(4);
  if (s.length !== 12) return null;
  for (let i = 0; i < s.length; i++) if (CODE_CHARS.indexOf(s[i]) === -1) return null;
  return "DZAI-" + s.slice(0,4) + "-" + s.slice(4,8) + "-" + s.slice(8,12);
}

const SYNC_STATE = {
  off:     {t:"미연결",     c:"#475569", icon:"○"},
  syncing: {t:"동기화 중",  c:"#7a4405", icon:"◌"},
  ok:      {t:"동기화됨",   c:"#0f5527", icon:"●"},
  offline: {t:"서버 연결 안 됨", c:"#8f4207", icon:"⚠"},
  error:   {t:"오류",       c:"#9e2a1f", icon:"✕"},
};

/* 날짜 문자열 (offset일 전/후) */
function dayStr(offset) {
  const d = new Date();
  if (offset) d.setDate(d.getDate() + offset);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

/* ══════════════════════════════════════════════════════════════
   공통 소형 컴포넌트
══════════════════════════════════════════════════════════════ */
function SolTag({s}) {
  const p = SOL[s]||{bg:"rgba(71,85,105,.14)",bd:"rgba(71,85,105,.4)",c:"#43596d"};
  return <span className="sol-tag" style={{background:p.bg,border:`1px solid ${p.bd}`,color:p.c,fontFamily:MONO}}>{s}</span>;
}

/* 코너 상단 '톡' 말풍선 브리핑 */
function TalkBubble({icon, title, children}) {
  return (
    <div style={{display:"flex",gap:9,padding:"14px 18px 4px",alignItems:"flex-start"}}>
      <div style={{
        width:30,height:30,borderRadius:9,flexShrink:0,fontSize:15,
        background:"linear-gradient(135deg,#005c4a,#0b566a)",
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:"#43596d",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:4}}>
          DZ AI 톡
        </div>
        <div style={{
          display:"inline-block",padding:"9px 13px",
          background:"rgba(0,92,74,.055)",
          border:"1px solid rgba(0,92,74,.16)",
          borderRadius:"2px 10px 10px 10px",
        }}>
          <div style={{fontSize:12.5,fontWeight:700,color:"#12293c",marginBottom:3,fontFamily:KR}}>{title}</div>
          <div style={{fontSize:11.5,color:"#3d5a72",lineHeight:1.62,fontFamily:KR}}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({children, right}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:7,padding:"14px 18px 8px"}}>
      <span style={{fontSize:9,fontWeight:900,letterSpacing:"1.4px",color:"#005c4a",fontFamily:MONO,textTransform:"uppercase"}}>▸</span>
      <span style={{fontSize:12,fontWeight:800,color:"#12293c",fontFamily:KR}}>{children}</span>
      {right && <span style={{marginLeft:"auto",fontSize:10,color:"#4a6379",fontFamily:MONO}}>{right}</span>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AnalysisPanel — 뉴스 확장 시 표시
══════════════════════════════════════════════════════════════ */
function AnalysisPanel({a, source, title}) {
  if (!a) return null;
  const imp  = IMP[a.importance]||IMP.medium;
  const priC = (PRI[a.priority]||PRI["모니터링"]).c;
  const srcUrl    = `https://${source}`;
  const searchUrl = `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=ko`;

  return (
    <div className="panel" style={{
      marginTop:10,
      background:"rgba(0,92,74,.04)",
      border:"1px solid rgba(0,92,74,.18)",
      borderLeft:"3px solid rgba(0,92,74,.65)",
      borderRadius:"0 6px 6px 6px",
      overflow:"hidden",
    }}>
      <div style={{
        padding:"9px 14px 8px",
        borderBottom:"1px solid rgba(0,92,74,.1)",
        display:"flex", alignItems:"center", gap:6,
        background:"rgba(0,92,74,.05)",
      }}>
        <span style={{fontSize:8.5,fontWeight:900,letterSpacing:"1.5px",color:"#005c4a",textTransform:"uppercase",fontFamily:MONO}}>
          ▸ DZ 전략분석 리포트
        </span>
        <span style={{fontSize:9,color:"#43596d",fontFamily:MONO,marginLeft:"auto"}}>
          더존비즈온 솔루션 기획전략 기준
        </span>
      </div>

      <div style={{padding:"12px 14px 14px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5,textTransform:"uppercase"}}>
              연관 솔루션
            </div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {(a.solutions||[]).map(s=><SolTag key={s} s={s}/>)}
            </div>
          </div>
          <div>
            <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5,textTransform:"uppercase"}}>
              전략 중요도
            </div>
            <span style={{
              display:"inline-block",padding:"2px 9px",borderRadius:4,
              fontSize:10.5,fontWeight:800,
              background:imp.bg,border:`1px solid ${imp.bd}`,color:imp.c,fontFamily:MONO,
            }}>⬤ {imp.label}</span>
          </div>
          <div>
            <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5,textTransform:"uppercase"}}>
              대응 우선순위
            </div>
            <span style={{
              display:"inline-block",padding:"2px 9px",borderRadius:4,
              fontSize:10.5,fontWeight:800,color:priC,
              border:`1px solid ${priC}40`,background:`${priC}10`,fontFamily:MONO,
            }}>{a.priority}</span>
          </div>
        </div>

        <div style={{borderTop:"1px dashed rgba(0,92,74,.12)",marginBottom:10}}/>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5,textTransform:"uppercase"}}>
            더존 활용 방향
          </div>
          <p style={{fontSize:12.5,color:"#3d5a72",lineHeight:1.68,fontFamily:KR}}>{a.direction}</p>
        </div>

        <div style={{borderTop:"1px dashed rgba(0,92,74,.12)",marginBottom:10}}/>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <a className="ext-btn" href={srcUrl} target="_blank" rel="noreferrer" style={{
            display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:5,
            fontSize:11,fontWeight:700,background:"rgba(23,75,133,.09)",
            border:"1px solid rgba(23,75,133,.28)",color:"#174b85",textDecoration:"none",fontFamily:KR,
          }}>🔗 원소스 {source} ↗</a>
          <a className="ext-btn" href={searchUrl} target="_blank" rel="noreferrer" style={{
            display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:5,
            fontSize:11,fontWeight:700,background:"rgba(0,92,74,.07)",
            border:"1px solid rgba(0,92,74,.22)",color:"#005c4a",textDecoration:"none",fontFamily:KR,
          }}>🔍 Google 뉴스 검색 ↗</a>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NewsItem
══════════════════════════════════════════════════════════════ */
function Item({item, rank, delay, onCatClick}) {
  const [open, setOpen] = useState(false);
  const cat     = CAT[item.category]||{c:"#3d4a5c",bg:"rgba(71,85,105,.1)",bd:"rgba(71,85,105,.25)"};
  const imp     = IMP[item.analysis?.importance]||IMP.medium;
  const priC    = (PRI[item.analysis?.priority]||PRI["모니터링"]).c;
  const srcUrl  = `https://${item.source}`;
  const newsUrl = `https://news.google.com/search?q=${encodeURIComponent(item.title)}&hl=ko`;

  return (
    <div className="item" style={{animationDelay:`${delay}ms`}}>
      <div style={{display:"flex"}}>
        <div style={{
          width:52,flexShrink:0,padding:"14px 0 14px 16px",
          display:"flex",flexDirection:"column",alignItems:"center",gap:4,
          borderRight:"1px solid #dbe6f0",
        }}>
          <span style={{fontFamily:MONO,fontSize:15,fontWeight:700,color:"#43596d",lineHeight:1}}>
            {String(rank).padStart(2,"0")}
          </span>
          <span style={{fontSize:10,color:"#0f5527",fontWeight:700}}>▲{item.points}</span>
        </div>

        <div style={{flex:1,minWidth:0,padding:"12px 16px 13px 14px"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:7,marginBottom:3}}>
            <a className="title-link" href={newsUrl} target="_blank" rel="noreferrer"
               style={{flex:1,fontSize:14,fontWeight:700,color:"#0d2436",lineHeight:1.42}}>
              {item.title}
            </a>
            <span className="cat-badge" onClick={()=>onCatClick(item.category)}
              title={`'${item.category}' 카테고리로 필터`}
              style={{
                flexShrink:0,marginTop:2,padding:"2px 7px",borderRadius:3,
                fontSize:8.5,fontWeight:800,letterSpacing:".7px",
                background:cat.bg,border:`1px solid ${cat.bd}`,color:cat.c,
                fontFamily:MONO,userSelect:"none",
              }}>{item.category}</span>
          </div>

          <a className="src-link" href={srcUrl} target="_blank" rel="noreferrer" style={{
            fontSize:10.5,color:"#4a6379",fontFamily:MONO,textDecoration:"none",
            display:"inline-block",marginBottom:6,
          }}>({item.source}) ↗</a>

          <p style={{fontSize:12.5,color:"#3d5a72",lineHeight:1.65,marginBottom:8,fontFamily:KR}}>
            {item.summary}
          </p>

          <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:10.5,color:"#255547",fontWeight:700,fontFamily:MONO}}>{item.points}pt</span>
            <span style={{fontSize:9,color:"#c6d7e6",fontFamily:MONO}}>·</span>
            <span style={{fontSize:10.5,color:"#4a6379",fontFamily:MONO}}>{item.time}</span>

            {!open && item.analysis && (
              <span style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:9,color:"#c6d7e6",fontFamily:MONO}}>|</span>
                <span style={{
                  padding:"1px 6px",borderRadius:3,fontSize:8.5,fontWeight:800,
                  background:imp.bg,border:`1px solid ${imp.bd}`,color:imp.c,fontFamily:MONO,
                }}>⬤ {imp.label}</span>
                <span style={{fontSize:9.5,fontWeight:700,color:priC,fontFamily:MONO}}>
                  [{item.analysis.priority}]
                </span>
                {(item.analysis.solutions||[]).slice(0,2).map(s=><SolTag key={s} s={s}/>)}
              </span>
            )}

            <button className="toggle-btn" onClick={()=>setOpen(v=>!v)} style={{
                marginLeft:"auto",padding:"3px 10px",borderRadius:4,fontSize:10,fontWeight:700,
                border:`1px solid ${open?"rgba(0,92,74,.45)":"rgba(0,92,74,.2)"}`,
                background:open?"rgba(0,92,74,.1)":"rgba(0,92,74,.04)",
                color:open?"#005c4a":"#2b5b4f",fontFamily:KR,cursor:"pointer",
                display:"flex",alignItems:"center",gap:4,
              }}>
              <span style={{fontSize:10}}>{open?"📊":"🔍"}</span>
              DZ전략분석 {open?"▲":"▼"}
            </button>
          </div>

          {open && <AnalysisPanel a={item.analysis} source={item.source} title={item.title}/>}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LiveButton
══════════════════════════════════════════════════════════════ */
function LiveBtn({loading,stepIdx,onClick,label,ai}) {
  const step = STEPS[stepIdx%STEPS.length];
  const clr  = ai?"#005c4a":"#7a4405";
  const bdr  = ai?"rgba(0,92,74,":"rgba(122,68,5,";
  return (
    <div style={{position:"relative"}}>
      <button className="live-btn" disabled={loading} onClick={onClick} style={{
        padding:"5px 15px",borderRadius:5,fontFamily:KR,
        fontSize:11.5,fontWeight:700,minWidth:126,
        border:`1px solid ${loading?bdr+".4)":bdr+".25)"}`,
        background:loading?bdr+".07)":"transparent",
        color:clr,cursor:loading?"not-allowed":"pointer",
      }}>
        {loading
          ?<span style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
              <span style={{width:9,height:9,flexShrink:0,display:"inline-block",border:`1.5px solid ${clr}35`,borderTop:`1.5px solid ${clr}`,borderRadius:"50%",animation:"spin .75s linear infinite"}}/>
              <span style={{animation:"blink .85s ease infinite",fontSize:11}}>{step.e}</span>
              <span style={{fontSize:10}}>{step.t}</span>
            </span>
          :label}
      </button>
      {loading&&(
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:bdr+".12)",borderRadius:"0 0 5px 5px",overflow:"hidden"}}>
          <div style={{height:"100%",background:`linear-gradient(90deg,${clr},${ai?"#0b566a":"#7a4405"})`,animation:"bar 2s ease-in-out infinite"}}/>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ⏰ 스케줄 패널 — 매일 자동 새로고침 시간설정
══════════════════════════════════════════════════════════════ */
function SchedulePanel({
  daily,setDaily, times,setTimes, days,setDays,
  auto,setAuto, interval,setInterval_, nextRun, now, lastAuto, onReset, onClose, children,
}) {
  const [newT, setNewT] = useState("09:00");
  const [confirmReset, setConfirmReset] = useState(false);

  const addTime = () => {
    if (!newT) return;
    if (times.indexOf(newT) !== -1) return;
    if (times.length >= 8) return;
    setTimes(times.concat([newT]).sort());
  };
  const delTime = (t) => setTimes(times.filter(x => x !== t));
  const togDay  = (d) => setDays(days.indexOf(d) === -1 ? days.concat([d]).sort() : days.filter(x => x !== d));

  const preset = (name) => {
    if (name === "weekday") setDays([1,2,3,4,5]);
    if (name === "all")     setDays([0,1,2,3,4,5,6]);
    if (name === "morning") setTimes(["08:30"]);
    if (name === "three")   setTimes(["08:30","13:00","18:00"]);
  };

  const left = nextRun != null ? nextRun - now : null;

  return (
    <div className="panel" style={{
      borderBottom:"1px solid #dbe6f0",
      background:"linear-gradient(180deg,rgba(0,92,74,.045),rgba(0,92,74,.012))",
      padding:"14px 18px 16px",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:9,fontWeight:900,letterSpacing:"1.4px",color:"#005c4a",fontFamily:MONO}}>
          ⏰ 자동 새로고침 시간설정
        </span>

        {/* 저장 상태 뱃지 */}
        <span style={{
          padding:"1px 7px",borderRadius:3,fontSize:9,fontWeight:800,fontFamily:MONO,
          background:LS.ok?"rgba(15,85,39,.09)":"rgba(122,68,5,.09)",
          border:`1px solid ${LS.ok?"rgba(15,85,39,.28)":"rgba(122,68,5,.3)"}`,
          color:LS.ok?"#0f5527":"#7a4405",
        }}>{LS.ok?"💾 자동 저장됨":"⚠ 저장 불가"}</span>

        {/* 초기화 — 2단 확인 */}
        {LS.ok && (
          confirmReset
            ? <span style={{display:"inline-flex",gap:4,alignItems:"center",marginLeft:"auto"}}>
                <span style={{fontSize:10,color:"#7a4405",fontFamily:KR}}>저장된 설정·기록을 모두 지울까요?</span>
                <button className="toggle-btn" onClick={()=>{onReset();setConfirmReset(false);}} style={{
                  padding:"2px 9px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
                  border:"1px solid rgba(158,42,31,.4)",background:"rgba(158,42,31,.1)",
                  color:"#9e2a1f",cursor:"pointer",
                }}>초기화</button>
                <button className="toggle-btn" onClick={()=>setConfirmReset(false)} style={{
                  padding:"2px 9px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
                  border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
                }}>취소</button>
              </span>
            : <button className="toggle-btn" onClick={()=>setConfirmReset(true)} style={{
                marginLeft:"auto",padding:"2px 9px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
                border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
              }}>저장값 초기화</button>
        )}

        <button onClick={onClose} className="toggle-btn" style={{
          marginLeft:LS.ok?0:"auto",padding:"2px 9px",borderRadius:4,fontSize:10,fontWeight:700,
          border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",fontFamily:MONO,cursor:"pointer",
        }}>닫기 ▲</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.35fr 1fr",gap:14}}>

        {/* ── 좌: 매일 정해진 시각 ── */}
        <div style={{
          padding:"12px 13px",borderRadius:7,
          background:"rgba(15,35,55,.10)",
          border:`1px solid ${daily?"rgba(0,92,74,.3)":"#dbe6f0"}`,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:11.5,fontWeight:800,color:daily?"#005c4a":"#3d5a72",fontFamily:KR}}>
              📅 매일 정해진 시각에 자동 갱신
            </span>
            <button onClick={()=>setDaily(!daily)} className="toggle-btn" style={{
              marginLeft:"auto",width:42,height:20,borderRadius:10,position:"relative",
              border:`1px solid ${daily?"rgba(0,92,74,.5)":"#c6d7e6"}`,
              background:daily?"rgba(0,92,74,.15)":"#ffffff",cursor:"pointer",padding:0,
            }}>
              <span style={{
                position:"absolute",top:2,left:daily?22:2,width:14,height:14,borderRadius:"50%",
                background:daily?"#005c4a":"#4a6379",transition:"left .18s",
              }}/>
            </button>
          </div>

          {/* 요일 */}
          <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5}}>
            실행 요일
          </div>
          <div style={{display:"flex",gap:4,marginBottom:9,flexWrap:"wrap"}}>
            {DAYS.map((d,i)=>{
              const on = days.indexOf(i) !== -1;
              const wc = i===0?"#9e2a1f":i===6?"#174b85":"#005c4a";
              return (
                <button key={d} className="chip" onClick={()=>togDay(i)} style={{
                  width:27,height:24,borderRadius:4,fontSize:11,fontWeight:800,fontFamily:KR,
                  border:`1px solid ${on?wc+"66":"#c6d7e6"}`,
                  background:on?wc+"18":"transparent",
                  color:on?wc:"#4a6379",cursor:"pointer",padding:0,
                }}>{d}</button>
              );
            })}
            <button className="chip" onClick={()=>preset("weekday")} style={{
              padding:"0 8px",height:24,borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>평일</button>
            <button className="chip" onClick={()=>preset("all")} style={{
              padding:"0 8px",height:24,borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>매일</button>
          </div>

          {/* 시각 */}
          <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5}}>
            실행 시각 <span style={{color:"#c6d7e6"}}>(최대 8개)</span>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {times.length === 0 && (
              <span style={{fontSize:10.5,color:"#4a6379",fontFamily:KR}}>시각을 1개 이상 추가하세요.</span>
            )}
            {times.map(t=>(
              <span key={t} style={{
                display:"inline-flex",alignItems:"center",gap:5,padding:"3px 6px 3px 9px",
                borderRadius:4,background:"rgba(0,92,74,.08)",
                border:"1px solid rgba(0,92,74,.26)",
              }}>
                <span style={{fontSize:11.5,fontWeight:800,color:"#005c4a",fontFamily:MONO}}>{t}</span>
                <button onClick={()=>delTime(t)} className="chip" style={{
                  border:"none",background:"transparent",color:"#255547",
                  fontSize:12,cursor:"pointer",lineHeight:1,padding:"0 1px",
                }}>×</button>
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            <input type="time" className="time-input" value={newT}
                   onChange={e=>setNewT(e.target.value)} style={{fontFamily:MONO}}/>
            <button onClick={addTime} className="chip" style={{
              padding:"4px 11px",borderRadius:4,fontSize:10.5,fontWeight:700,fontFamily:KR,
              border:"1px solid rgba(0,92,74,.3)",background:"rgba(0,92,74,.07)",
              color:"#005c4a",cursor:"pointer",
            }}>+ 시각 추가</button>
            <button onClick={()=>preset("three")} className="chip" style={{
              padding:"4px 9px",borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>08:30·13:00·18:00</button>
            <button onClick={()=>preset("morning")} className="chip" style={{
              padding:"4px 9px",borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>아침만</button>
          </div>

          {/* 다음 실행 */}
          <div style={{
            marginTop:10,paddingTop:9,borderTop:"1px dashed rgba(0,92,74,.14)",
            display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",
          }}>
            <span style={{fontSize:9.5,color:"#4a6379",fontFamily:MONO,fontWeight:700}}>다음 실행</span>
            <span style={{fontSize:11.5,fontWeight:800,color:daily&&nextRun?"#005c4a":"#4a6379",fontFamily:MONO}}>
              {daily ? fmtWhen(nextRun) : "OFF"}
            </span>
            {daily && nextRun != null && (
              <span style={{
                padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:800,fontFamily:MONO,
                background:"rgba(0,92,74,.09)",border:"1px solid rgba(0,92,74,.24)",color:"#005c4a",
              }}>⏳ {fmtLeft(left)}</span>
            )}
            {lastAuto && (
              <span style={{fontSize:9.5,color:"#43596d",fontFamily:MONO,marginLeft:"auto"}}>
                최근 자동실행 {lastAuto}
              </span>
            )}
          </div>
        </div>

        {/* ── 우: 주기 반복 ── */}
        <div style={{
          padding:"12px 13px",borderRadius:7,
          background:"rgba(15,35,55,.10)",
          border:`1px solid ${auto?"rgba(23,75,133,.3)":"#dbe6f0"}`,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:11.5,fontWeight:800,color:auto?"#174b85":"#3d5a72",fontFamily:KR}}>
              ⏱ 주기 반복 갱신
            </span>
            <button onClick={()=>setAuto(!auto)} className="toggle-btn" style={{
              marginLeft:"auto",width:42,height:20,borderRadius:10,position:"relative",
              border:`1px solid ${auto?"rgba(23,75,133,.5)":"#c6d7e6"}`,
              background:auto?"rgba(23,75,133,.15)":"#ffffff",cursor:"pointer",padding:0,
            }}>
              <span style={{
                position:"absolute",top:2,left:auto?22:2,width:14,height:14,borderRadius:"50%",
                background:auto?"#174b85":"#4a6379",transition:"left .18s",
              }}/>
            </button>
          </div>

          <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:5}}>
            갱신 간격
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
            {INTERVALS.map(iv=>{
              const on = interval === iv.v;
              return (
                <button key={iv.v} className="chip" onClick={()=>setInterval_(iv.v)} style={{
                  padding:"4px 10px",borderRadius:4,fontSize:10.5,fontWeight:800,fontFamily:MONO,
                  border:`1px solid ${on?"rgba(23,75,133,.5)":"#c6d7e6"}`,
                  background:on?"rgba(23,75,133,.12)":"transparent",
                  color:on?"#174b85":"#4a6379",cursor:"pointer",
                }}>{iv.t}</button>
              );
            })}
          </div>

          <div style={{
            padding:"9px 11px",borderRadius:6,
            background:"rgba(122,68,5,.04)",border:"1px solid rgba(122,68,5,.14)",
          }}>
            <div style={{fontSize:9.5,fontWeight:800,color:"#7a4405",fontFamily:MONO,marginBottom:4}}>ⓘ 동작 방식</div>
            <div style={{fontSize:10.5,color:"#3d5a72",lineHeight:1.65,fontFamily:KR}}>
              두 방식은 동시에 켤 수 있습니다. <b style={{color:"#005c4a"}}>매일 갱신</b>은 지정 요일·시각에
              정확히 한 번 실행되고, <b style={{color:"#174b85"}}>주기 갱신</b>은 설정한 간격마다 반복됩니다.
              갱신은 화면이 열려 있는 동안에만 동작하지만,
              {LS.ok
                ? <> 설정은 <b style={{color:"#0f5527"}}>이 브라우저에 저장되어</b> 다음 방문 시 그대로 복원됩니다.
                    닫혀 있던 동안 지나간 예약은 실행되지 않고, 다음 슬롯부터 이어집니다.</>
                : <> 이 브라우저에서는 저장소를 사용할 수 없어 설정이 유지되지 않습니다
                    (사생활 보호 모드이거나 스토리지가 차단된 상태).</>}
            </div>
          </div>
        </div>
      </div>

      {/* 서버 동기화 */}
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ☁️ 동기화 패널
══════════════════════════════════════════════════════════════ */
function SyncPanel({
  url, setUrl, code, status, lastSyncAt, rev, note,
  onIssue, onConnect, onPushNow, onDisconnect, onDeleteRemote, busy,
}) {
  const [input, setInput]   = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const st = SYNC_STATE[status] || SYNC_STATE.off;

  const doCopy = ()=>{
    if (copyText(code)) { setCopied(true); setTimeout(()=>setCopied(false), 1600); }
  };
  const doConnect = ()=>{
    const c = normalizeCode(input);
    if (!c) return;
    onConnect(c);
    setInput("");
  };
  const inputValid = normalizeCode(input) !== null;

  return (
    <div style={{
      marginTop:12,padding:"12px 13px",borderRadius:7,
      background:"rgba(15,35,55,.10)",
      border:`1px solid ${code?"rgba(90,31,180,.3)":"#dbe6f0"}`,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontSize:11.5,fontWeight:800,color:code?"#5a1fb4":"#3d5a72",fontFamily:KR}}>
          ☁️ 서버 동기화
        </span>
        <span style={{
          padding:"1px 8px",borderRadius:3,fontSize:9.5,fontWeight:800,fontFamily:MONO,
          background:st.c+"14",border:`1px solid ${st.c}44`,color:st.c,
        }}>
          <span style={{animation:status==="syncing"?"blink .8s infinite":"none"}}>{st.icon}</span> {st.t}
        </span>
        {lastSyncAt && (
          <span style={{fontSize:9.5,color:"#43596d",fontFamily:MONO}}>
            최근 {lastSyncAt}{rev?` · rev ${rev}`:""}
          </span>
        )}
      </div>

      {/* 서버 주소 */}
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:9}}>
        <span style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",width:56,flexShrink:0}}>
          서버 주소
        </span>
        <input
          className="time-input"
          value={url}
          onChange={e=>setUrl(e.target.value)}
          placeholder="http://localhost:8000  또는  /api 로 시작하는 상대경로"
          style={{flex:1,minWidth:190,fontFamily:MONO,fontSize:10.5,color:"#2f4a61",fontWeight:400}}
        />
      </div>

      {!code ? (
        /* ── 미연결 ── */
        <div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
            <button className="chip" onClick={onIssue} disabled={!url||busy} style={{
              padding:"5px 13px",borderRadius:5,fontSize:11,fontWeight:700,fontFamily:KR,
              border:"1px solid rgba(90,31,180,.4)",
              background:url&&!busy?"rgba(90,31,180,.1)":"transparent",
              color:url&&!busy?"#5a1fb4":"#4a6379",
              cursor:url&&!busy?"pointer":"not-allowed",
            }}>＋ 동기화 코드 발급</button>

            <span style={{fontSize:10,color:"#43596d",fontFamily:MONO}}>또는</span>

            <input
              className="time-input"
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&inputValid&&url&&!busy) doConnect(); }}
              placeholder="DZAI-XXXX-XXXX-XXXX"
              style={{width:184,fontFamily:MONO,fontSize:11,letterSpacing:".5px"}}
            />
            <button className="chip" onClick={doConnect} disabled={!inputValid||!url||busy} style={{
              padding:"5px 12px",borderRadius:5,fontSize:11,fontWeight:700,fontFamily:KR,
              border:`1px solid ${inputValid&&url&&!busy?"rgba(0,92,74,.4)":"#c6d7e6"}`,
              background:inputValid&&url&&!busy?"rgba(0,92,74,.09)":"transparent",
              color:inputValid&&url&&!busy?"#005c4a":"#4a6379",
              cursor:inputValid&&url&&!busy?"pointer":"not-allowed",
            }}>코드로 연결</button>
          </div>
          <div style={{fontSize:10.5,color:"#4a6379",lineHeight:1.6,fontFamily:KR}}>
            {url
              ? <>코드를 발급하면 지금 이 기기의 설정이 서버에 올라갑니다. 다른 기기에서 같은 코드를 입력하면 설정·진행률이 따라옵니다.</>
              : <>먼저 서버 주소를 입력하세요. 서버 없이도 앱은 이 브라우저 저장만으로 정상 동작합니다.</>}
          </div>
        </div>
      ) : (
        /* ── 연결됨 ── */
        <div>
          <div style={{
            display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",
            padding:"9px 11px",borderRadius:6,marginBottom:8,
            background:"rgba(90,31,180,.06)",border:"1px solid rgba(90,31,180,.2)",
          }}>
            <span style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px"}}>
              내 동기화 코드
            </span>
            <span style={{fontSize:13.5,fontWeight:800,color:"#5a1fb4",fontFamily:MONO,letterSpacing:"1px"}}>
              {code}
            </span>
            <button className="chip" onClick={doCopy} style={{
              padding:"2px 9px",borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
              border:`1px solid ${copied?"rgba(15,85,39,.45)":"rgba(90,31,180,.3)"}`,
              background:copied?"rgba(15,85,39,.1)":"transparent",
              color:copied?"#0f5527":"#5a1fb4",cursor:"pointer",
            }}>{copied?"✓ 복사됨":"📋 복사"}</button>
          </div>

          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <button className="chip" onClick={onPushNow} disabled={busy} style={{
              padding:"4px 12px",borderRadius:5,fontSize:10.5,fontWeight:700,fontFamily:KR,
              border:"1px solid rgba(0,92,74,.32)",background:"rgba(0,92,74,.07)",
              color:"#005c4a",cursor:busy?"wait":"pointer",
            }}>↻ 지금 동기화</button>
            <button className="chip" onClick={onDisconnect} style={{
              padding:"4px 12px",borderRadius:5,fontSize:10.5,fontWeight:700,fontFamily:KR,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>연결 해제</button>

            {confirmDel ? (
              <span style={{display:"inline-flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:10,color:"#7a4405",fontFamily:KR}}>서버 데이터까지 삭제할까요?</span>
                <button className="chip" onClick={()=>{onDeleteRemote();setConfirmDel(false);}} style={{
                  padding:"3px 9px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
                  border:"1px solid rgba(158,42,31,.4)",background:"rgba(158,42,31,.1)",
                  color:"#9e2a1f",cursor:"pointer",
                }}>삭제</button>
                <button className="chip" onClick={()=>setConfirmDel(false)} style={{
                  padding:"3px 9px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
                  border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
                }}>취소</button>
              </span>
            ) : (
              <button className="chip" onClick={()=>setConfirmDel(true)} style={{
                padding:"4px 12px",borderRadius:5,fontSize:10.5,fontWeight:700,fontFamily:KR,
                border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
              }}>서버에서 삭제</button>
            )}
          </div>

          <div style={{fontSize:10.5,color:"#4a6379",lineHeight:1.6,fontFamily:KR,marginTop:8}}>
            설정이 바뀌면 자동으로 올라갑니다(최대 {Math.round(SYNC_POLL_MS/1000)}초 지연).
            <b style={{color:"#5a1fb4"}}> 연결 해제</b>는 이 기기에서 코드만 잊고 서버 데이터는 그대로 둡니다.
          </div>
        </div>
      )}

      {note && (
        <div className="pop" style={{
          marginTop:9,padding:"8px 11px",borderRadius:6,
          background:note.bad?"rgba(158,42,31,.06)":"rgba(0,92,74,.05)",
          border:`1px solid ${note.bad?"rgba(158,42,31,.2)":"rgba(0,92,74,.18)"}`,
          fontSize:10.5,color:note.bad?"#87362e":"#255547",lineHeight:1.6,fontFamily:KR,
        }}>{note.msg}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   🔥 핫AI코너
══════════════════════════════════════════════════════════════ */
function HotCorner({news, onCatClick}) {
  const ranked = useMemo(()=>{
    return news.map(n=>{
      const iw = (IMP[n.analysis?.importance]||IMP.medium).w;
      const pw = (PRI[n.analysis?.priority]||PRI["모니터링"]).w;
      const heat = Math.round((n.points||0) * 0.6 + iw * 18 + pw * 12);
      return {n, heat};
    }).sort((a,b)=>b.heat-a.heat);
  },[news]);

  const maxHeat = ranked.length ? ranked[0].heat : 1;
  const urgent  = news.filter(n=>n.analysis?.priority==="즉시검토");
  const byCat   = useMemo(()=>{
    const m = {};
    news.forEach(n=>{ m[n.category] = (m[n.category]||0) + 1; });
    return Object.keys(m).map(k=>({k, v:m[k]})).sort((a,b)=>b.v-a.v);
  },[news]);

  return (
    <div>
      <TalkBubble icon="🔥" title="지금 가장 뜨거운 AI 이슈만 모았어요">
        기사 포인트 · 전략 중요도 · 대응 우선순위를 합산한 <b style={{color:"#005c4a"}}>열기지수</b> 순으로 정렬했습니다.
        상위 3건은 오늘 안에 한 번은 읽어두는 걸 권합니다.
      </TalkBubble>

      {/* 급상승 키워드 */}
      <SectionTitle right="실시간 검색 급상승">급상승 AI 키워드</SectionTitle>
      <div style={{padding:"0 18px 6px",display:"flex",gap:6,flexWrap:"wrap"}}>
        {HOT_KEYWORDS.map((h,i)=>(
          <span key={h.k} className="card" style={{
            animationDelay:`${i*35}ms`,
            display:"inline-flex",alignItems:"center",gap:6,
            padding:"5px 11px",borderRadius:20,
            background:h.c+"12",border:`1px solid ${h.c}33`,
          }}>
            <span style={{fontSize:9,fontWeight:900,color:"#43596d",fontFamily:MONO}}>{i+1}</span>
            <span style={{fontSize:11.5,fontWeight:700,color:h.c,fontFamily:KR}}>{h.k}</span>
            <span style={{fontSize:9.5,fontWeight:800,color:"#0f5527",fontFamily:MONO}}>{h.d}</span>
          </span>
        ))}
      </div>

      {/* 열기지수 랭킹 */}
      <SectionTitle right={`총 ${news.length}건`}>열기지수 TOP 랭킹</SectionTitle>
      <div style={{padding:"0 18px"}}>
        {ranked.map((r,i)=>{
          const n = r.n;
          const cat = CAT[n.category]||{c:"#3d4a5c",bg:"rgba(71,85,105,.1)",bd:"rgba(71,85,105,.25)"};
          const pct = Math.max(6, Math.round(r.heat / maxHeat * 100));
          const top = i < 3;
          return (
            <div key={n.id??i} className="card" style={{
              animationDelay:`${i*45}ms`,
              display:"flex",alignItems:"center",gap:11,
              padding:"10px 12px",marginBottom:6,borderRadius:7,
              background:top?"rgba(158,42,31,.045)":"rgba(15,35,55,.09)",
              border:`1px solid ${top?"rgba(158,42,31,.2)":"#dbe6f0"}`,
              transition:"border-color .16s",
            }}>
              <div style={{width:26,flexShrink:0,textAlign:"center"}}>
                {top
                  ? <span style={{fontSize:16,display:"inline-block",animation:"flame 1.6s ease-in-out infinite"}}>🔥</span>
                  : <span style={{fontSize:13,fontWeight:800,color:"#43596d",fontFamily:MONO}}>{i+1}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                  <a className="title-link" href={`https://news.google.com/search?q=${encodeURIComponent(n.title)}&hl=ko`}
                     target="_blank" rel="noreferrer"
                     style={{flex:1,fontSize:12.5,fontWeight:700,color:"#0d2436",lineHeight:1.4,
                             overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {n.title}
                  </a>
                  <span className="cat-badge" onClick={()=>onCatClick(n.category)} style={{
                    flexShrink:0,padding:"1px 6px",borderRadius:3,fontSize:8,fontWeight:800,
                    background:cat.bg,border:`1px solid ${cat.bd}`,color:cat.c,fontFamily:MONO,
                  }}>{n.category}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{flex:1,height:4,borderRadius:2,background:"#ffffff",overflow:"hidden"}}>
                    <div style={{
                      height:"100%",width:pct+"%",borderRadius:2,
                      background:top?"linear-gradient(90deg,#9e2a1f,#7a4405)":"linear-gradient(90deg,#0b566a,#005c4a)",
                      transition:"width .4s",
                    }}/>
                  </div>
                  <span style={{fontSize:10,fontWeight:800,color:top?"#9e2a1f":"#005c4a",fontFamily:MONO,flexShrink:0}}>
                    {r.heat}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 즉시검토 + 분포 */}
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:12,padding:"14px 18px 20px"}}>
        <div style={{padding:"12px 13px",borderRadius:7,background:"rgba(158,42,31,.04)",border:"1px solid rgba(158,42,31,.18)"}}>
          <div style={{fontSize:9.5,fontWeight:900,color:"#9e2a1f",fontFamily:MONO,letterSpacing:"1px",marginBottom:8}}>
            🚨 즉시검토 {urgent.length}건
          </div>
          {urgent.length === 0
            ? <div style={{fontSize:11,color:"#4a6379",fontFamily:KR}}>현재 즉시검토 등급 이슈가 없습니다.</div>
            : urgent.map((u,i)=>(
                <div key={u.id??i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"flex-start"}}>
                  <span style={{fontSize:9,color:"#9e2a1f",fontFamily:MONO,marginTop:2}}>▸</span>
                  <span style={{fontSize:11.5,color:"#2f4a61",lineHeight:1.5,fontFamily:KR}}>{u.title}</span>
                </div>
              ))}
        </div>
        <div style={{padding:"12px 13px",borderRadius:7,background:"rgba(15,35,55,.09)",border:"1px solid #dbe6f0"}}>
          <div style={{fontSize:9.5,fontWeight:900,color:"#005c4a",fontFamily:MONO,letterSpacing:"1px",marginBottom:8}}>
            📊 카테고리 분포
          </div>
          {byCat.map(c=>{
            const cc = CAT[c.k]||{c:"#3d4a5c"};
            const w = Math.round(c.v / news.length * 100);
            return (
              <div key={c.k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                <span style={{width:64,flexShrink:0,fontSize:10,color:cc.c,fontFamily:MONO,fontWeight:700}}>{c.k}</span>
                <div style={{flex:1,height:4,borderRadius:2,background:"#ffffff",overflow:"hidden"}}>
                  <div style={{height:"100%",width:w+"%",background:cc.c,borderRadius:2,opacity:.75}}/>
                </div>
                <span style={{fontSize:9.5,color:"#4a6379",fontFamily:MONO,width:16,textAlign:"right"}}>{c.v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   🧪 경험하기
══════════════════════════════════════════════════════════════ */
function ExpCard({x, delay, done, onDone}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lc = LEVEL_C[x.level] || "#174b85";

  const doCopy = () => {
    const ok = copyText(x.prompt);
    if (ok) { setCopied(true); setTimeout(()=>setCopied(false), 1600); }
  };

  return (
    <div className="card" style={{
      animationDelay:`${delay}ms`,
      borderRadius:8,marginBottom:8,overflow:"hidden",
      background:done?"rgba(0,92,74,.045)":"rgba(15,35,55,.09)",
      border:`1px solid ${done?"rgba(0,92,74,.3)":"#dbe6f0"}`,
      transition:"border-color .16s,background .2s",
    }}>
      <div style={{padding:"12px 14px",display:"flex",gap:11,alignItems:"flex-start"}}>
        <div style={{
          width:34,height:34,borderRadius:8,flexShrink:0,fontSize:17,
          background:"rgba(0,92,74,.07)",border:"1px solid rgba(0,92,74,.16)",
          display:"flex",alignItems:"center",justifyContent:"center",
        }}>{x.icon}</div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700,color:done?"#005c4a":"#0d2436",fontFamily:KR}}>
              {done ? "✓ " : ""}{x.title}
            </span>
            <span style={{
              padding:"1px 6px",borderRadius:3,fontSize:8.5,fontWeight:800,fontFamily:MONO,
              background:lc+"14",border:`1px solid ${lc}38`,color:lc,
            }}>{x.level}</span>
            <span style={{fontSize:9.5,color:"#4a6379",fontFamily:MONO}}>⏱ {x.min}분</span>
            <span style={{fontSize:9.5,color:"#4a6379",fontFamily:MONO}}>· {x.tool}</span>
            {x.free && <span style={{fontSize:9.5,color:"#0f5527",fontFamily:MONO}}>· 무료 가능</span>}
          </div>

          <p style={{fontSize:11.5,color:"#3d5a72",lineHeight:1.6,marginBottom:7,fontFamily:KR}}>{x.goal}</p>

          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            {x.sol.map(s=><SolTag key={s} s={s}/>)}
            <button className="toggle-btn" onClick={()=>setOpen(v=>!v)} style={{
              marginLeft:"auto",padding:"3px 10px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
              border:`1px solid ${open?"rgba(0,92,74,.45)":"rgba(0,92,74,.2)"}`,
              background:open?"rgba(0,92,74,.1)":"rgba(0,92,74,.04)",
              color:open?"#005c4a":"#2b5b4f",cursor:"pointer",
            }}>{open?"접기 ▲":"체험 가이드 ▼"}</button>
            <button className="toggle-btn" onClick={()=>onDone(x.id)} style={{
              padding:"3px 10px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:KR,
              border:`1px solid ${done?"rgba(0,92,74,.5)":"#c6d7e6"}`,
              background:done?"rgba(0,92,74,.12)":"transparent",
              color:done?"#005c4a":"#4a6379",cursor:"pointer",
            }}>{done?"✓ 체험완료":"체험 체크"}</button>
          </div>
        </div>
      </div>

      {open && (
        <div className="panel" style={{
          padding:"12px 14px 14px",borderTop:"1px solid rgba(0,92,74,.12)",
          background:"rgba(0,92,74,.03)",
        }}>
          <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:6}}>
            따라하기 단계
          </div>
          {x.steps.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
              <span style={{
                width:16,height:16,borderRadius:"50%",flexShrink:0,marginTop:1,
                background:"rgba(0,92,74,.1)",border:"1px solid rgba(0,92,74,.28)",
                fontSize:9,fontWeight:800,color:"#005c4a",fontFamily:MONO,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>{i+1}</span>
              <span style={{fontSize:11.5,color:"#3d5a72",lineHeight:1.58,fontFamily:KR}}>{s}</span>
            </div>
          ))}

          <div style={{
            marginTop:10,padding:"10px 12px",borderRadius:6,
            background:"#eef4fa",border:"1px solid #c6d7e6",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:9,color:"#255547",fontFamily:MONO,fontWeight:700,letterSpacing:".8px"}}>
                복사해서 바로 쓰는 프롬프트
              </span>
              <button className="toggle-btn" onClick={doCopy} style={{
                marginLeft:"auto",padding:"2px 9px",borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
                border:`1px solid ${copied?"rgba(15,85,39,.45)":"rgba(0,92,74,.25)"}`,
                background:copied?"rgba(15,85,39,.1)":"rgba(0,92,74,.05)",
                color:copied?"#0f5527":"#005c4a",cursor:"pointer",
              }}>{copied?"✓ 복사됨":"📋 복사"}</button>
            </div>
            <pre style={{
              fontSize:11,color:"#2f4a61",lineHeight:1.66,fontFamily:MONO,
              whiteSpace:"pre-wrap",wordBreak:"break-word",margin:0,
            }}>{x.prompt}</pre>
          </div>

          <div style={{
            marginTop:9,padding:"8px 11px",borderRadius:6,
            background:"rgba(122,68,5,.05)",border:"1px solid rgba(122,68,5,.16)",
            display:"flex",gap:7,alignItems:"flex-start",
          }}>
            <span style={{fontSize:11,flexShrink:0}}>💡</span>
            <span style={{fontSize:11,color:"#645019",lineHeight:1.58,fontFamily:KR}}>{x.tip}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpCorner() {
  const [done, setDone] = usePersist("expDone", {}, vObj);
  const toggle = (id) => setDone(prev => {
    const next = Object.assign({}, prev);
    if (next[id]) delete next[id]; else next[id] = 1;
    return next;
  });
  const cnt = Object.keys(done).length;
  const pct = Math.round(cnt / EXPS.length * 100);

  return (
    <div>
      <TalkBubble icon="🧪" title="읽는 AI에서 해보는 AI로">
        오늘 <b style={{color:"#005c4a"}}>딱 하나만</b> 골라 따라해 보세요. 카드마다 복사해서 바로 쓰는 프롬프트가 들어 있습니다.
        체험을 마치면 체크해서 진행률을 채워보세요.
      </TalkBubble>

      {/* 진행률 */}
      <div style={{padding:"10px 18px 4px"}}>
        <div style={{
          padding:"11px 13px",borderRadius:7,
          background:"rgba(0,92,74,.045)",border:"1px solid rgba(0,92,74,.18)",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <span style={{fontSize:11,fontWeight:800,color:"#005c4a",fontFamily:KR}}>나의 체험 진행률</span>
            <span style={{marginLeft:"auto",fontSize:13,fontWeight:800,color:"#005c4a",fontFamily:MONO}}>
              {cnt}/{EXPS.length} <span style={{fontSize:10,color:"#255547"}}>({pct}%)</span>
            </span>
          </div>
          <div style={{height:6,borderRadius:3,background:"#ffffff",overflow:"hidden"}}>
            <div style={{
              height:"100%",width:pct+"%",borderRadius:3,
              background:"linear-gradient(90deg,#0b566a,#005c4a)",transition:"width .35s",
            }}/>
          </div>
          <div style={{fontSize:10,color:"#4a6379",fontFamily:KR,marginTop:6}}>
            {pct === 0 ? "아직 시작 전이에요. 가장 위 '입문' 카드부터 3분만 써보세요."
             : pct < 50 ? "좋은 출발입니다. 주 2개 페이스면 한 달 안에 전부 끝납니다."
             : pct < 100 ? "절반을 넘었습니다. 남은 건 대부분 실무 적용 단계예요."
             : "전 과정 완주! 이제 팀원 한 명에게 가장 유용했던 카드를 공유해 보세요."}
          </div>
        </div>
      </div>

      <SectionTitle right="난이도 순">체험 카드 {EXPS.length}종</SectionTitle>
      <div style={{padding:"0 18px 20px"}}>
        {EXPS.map((x,i)=>(
          <ExpCard key={x.id} x={x} delay={i*45} done={!!done[x.id]} onDone={toggle}/>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   🎓 나에게 꼭 필요한 주요지식
══════════════════════════════════════════════════════════════ */
const DEPTHS = [
  {k:"s30", label:"30초 요약", c:"#0f5527"},
  {k:"s3",  label:"3분 이해",  c:"#174b85"},
  {k:"s10", label:"10분 심화", c:"#5a1fb4"},
];

function KnowCard({k, delay}) {
  const [depth, setDepth] = useState("s30");
  const dc = (DEPTHS.filter(d=>d.k===depth)[0]||DEPTHS[0]).c;

  return (
    <div className="card" style={{
      animationDelay:`${delay}ms`,
      borderRadius:8,marginBottom:8,padding:"13px 14px",
      background:"rgba(15,35,55,.09)",border:"1px solid #dbe6f0",
      transition:"border-color .16s",
    }}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:9}}>
        <div style={{
          width:32,height:32,borderRadius:8,flexShrink:0,fontSize:16,
          background:"rgba(23,75,133,.07)",border:"1px solid rgba(23,75,133,.16)",
          display:"flex",alignItems:"center",justifyContent:"center",
        }}>{k.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
            {k.must && (
              <span style={{
                padding:"1px 6px",borderRadius:3,fontSize:8,fontWeight:900,fontFamily:MONO,
                background:"rgba(158,42,31,.12)",border:"1px solid rgba(158,42,31,.35)",color:"#9e2a1f",
              }}>MUST</span>
            )}
            <span style={{fontSize:13,fontWeight:700,color:"#0d2436",fontFamily:KR}}>{k.title}</span>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:9.5,color:"#4a6379",fontFamily:MONO}}>{k.role} · {k.tag}</span>
            {k.sol.map(s=><SolTag key={s} s={s}/>)}
          </div>
        </div>
      </div>

      {/* 깊이 탭 */}
      <div style={{display:"flex",gap:4,marginBottom:9}}>
        {DEPTHS.map(d=>{
          const on = depth === d.k;
          return (
            <button key={d.k} className="chip" onClick={()=>setDepth(d.k)} style={{
              padding:"3px 11px",borderRadius:4,fontSize:10,fontWeight:800,fontFamily:KR,
              border:`1px solid ${on?d.c+"55":"#c6d7e6"}`,
              background:on?d.c+"14":"transparent",
              color:on?d.c:"#4a6379",cursor:"pointer",
            }}>{d.label}</button>
          );
        })}
      </div>

      <div className="pop" key={depth} style={{
        padding:"11px 13px",borderRadius:6,
        background:"rgba(15,35,55,.12)",borderLeft:`2px solid ${dc}66`,
      }}>
        <p style={{fontSize:12.5,color:"#2f4a61",lineHeight:1.75,fontFamily:KR}}>{k[depth]}</p>
      </div>

      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:9}}>
        {k.kw.map(w=>(
          <span key={w} style={{
            padding:"1px 7px",borderRadius:3,fontSize:9.5,fontWeight:700,fontFamily:MONO,
            background:"rgba(71,85,105,.08)",border:"1px solid rgba(71,85,105,.18)",color:"#475569",
          }}>#{w}</span>
        ))}
      </div>
    </div>
  );
}

function KnowCorner() {
  const [role, setRole] = usePersist("knowRole", "전체", vIn(ROLES));
  const list = role === "전체" ? KNOWS : KNOWS.filter(k=>k.role===role);
  const musts = list.filter(k=>k.must).length;

  return (
    <div>
      <TalkBubble icon="🎓" title="전부 다 알 필요는 없습니다">
        내 역할에 <b style={{color:"#005c4a"}}>실제로 쓰이는 지식</b>만 골라 담았습니다.
        각 카드는 30초 / 3분 / 10분 세 단계로 되어 있어, 시간에 맞춰 원하는 깊이만 읽으면 됩니다.
      </TalkBubble>

      <div style={{padding:"10px 18px 2px",display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:9.5,color:"#4a6379",fontFamily:MONO,fontWeight:700,marginRight:2}}>내 역할</span>
        {ROLES.map(r=>{
          const on = role === r;
          return (
            <button key={r} className="chip" onClick={()=>setRole(r)} style={{
              padding:"4px 12px",borderRadius:15,fontSize:11,fontWeight:700,fontFamily:KR,
              border:`1px solid ${on?"rgba(0,92,74,.45)":"#c6d7e6"}`,
              background:on?"rgba(0,92,74,.1)":"transparent",
              color:on?"#005c4a":"#4a6379",cursor:"pointer",
            }}>{r}</button>
          );
        })}
      </div>

      <SectionTitle right={`MUST ${musts}건 포함`}>{role} 필수 지식 {list.length}건</SectionTitle>
      <div style={{padding:"0 18px 20px"}}>
        {list.length === 0
          ? <div style={{padding:"30px 0",textAlign:"center",fontSize:12,color:"#4a6379",fontFamily:KR}}>
              해당 역할의 카드가 아직 없습니다.
            </div>
          : list.map((k,i)=><KnowCard key={k.id} k={k} delay={i*45}/>)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ✅ 체크시사
══════════════════════════════════════════════════════════════ */
function QuizCorner({news, seed}) {
  /* 고정 문항 5개 + 뉴스 기반 문항 2개 */
  const questions = useMemo(()=>{
    const fixed = seedPick(QUIZ_POOL, 5, seed);
    const dyn = [];
    const pool = news.filter(n=>n.category && CAT[n.category]);
    for (let i = 0; i < Math.min(2, pool.length); i++) {
      const idx = (seed * 3 + i * 5) % pool.length;
      const n = pool[idx];
      const others = CATS.filter(c=>c!=="전체" && c!==n.category).slice(0,3);
      const opts = others.concat([n.category]).sort();
      dyn.push({
        q: `[오늘의 뉴스] "${n.title}" — 이 뉴스가 속한 카테고리는?`,
        opts: opts,
        a: opts.indexOf(n.category),
        why: `해당 기사의 분류는 '${n.category}'입니다. ${n.summary}`,
      });
    }
    return fixed.concat(dyn);
  },[news, seed]);

  const [picked, setPicked] = useState({});
  const [round, setRound]   = useState(0);

  /* 누적 기록 — 풀이 횟수 / 최고 정답률 / 연속 일수 */
  const [stat, setStat] = usePersist("quizStat", {plays:0, best:0, lastDate:"", streak:0}, vObj);
  const recorded = useRef(false);

  useEffect(()=>{ setPicked({}); recorded.current = false; }, [round, seed, news]);

  const pick = (qi, oi) => {
    if (picked[qi] != null) return;
    setPicked(prev => Object.assign({}, prev, {[qi]: oi}));
  };

  const answered = Object.keys(picked).length;
  const correct  = Object.keys(picked).filter(k=>picked[k] === questions[k].a).length;
  const allDone  = answered === questions.length && questions.length > 0;
  const rate     = answered ? Math.round(correct / answered * 100) : 0;

  /* 한 회차를 모두 풀면 1회만 기록 */
  useEffect(()=>{
    if (!allDone || recorded.current) return;
    recorded.current = true;
    setStat(prev=>{
      const t = dayStr(0);
      const p = vObj(prev) ? prev : {plays:0, best:0, lastDate:"", streak:0};
      const streak = p.lastDate === t        ? (p.streak || 1)
                   : p.lastDate === dayStr(-1) ? (p.streak || 0) + 1
                   : 1;
      return {
        plays: (p.plays || 0) + 1,
        best: Math.max(p.best || 0, rate),
        lastDate: t,
        streak: streak,
      };
    });
  }, [allDone, rate]);

  const grade = rate >= 90 ? {t:"AI 시사 최상위",c:"#0f5527",m:"경쟁사 동향 브리핑을 직접 맡아도 될 수준입니다."}
              : rate >= 70 ? {t:"실무 적용 가능",c:"#005c4a",m:"핵심은 잡혀 있습니다. 틀린 문항의 해설만 다시 읽어보세요."}
              : rate >= 50 ? {t:"기초 보강 필요",c:"#7a4405",m:"주요지식 코너의 MUST 카드 3건을 먼저 읽는 걸 권합니다."}
              : {t:"오늘부터 시작",c:"#9e2a1f",m:"괜찮습니다. 주요지식 30초 요약만 읽어도 다음 회차에서 확 올라갑니다."};

  return (
    <div>
      <TalkBubble icon="✅" title="오늘의 AI 시사, 얼마나 알고 계신가요">
        고정 문항 5개 + <b style={{color:"#005c4a"}}>오늘 불러온 뉴스에서 자동 생성된 문항</b>으로 구성됩니다.
        새로고침할 때마다 문항이 바뀌니 매일 한 판씩 가볍게 확인해 보세요.
      </TalkBubble>

      {/* 스코어보드 */}
      <div style={{padding:"10px 18px 4px"}}>
        <div style={{
          padding:"12px 14px",borderRadius:7,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",
          background:allDone?grade.c+"0d":"rgba(15,35,55,.09)",
          border:`1px solid ${allDone?grade.c+"33":"#dbe6f0"}`,
        }}>
          <div>
            <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:3}}>
              진행
            </div>
            <div style={{fontSize:17,fontWeight:800,color:"#0d2436",fontFamily:MONO}}>
              {answered}<span style={{fontSize:11,color:"#4a6379"}}>/{questions.length}</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:3}}>
              정답
            </div>
            <div style={{fontSize:17,fontWeight:800,color:"#005c4a",fontFamily:MONO}}>
              {correct}<span style={{fontSize:11,color:"#255547"}}>건</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px",marginBottom:3}}>
              정답률
            </div>
            <div style={{fontSize:17,fontWeight:800,color:grade.c,fontFamily:MONO}}>{rate}%</div>
          </div>

          <div style={{flex:1,minWidth:150}}>
            <div style={{height:6,borderRadius:3,background:"#ffffff",overflow:"hidden",marginBottom:6}}>
              <div style={{
                height:"100%",width:(questions.length?Math.round(answered/questions.length*100):0)+"%",
                borderRadius:3,background:"linear-gradient(90deg,#0b566a,#005c4a)",transition:"width .3s",
              }}/>
            </div>
            {allDone && (
              <div className="pop" style={{fontSize:11,color:"#3d5a72",fontFamily:KR,lineHeight:1.5}}>
                <b style={{color:grade.c}}>{grade.t}</b> — {grade.m}
              </div>
            )}
          </div>

          <button className="toggle-btn" onClick={()=>setRound(r=>r+1)} style={{
            padding:"5px 13px",borderRadius:5,fontSize:11,fontWeight:700,fontFamily:KR,
            border:"1px solid rgba(0,92,74,.28)",background:"rgba(0,92,74,.06)",
            color:"#005c4a",cursor:"pointer",
          }}>↻ 다시 풀기</button>
        </div>

        {/* 누적 기록 (저장 가능한 환경에서만) */}
        {LS.ok && stat.plays > 0 && (
          <div style={{
            marginTop:6,padding:"7px 13px",borderRadius:6,
            display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
            background:"rgba(15,35,55,.08)",border:"1px solid #dbe6f0",
          }}>
            <span style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".8px"}}>
              💾 누적 기록
            </span>
            <span style={{fontSize:10.5,color:"#3d5a72",fontFamily:MONO}}>
              풀이 <b style={{color:"#0d2436"}}>{stat.plays}</b>회
            </span>
            <span style={{fontSize:10.5,color:"#3d5a72",fontFamily:MONO}}>
              최고 정답률 <b style={{color:"#005c4a"}}>{stat.best}%</b>
            </span>
            <span style={{fontSize:10.5,color:"#3d5a72",fontFamily:MONO}}>
              연속 <b style={{color:"#7a4405"}}>{stat.streak}</b>일
            </span>
            {stat.streak >= 3 && (
              <span style={{fontSize:10,color:"#7a4405",fontFamily:KR}}>🔥 좋은 흐름입니다</span>
            )}
          </div>
        )}
      </div>

      <SectionTitle right="정답 선택 시 해설 표시">체크 문항 {questions.length}개</SectionTitle>
      <div style={{padding:"0 18px 20px"}}>
        {questions.map((q,qi)=>{
          const sel = picked[qi];
          const done = sel != null;
          const ok = done && sel === q.a;
          return (
            <div key={qi} className="card" style={{
              animationDelay:`${qi*45}ms`,
              borderRadius:8,marginBottom:9,padding:"13px 14px",
              background:done?(ok?"rgba(15,85,39,.04)":"rgba(158,42,31,.04)"):"rgba(15,35,55,.09)",
              border:`1px solid ${done?(ok?"rgba(15,85,39,.24)":"rgba(158,42,31,.24)"):"#dbe6f0"}`,
              transition:"all .2s",
            }}>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
                <span style={{
                  width:19,height:19,borderRadius:4,flexShrink:0,marginTop:1,
                  background:"rgba(0,92,74,.08)",border:"1px solid rgba(0,92,74,.2)",
                  fontSize:9.5,fontWeight:800,color:"#005c4a",fontFamily:MONO,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>Q{qi+1}</span>
                <span style={{flex:1,fontSize:12.5,fontWeight:700,color:"#0d2436",lineHeight:1.55,fontFamily:KR}}>
                  {q.q}
                </span>
              </div>

              <div style={{
                display:"grid",
                gridTemplateColumns: q.opts.length === 2 ? "1fr 1fr" : "1fr",
                gap:5,
              }}>
                {q.opts.map((o,oi)=>{
                  const isA = oi === q.a;
                  const isS = oi === sel;
                  let bg="transparent", bd="#c6d7e6", c="#3d5a72";
                  if (done) {
                    if (isA)      { bg="rgba(15,85,39,.1)";  bd="rgba(15,85,39,.42)";  c="#0f5527"; }
                    else if (isS) { bg="rgba(158,42,31,.1)"; bd="rgba(158,42,31,.42)"; c="#9e2a1f"; }
                    else          { c="#4a6379"; }
                  }
                  return (
                    <button key={oi} onClick={()=>pick(qi,oi)} disabled={done} className={done?"":"chip"} style={{
                      textAlign:"left",padding:"8px 11px",borderRadius:5,
                      fontSize:11.5,fontWeight:isS||isA&&done?700:400,fontFamily:KR,lineHeight:1.5,
                      border:`1px solid ${bd}`,background:bg,color:c,
                      cursor:done?"default":"pointer",
                    }}>
                      <span style={{fontFamily:MONO,fontSize:9.5,marginRight:6,opacity:.7}}>
                        {done ? (isA ? "○" : isS ? "×" : " ") : String.fromCharCode(65+oi)}
                      </span>
                      {o}
                    </button>
                  );
                })}
              </div>

              {done && (
                <div className="pop" style={{
                  marginTop:9,padding:"10px 12px",borderRadius:6,
                  background:"rgba(0,92,74,.04)",borderLeft:"2px solid rgba(0,92,74,.5)",
                }}>
                  <div style={{fontSize:9,color:ok?"#0f5527":"#9e2a1f",fontFamily:MONO,fontWeight:800,letterSpacing:".8px",marginBottom:4}}>
                    {ok ? "✓ 정답" : "✗ 오답"} · 해설
                  </div>
                  <p style={{fontSize:11.5,color:"#3d5a72",lineHeight:1.7,fontFamily:KR}}>{q.why}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   🌿 나노마음건강
══════════════════════════════════════════════════════════════ */
function MindCorner({seed}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);

  /* 기분·루틴은 '오늘의 기록' — 날짜와 함께 저장하고 날이 바뀌면 자동 초기화 */
  const [mind, setMind] = usePersist("mind", {date:dayStr(0), mood:null, checks:{}}, vObj);
  useEffect(()=>{
    if (mind.date !== dayStr(0)) setMind({date:dayStr(0), mood:null, checks:{}});
  }, []);

  const sameDay = mind.date === dayStr(0);
  const mood    = sameDay && Number.isInteger(mind.mood) ? mind.mood : null;
  const checks  = sameDay && vObj(mind.checks) ? mind.checks : {};
  const setMood = (v)=>setMind({date:dayStr(0), mood:v, checks:checks});

  useEffect(()=>{ setLineIdx(seed % LINES.length); }, [seed]);

  /* 호흡 타이머 — 경과 초에서 단계·잔여초를 파생시켜 중복 증가를 방지 */
  useEffect(()=>{
    if (!running) return;
    const id = setInterval(()=>setElapsed(e=>e+1), 1000);
    return ()=>clearInterval(id);
  },[running]);

  const CYCLE  = BREATH.reduce((a,b)=>a+b.s, 0);   /* 16초 */
  const rem    = elapsed % CYCLE;
  const phase  = Math.min(BREATH.length-1, Math.floor(rem / BREATH[0].s));
  const left   = BREATH[phase].s - (rem % BREATH[phase].s);
  const cycles = Math.floor(elapsed / CYCLE);

  const reset = () => { setRunning(false); setElapsed(0); };

  const cur = BREATH[phase];
  const togCheck = (t) => {
    const n = Object.assign({}, checks);
    if (n[t]) delete n[t]; else n[t] = 1;
    setMind({date:dayStr(0), mood:mood, checks:n});
  };
  const chkCnt = Object.keys(checks).length;
  const moodObj = mood != null ? MOODS[mood] : null;

  /* 마음점수 = 기분(60%) + 루틴 실천(40%) */
  const score = (mood != null ? Math.round((4 - mood) / 4 * 60) : 0) +
                Math.round(chkCnt / ROUTINE.length * 40);

  return (
    <div>
      <TalkBubble icon="🌿" title="딱 60초, 마음도 새로고침">
        업무 중 짧게 끊어 쓰는 <b style={{color:"#005c4a"}}>나노 단위 케어</b>입니다.
        호흡 1분 · 기분 체크 10초 · 루틴 5개 — 오늘 하나만 해도 충분합니다.
      </TalkBubble>

      {/* 박스 호흡 */}
      <SectionTitle right={`${cycles}회 완료`}>60초 박스 호흡 (4-4-4-4)</SectionTitle>
      <div style={{padding:"0 18px 4px"}}>
        <div style={{
          padding:"20px 14px 18px",borderRadius:8,textAlign:"center",
          background:"rgba(0,92,74,.035)",border:"1px solid rgba(0,92,74,.16)",
        }}>
          <div style={{height:150,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <div className="breath-ring" style={{
              width:104,height:104,borderRadius:"50%",
              transform:`scale(${running?cur.scale:1})`,
              background:`radial-gradient(circle,${cur.c}22,${cur.c}06)`,
              border:`2px solid ${cur.c}${running?"88":"33"}`,
              boxShadow:running?`0 0 34px ${cur.c}33`:"none",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
            }}>
              <span style={{fontSize:13,fontWeight:800,color:cur.c,fontFamily:KR}}>
                {running ? cur.t : "준비"}
              </span>
              <span style={{fontSize:22,fontWeight:800,color:"#0d2436",fontFamily:MONO,lineHeight:1}}>
                {running ? left : "—"}
              </span>
            </div>
          </div>

          <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:12}}>
            {BREATH.map((b,i)=>(
              <span key={i} style={{
                padding:"2px 9px",borderRadius:12,fontSize:9.5,fontWeight:700,fontFamily:KR,
                background:running&&phase===i?b.c+"18":"transparent",
                border:`1px solid ${running&&phase===i?b.c+"55":"#c6d7e6"}`,
                color:running&&phase===i?b.c:"#4a6379",
              }}>{b.t} {b.s}s</span>
            ))}
          </div>

          <div style={{display:"flex",gap:7,justifyContent:"center"}}>
            <button className="toggle-btn" onClick={()=>setRunning(v=>!v)} style={{
              padding:"6px 20px",borderRadius:6,fontSize:12,fontWeight:700,fontFamily:KR,
              border:`1px solid ${running?"rgba(158,42,31,.35)":"rgba(0,92,74,.4)"}`,
              background:running?"rgba(158,42,31,.07)":"rgba(0,92,74,.09)",
              color:running?"#9e2a1f":"#005c4a",cursor:"pointer",
            }}>{running?"⏸ 잠시 멈춤":"▶ 호흡 시작"}</button>
            <button className="toggle-btn" onClick={reset} style={{
              padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:700,fontFamily:KR,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>초기화</button>
          </div>

          <div style={{fontSize:10.5,color:"#4a6379",fontFamily:KR,marginTop:11,lineHeight:1.6}}>
            원의 크기에 맞춰 숨을 쉬세요. 4회(약 64초)면 심박이 눈에 띄게 안정됩니다.
            {cycles >= 4 && <b style={{color:"#005c4a"}}> 목표 달성! 오늘 몫은 충분합니다.</b>}
          </div>
        </div>
      </div>

      {/* 기분 체크 */}
      <SectionTitle right="하루 1회 권장">오늘의 기분 체크</SectionTitle>
      <div style={{padding:"0 18px 4px"}}>
        <div style={{padding:"13px 14px",borderRadius:8,background:"rgba(15,35,55,.09)",border:"1px solid #dbe6f0"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:mood!=null?11:0}}>
            {MOODS.map((m,i)=>{
              const on = mood === i;
              return (
                <button key={i} className="chip" onClick={()=>setMood(on?null:i)} style={{
                  flex:"1 1 90px",padding:"11px 6px",borderRadius:7,
                  border:`1px solid ${on?m.c+"66":"#c6d7e6"}`,
                  background:on?m.c+"12":"transparent",cursor:"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                }}>
                  <span style={{fontSize:21,filter:on?"none":"grayscale(.6) opacity(.55)"}}>{m.e}</span>
                  <span style={{fontSize:10,fontWeight:700,color:on?m.c:"#4a6379",fontFamily:KR}}>{m.t}</span>
                </button>
              );
            })}
          </div>
          {moodObj && (
            <div className="pop" style={{
              padding:"10px 12px",borderRadius:6,
              background:moodObj.c+"0d",borderLeft:`2px solid ${moodObj.c}88`,
            }}>
              <p style={{fontSize:11.5,color:"#2f4a61",lineHeight:1.68,fontFamily:KR}}>{moodObj.msg}</p>
            </div>
          )}
        </div>
      </div>

      {/* 1분 루틴 */}
      <SectionTitle right={`${chkCnt}/${ROUTINE.length} 실천`}>지금 할 수 있는 1분 루틴</SectionTitle>
      <div style={{padding:"0 18px 4px"}}>
        {ROUTINE.map((r,i)=>{
          const on = !!checks[r.t];
          return (
            <div key={r.t} className="card" onClick={()=>togCheck(r.t)} style={{
              animationDelay:`${i*40}ms`,
              display:"flex",gap:10,alignItems:"center",cursor:"pointer",
              padding:"10px 13px",marginBottom:6,borderRadius:7,
              background:on?"rgba(0,92,74,.05)":"rgba(15,35,55,.09)",
              border:`1px solid ${on?"rgba(0,92,74,.28)":"#dbe6f0"}`,
              transition:"all .18s",
            }}>
              <span style={{fontSize:16,flexShrink:0,filter:on?"none":"grayscale(.5) opacity(.7)"}}>{r.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:on?"#005c4a":"#0d2436",fontFamily:KR,marginBottom:2}}>
                  {r.t}
                </div>
                <div style={{fontSize:11,color:"#3d5a72",lineHeight:1.5,fontFamily:KR}}>{r.d}</div>
              </div>
              <span style={{
                width:19,height:19,borderRadius:4,flexShrink:0,
                border:`1px solid ${on?"rgba(0,92,74,.5)":"#c6d7e6"}`,
                background:on?"rgba(0,92,74,.14)":"transparent",
                color:"#005c4a",fontSize:11,fontWeight:800,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>{on?"✓":""}</span>
            </div>
          );
        })}
      </div>

      {/* 마음점수 + 한 줄 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.3fr",gap:12,padding:"12px 18px 22px"}}>
        <div style={{padding:"13px 14px",borderRadius:8,background:"rgba(0,92,74,.04)",border:"1px solid rgba(0,92,74,.18)"}}>
          <div style={{fontSize:9,color:"#255547",fontFamily:MONO,fontWeight:700,letterSpacing:".9px",marginBottom:6}}>
            오늘의 마음점수
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
            <span style={{fontSize:28,fontWeight:800,color:"#005c4a",fontFamily:MONO,lineHeight:1}}>{score}</span>
            <span style={{fontSize:12,color:"#255547",fontFamily:MONO}}>/100</span>
          </div>
          <div style={{height:6,borderRadius:3,background:"#ffffff",overflow:"hidden",marginBottom:7}}>
            <div style={{height:"100%",width:score+"%",borderRadius:3,
                         background:"linear-gradient(90deg,#0b566a,#005c4a)",transition:"width .35s"}}/>
          </div>
          <div style={{fontSize:10,color:"#4a6379",fontFamily:KR,lineHeight:1.55}}>
            기분 체크 60% + 루틴 실천 40%로 계산됩니다. 점수 자체보다 <b style={{color:"#005c4a"}}>매일 재는 습관</b>이 중요합니다.
            {LS.ok && <> 오늘({mind.date}) 기록은 저장되며 날짜가 바뀌면 자동으로 초기화됩니다.</>}
          </div>
        </div>

        <div style={{
          padding:"13px 14px",borderRadius:8,display:"flex",flexDirection:"column",
          background:"rgba(15,35,55,.09)",border:"1px solid #dbe6f0",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:9,color:"#4a6379",fontFamily:MONO,fontWeight:700,letterSpacing:".9px"}}>
              오늘의 마음 한 줄
            </span>
            <button className="toggle-btn" onClick={()=>setLineIdx(i=>(i+1)%LINES.length)} style={{
              marginLeft:"auto",padding:"2px 9px",borderRadius:4,fontSize:9.5,fontWeight:700,fontFamily:MONO,
              border:"1px solid #c6d7e6",background:"transparent",color:"#4a6379",cursor:"pointer",
            }}>↻ 다른 문장</button>
          </div>
          <div className="pop" key={lineIdx} style={{
            flex:1,display:"flex",alignItems:"center",
            padding:"12px 14px",borderRadius:6,
            background:"rgba(90,31,180,.05)",borderLeft:"2px solid rgba(90,31,180,.5)",
          }}>
            <p style={{fontSize:13,color:"#22394d",lineHeight:1.75,fontFamily:KR,fontWeight:500}}>
              “{LINES[lineIdx]}”
            </p>
          </div>
          <div style={{fontSize:9.5,color:"#43596d",fontFamily:KR,marginTop:8,lineHeight:1.55}}>
            ※ 본 코너는 일반적인 self-care 정보이며 의학적 진단·치료를 대체하지 않습니다.
            지속적인 어려움이 있다면 전문가 상담을 권합니다.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   범례
══════════════════════════════════════════════════════════════ */
function Legend() {
  return (
    <div style={{padding:"10px 12px",background:"rgba(15,35,55,.10)",borderRadius:6,border:"1px solid #dbe6f0"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:7,flexWrap:"nowrap",overflowX:"auto"}}>
        <span style={{fontSize:9.5,color:"#43596d",fontFamily:MONO,fontWeight:700,flexShrink:0}}>솔루션</span>
        {Object.keys(SOL).map(s=><SolTag key={s} s={s}/>)}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"nowrap",overflowX:"auto"}}>
        <span style={{fontSize:9.5,color:"#43596d",fontFamily:MONO,fontWeight:700,flexShrink:0}}>중요도</span>
        {Object.keys(IMP).map(k=>{
          const v = IMP[k];
          return <span key={k} style={{padding:"1px 7px",borderRadius:3,fontSize:9.5,fontWeight:800,background:v.bg,border:`1px solid ${v.bd}`,color:v.c,fontFamily:MONO,flexShrink:0}}>{v.label}</span>;
        })}
        <span style={{fontSize:9.5,color:"#43596d",fontFamily:MONO,fontWeight:700,flexShrink:0,marginLeft:8}}>우선순위</span>
        {Object.keys(PRI).map(k=>(
          <span key={k} style={{fontSize:9.5,fontWeight:800,color:PRI[k].c,fontFamily:MONO,flexShrink:0}}>{k}</span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   메인 앱
══════════════════════════════════════════════════════════════ */
export default function App() {
  /* 뉴스 */
  const [news,   setNews]  = useState([]);
  const [loading,setLoad]  = useState(false);
  const [cat,    setCat]   = usePersist("cat", "전체", vIn(CATS));
  const [mode,   setMode]  = useState("");
  const [updAt,  setUpdAt] = useState("");
  const [n,      setN]     = useState(0);
  const [step,   setStep]  = useState(0);

  /* 코너 — 마지막으로 본 코너 저장 */
  const [nav, setNav] = usePersist("nav", "news", vIn(NAVS.map(v=>v.k)));

  /* 스케줄 — 전부 localStorage에 저장 */
  const [showSched, setShowSched] = useState(false);
  const [daily,  setDaily]  = usePersist("daily", false, vBool);
  const [times,  setTimes]  = usePersist("times", ["08:30","13:00","18:00"], vTimes);
  const [days,   setDays]   = usePersist("days", [1,2,3,4,5], vDays);
  const [auto,   setAuto]   = usePersist("auto", false, vBool);
  const [interval_, setInterval_] = usePersist("interval", 60, vIntv);
  const [resetSeq, setResetSeq]   = useState(0);
  const [cd,     setCd]     = useState(60);
  const [nextRun,setNextRun]= useState(null);
  const [now,    setNow]    = useState(Date.now());
  const [lastAuto,setLastAuto] = usePersist("lastAuto", "", vStr);

  const catRef   = useRef(cat);
  const timerRef = useRef(null);
  const nextRef  = useRef(null);
  useEffect(()=>{ catRef.current = cat; },[cat]);
  useEffect(()=>{ nextRef.current = nextRun; },[nextRun]);

  /* 로딩 단계 순환 */
  useEffect(()=>{
    if(!loading){ setStep(0); return; }
    const id = setInterval(()=>setStep(s=>(s+1)%STEPS.length), 950);
    return ()=>clearInterval(id);
  },[loading]);

  /* fetch */
  const doFetch = useCallback(async(target)=>{
    setLoad(true); setNews([]);
    const q = target!=="전체" ? ` (${target} 카테고리 위주로)` : "";
    try{
      if(!NET) throw new Error("offline");   /* 아티팩트 빌드 — 데모 폴백으로 직행 */
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1600,
          messages:[{role:"user",content:
`최신 글로벌 AI 뉴스${q} 8개 생성. 더존비즈온 솔루션(A10,WEHAGO,OmniEsol,FoEX,NSM10,iCUBE) 전략분석 포함. JSON만:
{"news":[{"id":1,"title":"한글제목","source":"도메인.com","summary":"2문장요약","points":숫자,"time":"X시간 전","category":"AI 모델|AI 에이전트|AI 인프라|AI 비즈니스|AI 규제","analysis":{"solutions":["A10"],"importance":"high|medium|low","direction":"활용방향 1~2문장","priority":"즉시검토|단기검토|중장기검토|모니터링"}}]}`
          }],
        }),
      });
      if(res.ok){
        const data = await res.json();
        const parsed = parseJSON(data.content?.[0]?.text||"");
        if(parsed?.news?.length){
          setNews(parsed.news); setMode("ai");
          setUpdAt(new Date().toLocaleTimeString("ko-KR")); setN(v=>v+1);
          setLoad(false); return;
        }
      }
      throw new Error("fb");
    }catch(_){
      const list = target==="전체" ? DEMO : DEMO.filter(d=>d.category===target);
      setNews(list.length?list:DEMO); setMode("demo");
      setUpdAt(new Date().toLocaleTimeString("ko-KR")); setN(v=>v+1);
    }
    setLoad(false);
  },[]);

  /* 최초 로드 — 저장된 카테고리로 시작 */
  useEffect(()=>{ doFetch(catRef.current); },[]);

  /* ════════════════════════════════════════════════════════════
     서버 동기화
  ════════════════════════════════════════════════════════════ */
  const [syncUrl,  setSyncUrl]  = usePersist("syncUrl", "", vStr);
  const [syncCode, setSyncCode] = usePersist("syncCode", "", vStr);
  const [syncRev,  setSyncRev]  = usePersist("syncRev", 0, (v)=>Number.isInteger(v) && v >= 0);
  const [syncStatus, setSyncStatus] = useState("off");
  const [syncAt,   setSyncAt]   = useState("");
  const [syncNote, setSyncNote] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const lastPushed = useRef(null);   /* 마지막으로 서버와 일치시킨 직렬화 값 */
  const revRef     = useRef(syncRev);
  const inFlight   = useRef(false);
  useEffect(()=>{ revRef.current = syncRev; },[syncRev]);

  const note = useCallback((msg, bad)=>{
    setSyncNote({msg:msg, bad:!!bad});
    setTimeout(()=>setSyncNote(null), 6000);
  },[]);

  /* 현재 설정 한 벌을 모은다 — 코너 값은 localStorage에서 읽는다 */
  const collect = useCallback(()=>({
    daily:daily, times:times, days:days, auto:auto, interval:interval_,
    nav:nav, cat:cat, lastAuto:lastAuto,
    expDone:  LS.get("expDone",  {}, vObj),
    knowRole: LS.get("knowRole", "전체", vIn(ROLES)),
    mind:     LS.get("mind",     null, vObj),
    quizStat: LS.get("quizStat", null, vObj),
  }),[daily,times,days,auto,interval_,nav,cat,lastAuto]);

  /* 서버에서 받은 설정을 적용 — 항목마다 검증해 손상된 값은 무시한다 */
  const apply = useCallback((p)=>{
    if (!vObj(p)) return;
    if (vBool(p.daily))     setDaily(p.daily);
    if (vTimes(p.times))    setTimes(p.times);
    if (vDays(p.days))      setDays(p.days);
    if (vBool(p.auto))      setAuto(p.auto);
    if (vIntv(p.interval))  setInterval_(p.interval);
    if (vIn(NAVS.map(v=>v.k))(p.nav)) setNav(p.nav);
    if (vIn(CATS)(p.cat))   setCat(p.cat);
    if (vStr(p.lastAuto))   setLastAuto(p.lastAuto);
    if (vObj(p.expDone))    LS.set("expDone", p.expDone);
    if (vIn(ROLES)(p.knowRole)) LS.set("knowRole", p.knowRole);
    if (vObj(p.mind))       LS.set("mind", p.mind);
    if (vObj(p.quizStat))   LS.set("quizStat", p.quizStat);
    setResetSeq(s=>s+1);    /* 코너를 리마운트해 저장값을 다시 읽게 한다 */
  },[]);

  const markSynced = useCallback((body)=>{
    setSyncRev(body.rev); revRef.current = body.rev;
    setSyncAt(new Date().toLocaleTimeString("ko-KR"));
    setSyncStatus("ok");
  },[]);

  /* 서버 → 로컬 */
  const pull = useCallback(async(code, url)=>{
    const res = await syncFetch(joinUrl(url, "/api/sync/" + code));
    if (res.netError) { setSyncStatus("offline"); return null; }
    if (res.status === 404) { setSyncStatus("error"); return {missing:true}; }
    if (!res.ok || !res.body) { setSyncStatus("error"); return null; }
    apply(res.body.settings);
    lastPushed.current = JSON.stringify(res.body.settings);
    markSynced(res.body);
    return res.body;
  },[apply, markSynced]);

  /* 로컬 → 서버 (rev 불일치면 서버 쪽을 받아온다) */
  const push = useCallback(async(payload, serialized)=>{
    if (!syncCode || !syncUrl || inFlight.current) return;
    inFlight.current = true;
    setSyncStatus("syncing");
    const res = await syncFetch(joinUrl(syncUrl, "/api/sync/" + syncCode), {
      method:"PUT",
      body: JSON.stringify({settings:payload, baseRev:revRef.current || null}),
    });
    inFlight.current = false;

    if (res.netError) { setSyncStatus("offline"); return; }

    if (res.status === 409) {
      const srv = res.body && res.body.detail && res.body.detail.server;
      if (srv) {
        apply(srv.settings);
        lastPushed.current = JSON.stringify(srv.settings);
        markSynced(srv);
        note("다른 기기에서 더 최근에 저장한 설정을 받아왔습니다.");
      } else { setSyncStatus("error"); }
      return;
    }
    if (res.status === 404) {
      setSyncStatus("error");
      note("서버에 이 코드가 없습니다. 삭제됐거나 다른 서버일 수 있습니다.", true);
      return;
    }
    if (res.status === 413) {
      setSyncStatus("error");
      note("설정 크기가 서버 한도를 넘었습니다.", true);
      return;
    }
    if (!res.ok || !res.body) { setSyncStatus("error"); return; }

    lastPushed.current = serialized;
    markSynced(res.body);
  },[syncCode, syncUrl, apply, markSynced, note]);

  /* 코드 발급 */
  const issueCode = useCallback(async()=>{
    if (!syncUrl) return;
    setSyncBusy(true); setSyncStatus("syncing");
    const payload = collect();
    const res = await syncFetch(joinUrl(syncUrl, "/api/sync"), {
      method:"POST", body:JSON.stringify({settings:payload}),
    });
    setSyncBusy(false);

    if (res.netError) { setSyncStatus("offline"); note("서버에 연결하지 못했습니다. 주소를 확인해 주세요.", true); return; }
    if (!res.ok || !res.body || !res.body.code) { setSyncStatus("error"); note("코드 발급에 실패했습니다.", true); return; }

    setSyncCode(res.body.code);
    lastPushed.current = JSON.stringify(payload);
    markSynced(res.body);
    note("동기화 코드가 발급됐습니다. 다른 기기에서 이 코드를 입력하세요.");
  },[syncUrl, collect, markSynced, note]);

  /* 코드로 연결 */
  const connectCode = useCallback(async(code)=>{
    if (!syncUrl) return;
    setSyncBusy(true); setSyncStatus("syncing");
    const res = await pull(code, syncUrl);
    setSyncBusy(false);

    if (res && res.missing) { note("해당 코드를 찾을 수 없습니다. 다시 확인해 주세요.", true); return; }
    if (!res) { note("서버에 연결하지 못했습니다.", true); return; }
    setSyncCode(code);
    note("연결됐습니다. 서버의 설정을 받아왔습니다.");
  },[syncUrl, pull, note]);

  const pushNow      = useCallback(()=>{ const p = collect(); push(p, JSON.stringify(p)); },[collect, push]);
  const disconnect   = useCallback(()=>{
    setSyncCode(""); setSyncRev(0); revRef.current = 0;
    lastPushed.current = null; setSyncStatus("off"); setSyncAt("");
    note("이 기기에서 연결을 해제했습니다. 서버 데이터는 그대로입니다.");
  },[note]);

  const deleteRemote = useCallback(async()=>{
    if (!syncCode || !syncUrl) return;
    setSyncBusy(true);
    const res = await syncFetch(joinUrl(syncUrl, "/api/sync/" + syncCode), {method:"DELETE"});
    setSyncBusy(false);
    if (res.netError) { note("서버에 연결하지 못했습니다.", true); return; }
    setSyncCode(""); setSyncRev(0); revRef.current = 0;
    lastPushed.current = null; setSyncStatus("off"); setSyncAt("");
    note(res.ok ? "서버에서 삭제했습니다." : "이미 삭제된 코드입니다.");
  },[syncCode, syncUrl, note]);

  /* 연결 중이면 주기적으로 변경을 감지해 올린다 */
  useEffect(()=>{
    if (!syncCode || !syncUrl) { setSyncStatus("off"); return; }
    let alive = true;

    /* 연결 직후 1회 내려받아 다른 기기의 변경을 먼저 반영 */
    (async()=>{
      if (lastPushed.current === null) await pull(syncCode, syncUrl);
    })();

    const id = setInterval(()=>{
      if (!alive || inFlight.current) return;
      const p = collect();
      const s = JSON.stringify(p);
      if (s !== lastPushed.current) push(p, s);
    }, SYNC_POLL_MS);

    return ()=>{ alive = false; clearInterval(id); };
  },[syncCode, syncUrl, collect, push, pull]);

  /* 저장된 설정 전체 초기화 */
  const resetAll = useCallback(()=>{
    LS.clear();
    setDaily(false); setTimes(["08:30","13:00","18:00"]); setDays([1,2,3,4,5]);
    setAuto(false); setInterval_(60); setLastAuto("");
    setNav("news"); setCat("전체");
    /* 동기화 연결도 이 기기에서 끊는다 (서버 데이터는 건드리지 않는다) */
    setSyncUrl(""); setSyncCode(""); setSyncRev(0);
    revRef.current = 0; lastPushed.current = null;
    setSyncStatus("off"); setSyncAt("");
    setResetSeq(s=>s+1);   /* 코너 컴포넌트를 리마운트해 내부 저장값까지 비운다 */
  },[]);

  /* ── 주기 반복 갱신 ── */
  useEffect(()=>{
    clearInterval(timerRef.current);
    if(!auto){ setCd(interval_); return; }
    setCd(interval_);
    timerRef.current = setInterval(()=>{
      setCd(prev=>{
        if(prev<=1){ doFetch(catRef.current); setLastAuto(new Date().toLocaleTimeString("ko-KR")); return interval_; }
        return prev-1;
      });
    },1000);
    return ()=>clearInterval(timerRef.current);
  },[auto, interval_, doFetch]);

  /* ── 매일 예약 갱신 : 1초 틱으로 시각 도달 감시 ──
     예약이 꺼져 있고 설정 패널도 닫혀 있으면 틱을 돌리지 않는다(불필요한 전체 리렌더 방지) */
  useEffect(()=>{
    if (!daily && !showSched) return;
    const id = setInterval(()=>{
      const t = Date.now();
      setNow(t);
      const nr = nextRef.current;
      if (nr != null && t >= nr) {
        doFetch(catRef.current);
        setLastAuto(new Date().toLocaleTimeString("ko-KR"));
        const nn = calcNextRun(times, days, t + 1000);
        nextRef.current = nn;
        setNextRun(nn);
      }
    },1000);
    return ()=>clearInterval(id);
  },[daily, showSched, times, days, doFetch]);

  /* 스케줄 변경 시 다음 실행 재계산 */
  useEffect(()=>{
    if(!daily){ setNextRun(null); nextRef.current = null; return; }
    const nn = calcNextRun(times, days, Date.now());
    setNextRun(nn); nextRef.current = nn;
  },[daily, times, days]);

  /* 카테고리 필터 */
  const filterCat = (c)=>{ setCat(c); setNav("news"); doFetch(c); };

  const isAI = mode==="ai";
  const cur  = STEPS[step%STEPS.length];
  const dotC = loading?"#7a4405":isAI?"#005c4a":"#475569";
  const navObj = NAVS.filter(v=>v.k===nav)[0] || NAVS[0];
  const schedOn = daily || auto;

  return(
    <>
      <style>{CSS}</style>
      <div style={{minHeight:EMBED?undefined:"100vh",background:"#eef4fa",color:"#0d2436",fontFamily:KR}}>

        {/* ── 헤더 ── */}
        <header style={{background:"#ffffff",borderBottom:"1px solid #dbe6f0",minHeight:52,padding:"7px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(0,92,74,.06),0 4px 16px rgba(15,35,55,.16)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:29,height:29,borderRadius:6,flexShrink:0,background:"linear-gradient(135deg,#005c4a,#0b566a)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:MONO,fontWeight:900,fontSize:10.5,color:"#eef4fa",letterSpacing:"-1px",animation:"glow 3s ease-in-out infinite"}}>DZ</div>
            <div style={{lineHeight:1.2}}>
              <div style={{fontSize:13.5,fontWeight:800,color:"#0d2436",letterSpacing:"-.3px"}}>AI 글로벌 뉴스 톡</div>
              <div style={{fontSize:8.5,color:"#43596d",letterSpacing:"1px",fontFamily:MONO}}>DOUZONE BIZON · STRATEGIC AI TALK</div>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            {updAt&&<span style={{fontSize:9.5,color:"#43596d",fontFamily:MONO}}>{updAt} #{n}</span>}

            {/* 스케줄 열기 버튼 */}
            <button className="auto-btn" onClick={()=>setShowSched(v=>!v)} style={{
              padding:"4px 11px",borderRadius:5,fontFamily:MONO,fontSize:10,fontWeight:700,cursor:"pointer",
              border:`1px solid ${schedOn?"rgba(0,92,74,.4)":"rgba(71,85,105,.18)"}`,
              background:schedOn?"rgba(0,92,74,.08)":"transparent",
              color:schedOn?"#005c4a":"#4a6379",
              display:"flex",alignItems:"center",gap:5,
            }}>
              <span>⏰</span>
              {daily && nextRun!=null
                ? <span>{fmtLeft(nextRun-now)}</span>
                : auto ? <span>{cd}s</span> : <span>시간설정</span>}
              <span style={{opacity:.6}}>{showSched?"▲":"▼"}</span>
            </button>

            <LiveBtn loading={loading} stepIdx={step} onClick={()=>doFetch(cat)} label={isAI?"↻ 새로고침":"⚡ 빠른 검색"} ai={isAI}/>
          </div>
        </header>

        {/* ── 스케줄 패널 ── */}
        {showSched && (
          <SchedulePanel
            daily={daily} setDaily={setDaily}
            times={times} setTimes={setTimes}
            days={days} setDays={setDays}
            auto={auto} setAuto={setAuto}
            interval={interval_} setInterval_={setInterval_}
            nextRun={nextRun} now={now} lastAuto={lastAuto}
            onReset={resetAll}
            onClose={()=>setShowSched(false)}
          >
            <SyncPanel
              url={syncUrl} setUrl={setSyncUrl}
              code={syncCode} status={syncStatus} lastSyncAt={syncAt}
              rev={syncRev} note={syncNote} busy={syncBusy}
              onIssue={issueCode} onConnect={connectCode} onPushNow={pushNow}
              onDisconnect={disconnect} onDeleteRemote={deleteRemote}
            />
          </SchedulePanel>
        )}

        {/* ── 코너 네비 ── */}
        <nav style={{background:"#ffffff",borderBottom:"1px solid #dbe6f0",padding:"0 18px",display:"flex",overflowX:"auto",gap:2}}>
          {NAVS.map(v=>{
            const on = nav===v.k;
            return (
              <button key={v.k} className="nav-tab" onClick={()=>setNav(v.k)} style={{
                padding:"10px 13px",border:"none",background:"transparent",
                borderBottom:on?"2px solid #005c4a":"2px solid transparent",
                color:on?"#005c4a":"#4a6379",fontSize:12,fontWeight:on?800:500,
                whiteSpace:"nowrap",fontFamily:KR,cursor:"pointer",
                display:"flex",alignItems:"center",gap:5,
              }}>
                <span style={{fontSize:12.5}}>{v.icon}</span>{v.label}
              </button>
            );
          })}
        </nav>

        {/* ── 뉴스 카테고리 탭 (뉴스/핫 코너에서만) ── */}
        {(nav==="news"||nav==="hot") && (
          <nav style={{background:"rgba(255,255,255,.6)",borderBottom:"1px solid #dbe6f0",padding:"0 18px",display:"flex",overflowX:"auto"}}>
            {CATS.map(c=>(
              <button key={c} className="cat-tab" onClick={()=>{setCat(c);doFetch(c);}} style={{
                padding:"7px 12px",border:"none",background:"transparent",
                borderBottom:cat===c?"2px solid rgba(0,92,74,.55)":"2px solid transparent",
                color:cat===c?"#005c4a":"#4a6379",fontSize:11,fontWeight:cat===c?700:400,
                whiteSpace:"nowrap",fontFamily:KR,cursor:"pointer",
              }}>{c}</button>
            ))}
          </nav>
        )}

        {/* ── 상태 바 ── */}
        <div style={{padding:"6px 18px",borderBottom:"1px solid #dbe6f0",background:"rgba(0,92,74,.014)",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,display:"inline-block",background:dotC,boxShadow:loading||isAI?`0 0 6px ${dotC}`:"none",animation:loading?"blink 1s infinite":"none"}}/>
          <span style={{fontSize:10.5,color:"#4a6379",fontFamily:MONO}}>
            {loading?`${cur.e} ${cur.t}...`:`${navObj.icon} ${navObj.label} · ${news.length}건 · ${isAI?"Claude AI 실시간 생성":"내장 데모 데이터"} · #${n}`}
          </span>
          {!loading&&(
            <span style={{fontSize:8,padding:"1px 6px",borderRadius:2,fontWeight:900,letterSpacing:"1px",fontFamily:MONO,background:isAI?"rgba(0,92,74,.07)":"rgba(122,68,5,.07)",border:`1px solid ${isAI?"rgba(0,92,74,.18)":"rgba(122,68,5,.2)"}`,color:isAI?"#005c4a":"#7a4405"}}>
              {isAI?"AI LIVE":"DEMO"}
            </span>
          )}
          {daily&&nextRun!=null&&(
            <span style={{fontSize:10,color:"#005c4a",fontFamily:MONO}}>· 📅 {fmtWhen(nextRun)} 자동갱신</span>
          )}
          {auto&&!loading&&<span style={{fontSize:10,color:"#174b85",fontFamily:MONO}}>· ⏱ {cd}s 후 갱신</span>}
          {syncCode&&(
            <span style={{fontSize:10,color:(SYNC_STATE[syncStatus]||SYNC_STATE.off).c,fontFamily:MONO}}>
              · ☁️ {(SYNC_STATE[syncStatus]||SYNC_STATE.off).t}
            </span>
          )}
          {!loading&&(
            <span style={{fontSize:10,color:"#4a6379",fontFamily:MONO,marginLeft:"auto"}}>
              💡 {navObj.desc}
            </span>
          )}
        </div>

        {/* ── 메인 ── */}
        <main style={{maxWidth:880,margin:"0 auto"}}>
          {loading&&(
            <div style={{padding:"56px 20px",textAlign:"center"}}>
              <div style={{width:34,height:34,margin:"0 auto 14px",border:"2px solid #dbe6f0",borderTop:"2px solid #005c4a",borderRadius:"50%",animation:"spin .85s linear infinite"}}/>
              <div style={{fontSize:13,color:"#4a6379",marginBottom:4,animation:"blink 1s infinite",fontFamily:KR}}>{cur.e} {cur.t}...</div>
              <div style={{fontSize:10.5,color:"#43596d",fontFamily:MONO}}>더존비즈온 솔루션 전략분석 생성 중</div>
            </div>
          )}

          {!loading && nav==="news" && (
            <>
              <TalkBubble icon="📰" title={`${cat} AI 뉴스 ${news.length}건을 정리했어요`}>
                제목을 누르면 구글 뉴스 검색, 카테고리 뱃지를 누르면 필터가 걸립니다.
                각 기사의 <b style={{color:"#005c4a"}}>DZ전략분석</b>을 열면 연관 솔루션·중요도·대응 우선순위를 볼 수 있습니다.
              </TalkBubble>
              {news.map((item,i)=>(
                <Item key={item.id??i} item={item} rank={i+1} delay={i*50} onCatClick={filterCat}/>
              ))}
              {news.length>0&&(
                <div style={{padding:"12px 18px",borderTop:"1px solid #dbe6f0"}}>
                  <Legend/>
                </div>
              )}
            </>
          )}

          {!loading && nav==="hot"  && <HotCorner news={news} onCatClick={filterCat}/>}
          {!loading && nav==="exp"  && <ExpCorner key={resetSeq}/>}
          {!loading && nav==="know" && <KnowCorner key={resetSeq}/>}
          {!loading && nav==="quiz" && <QuizCorner key={resetSeq} news={news} seed={n}/>}
          {!loading && nav==="mind" && <MindCorner key={resetSeq} seed={n}/>}

          {!loading && (
            <div style={{textAlign:"center",padding:"6px 18px 22px",fontSize:9.5,color:"#43596d",letterSpacing:".4px",fontFamily:MONO}}>
              AI 생성 콘텐츠 · 더존비즈온 전략분석은 내부 검토 참고용 · 공식 입장 아님 | v7.0
            </div>
          )}
        </main>
      </div>
    </>
  );
}
