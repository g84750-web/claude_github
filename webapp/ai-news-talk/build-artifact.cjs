/* AiNewsTalk.jsx → 자체 완결형 아티팩트 HTML 빌드
   변환은 전부 기계적이며 저장소의 JSX 원본은 건드리지 않는다.
     ① import/export 제거 → 전역 React에서 훅 구조분해
     ② 구글 폰트 @import 제거 (아티팩트 CSP가 외부 호스트를 차단)
     ③ 폰트 스택 확장 (웹폰트 없이도 한글·모노가 제대로 잡히도록)
     ④ NET 플래그 off → 외부 요청을 아예 보내지 않는다
*/
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const ROOT = "/home/user/claude_github";
const SRC = path.join(ROOT, "webapp/ai-news-talk/AiNewsTalk.jsx");
const OUT = process.argv[2];

let src = fs.readFileSync(SRC, "utf8");
const before = src.length;

// ① 모듈 구문 제거
const importLine = 'import { useState, useEffect, useCallback, useRef, useMemo } from "react";';
if (!src.includes(importLine)) throw new Error("import 구문을 찾지 못했습니다");
src = src.replace(importLine, "const { useState, useEffect, useCallback, useRef, useMemo } = React;");

if (!src.includes("export default function App()")) throw new Error("export default를 찾지 못했습니다");
src = src.replace("export default function App()", "function App()");

// ② 외부 폰트 요청 제거
const fontImport = src.match(/^\s*@import url\('https:\/\/fonts\.googleapis\.com[^\n]*\n/m);
if (!fontImport) throw new Error("폰트 @import를 찾지 못했습니다");
src = src.replace(fontImport[0], "");

// ③ 폰트 스택 확장
const krOld = `const KR   = "'Noto Sans KR','Apple SD Gothic Neo',sans-serif";`;
const monoOld = `const MONO = "'JetBrains Mono','Courier New',monospace";`;
if (!src.includes(krOld) || !src.includes(monoOld)) throw new Error("폰트 상수를 찾지 못했습니다");
src = src.replace(krOld,
  `const KR   = "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',system-ui,sans-serif";`);
src = src.replace(monoOld,
  `const MONO = "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,'Courier New',monospace";`);

// ④ 네트워크 차단 — CSP 거부 로그는 브라우저가 직접 찍어 try/catch로 못 막으므로
//    요청 자체를 보내지 않는다. 뉴스는 데모, 동기화는 오프라인 경로로 떨어진다.
const netOn = "const NET = true;";
if (!src.includes(netOn)) throw new Error("NET 플래그를 찾지 못했습니다");
src = src.replace(netOn, "const NET = false;");

// JSX → JS (classic runtime: React.createElement 사용)
const compiled = babel.transformSync(src, {
  presets: [["@babel/preset-react", { runtime: "classic" }]],
  filename: "AiNewsTalk.jsx",
  compact: false,
}).code;

const react = fs.readFileSync(path.join(ROOT, "node_modules/react/umd/react.production.min.js"), "utf8");
const reactDom = fs.readFileSync(path.join(ROOT, "node_modules/react-dom/umd/react-dom.production.min.js"), "utf8");

const html = `<title>AI 글로벌 뉴스 톡 — DZ 전략 인텔리전스</title>
<style>
  :root { color-scheme: dark; }
  html, body { background: #010b16; margin: 0; padding: 0; }

  /* 아티팩트 환경 안내 — 앱 본체가 아니라 껍데기에 둔다 */
  .env-note {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 7px 18px;
    background: rgba(251,191,36,.055);
    border-bottom: 1px solid rgba(251,191,36,.16);
    font-family: 'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;
    font-size: 11.5px; line-height: 1.55; color: #a58a4a;
  }
  .env-note b { color: #fbbf24; font-weight: 700; }
  .env-note code {
    font-family: 'JetBrains Mono',Menlo,Consolas,'Courier New',monospace;
    font-size: 10.5px; color: #c9a95a;
    background: rgba(251,191,36,.08); border-radius: 3px; padding: 1px 5px;
  }
  .env-note button {
    margin-left: auto; flex-shrink: 0; cursor: pointer;
    padding: 2px 10px; border-radius: 4px;
    border: 1px solid rgba(251,191,36,.28);
    background: transparent; color: #a58a4a;
    font-family: inherit; font-size: 10.5px; font-weight: 700;
    transition: background .15s, color .15s;
  }
  .env-note button:hover { background: rgba(251,191,36,.1); color: #fbbf24; }
  .env-note button:focus-visible { outline: 2px solid #fbbf24; outline-offset: 2px; }
  .env-note[hidden] { display: none; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important; animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
</style>

<div class="env-note" id="envNote">
  <span>
    <b>미리보기 안내</b> — 이 페이지는 외부 네트워크가 차단된 환경에서 실행됩니다.
    뉴스는 <b>내장 데모 데이터 8건</b>으로 표시되며(상태 바 <code>DEMO</code> 배지),
    <b>서버 동기화</b>도 연결되지 않습니다. 그 외 시간설정·6개 코너·브라우저 저장은 모두 정상 동작합니다.
  </span>
  <button type="button" id="envClose">닫기</button>
</div>

<div id="root"></div>

<script>${react}</script>
<script>${reactDom}</script>
<script>
${compiled}

document.getElementById("envClose").addEventListener("click", function () {
  document.getElementById("envNote").hidden = true;
});

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
</script>
`;

fs.writeFileSync(OUT, html);
console.log("원본 JSX  : " + Math.round(before / 1024) + "KB");
console.log("변환 JS   : " + Math.round(compiled.length / 1024) + "KB");
console.log("React UMD : " + Math.round((react.length + reactDom.length) / 1024) + "KB");
console.log("산출 HTML : " + Math.round(html.length / 1024) + "KB → " + OUT);
