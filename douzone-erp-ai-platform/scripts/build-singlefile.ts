/**
 * dist/ 빌드 결과를 단일 HTML 로 인라인한다.
 *
 * 용도: 정적 호스팅 없이 파일 하나로 배포·공유하기 위한 산출물.
 * 절대 제약 1(외부 CDN 금지)과 같은 방향이므로 별도 예외가 필요 없다 —
 * 번들에 외부 참조가 남아 있으면 이 스크립트가 실패한다.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const assets = resolve(dist, 'assets');

const files = readdirSync(assets);
const jsName = files.find((f) => f.endsWith('.js'));
const cssName = files.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) throw new Error('dist/assets 에서 js/css 를 찾지 못했습니다. npm run build 를 먼저 실행하세요.');

const js = readFileSync(resolve(assets, jsName), 'utf8');
const css = readFileSync(resolve(assets, cssName), 'utf8');

/*
 * 단일 파일을 깨뜨리는 것은 "문자열 안의 URL" 이 아니라 "실제로 로드되는 하위 자원" 이다.
 * 오류 안내 링크(react·zustand)나 사용자가 키를 넣어야 비로소 호출되는 API 엔드포인트는
 * 렌더에 영향을 주지 않으므로, 자산 로드 형태만 검사한다.
 */
const SUBRESOURCE_PATTERNS: Array<[string, RegExp]> = [
  ['css', /url\(\s*['"]?https?:\/\//gi],
  ['css', /@import\s+(url\()?\s*['"]?https?:\/\//gi],
  ['js', /\.(?:src|href)\s*=\s*['"`]https?:\/\//gi],
  ['js', /<(?:script|link|img)\b[^>]*\b(?:src|href)=["']https?:\/\//gi],
];

for (const [label, re] of SUBRESOURCE_PATTERNS) {
  const hit = (label === 'css' ? css : js).match(re);
  if (hit) {
    throw new Error(
      `${label} 번들이 외부 자산을 로드합니다 (절대 제약 1 위반): ${[...new Set(hit)].join(', ')}`
    );
  }
}

// 인라인 시 조기 종료를 막는다
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const safeCss = css.replace(/<\/style/gi, '<\\/style');

const title = '더존비즈온 ERP AI 자동화 플랫폼';

const html = `<title>${title}</title>
<style>
${safeCss}
/* 단일 파일 배포 시 래퍼 여백이 붙어도 전체 화면을 유지한다 */
html, body { margin: 0; padding: 0; max-width: none; height: 100%; overflow: hidden; }
#root { height: 100%; }
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

const out = resolve(dist, 'standalone.html');
writeFileSync(out, html, 'utf8');
console.log(`단일 파일 생성 — ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} kB)`);
