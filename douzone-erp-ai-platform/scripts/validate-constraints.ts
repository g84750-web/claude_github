/**
 * 절대 제약사항 정적 검증 스크립트 (설계서 0.2 / 10.2)
 *
 *  1. 외부 CDN 링크 금지 (Anthropic API 엔드포인트만 예외)
 *  2. localStorage 사용 금지 — sessionStorage 전용
 *  3. 날짜 하드코딩 금지 — 법령 발행일/시행일(data/laws.ts) 만 예외
 *  4. 단계명 한자 혼용 금지 (分析 / 析 / 安定)
 *  5. API Key 하드코딩·로그 노출 금지
 *
 * 실행: npm run validate:constraints
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCAN_DIRS = ['src'];
const SCAN_FILES = ['index.html', 'vite.config.ts'];
const EXTS = new Set(['.ts', '.tsx', '.css', '.html']);

/** 날짜 리터럴이 데이터로서 정당한 파일 (법령 발행일·시행일) */
const DATE_LITERAL_ALLOW = ['src/data/laws.ts'];

/** 허용 외부 호스트 — Anthropic Messages API 만 */
const ALLOWED_HOSTS = ['api.anthropic.com'];

/**
 * 한자 표기가 의도적으로 존재해야 하는 파일.
 * normalize.ts 는 과거 오타 데이터를 순 한글로 교정하는 변환표를 보유하므로 예외.
 * (설계서 3.5 normalizeStageKeys 필수 유지 조항)
 */
const HANJA_ALLOW = ['src/lib/normalize.ts'];

interface Violation {
  rule: string;
  file: string;
  line: number;
  text: string;
}

function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((d) => collect(join(ROOT, d))),
  ...SCAN_FILES.map((f) => join(ROOT, f)),
];

const violations: Violation[] = [];
const add = (rule: string, file: string, line: number, text: string) =>
  violations.push({ rule, file, line, text: text.trim().slice(0, 120) });

const URL_RE = /https?:\/\/([a-z0-9.-]+)/gi;
const DATE_RE = /['"`]\d{4}-\d{2}-\d{2}/;
const HANJA_RE = /[分析安定]/;
const APIKEY_RE = /sk-ant-[A-Za-z0-9_-]{6,}/;
const KEY_LOG_RE = /console\.(log|info|warn|error|debug)\s*\([^)]*\b(apiKey|api_key|bearerToken|x-api-key)\b/i;

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const lines = readFileSync(abs, 'utf8').split('\n');

  lines.forEach((raw, i) => {
    const n = i + 1;

    // 1. 외부 CDN / 외부 호스트
    for (const m of raw.matchAll(URL_RE)) {
      const host = (m[1] ?? '').toLowerCase();
      if (ALLOWED_HOSTS.includes(host)) continue;
      // 문서 링크(주석) 는 허용하지 않되, 실제 로드 구문만 문제 삼기 위해 주석 라인은 제외
      const trimmed = raw.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('<!--')) continue;
      add('외부 CDN/호스트 참조', rel, n, raw);
    }

    // 2. localStorage
    if (/\blocalStorage\b/.test(raw)) add('localStorage 사용', rel, n, raw);

    // 3. 날짜 하드코딩
    if (DATE_RE.test(raw) && !DATE_LITERAL_ALLOW.includes(rel)) {
      add('날짜 하드코딩', rel, n, raw);
    }

    // 4. 한자 혼용
    if (HANJA_RE.test(raw) && !HANJA_ALLOW.includes(rel)) {
      add('단계명 한자 혼용', rel, n, raw);
    }

    // 5. API Key 노출
    if (APIKEY_RE.test(raw)) add('API Key 하드코딩', rel, n, raw);
    if (KEY_LOG_RE.test(raw)) add('API Key 로그 노출', rel, n, raw);
  });
}

if (violations.length > 0) {
  console.error(`\n✗ 제약사항 위반 ${violations.length}건\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}:${v.line}\n      ${v.text}`);
  }
  process.exit(1);
}

console.log(`✓ 제약사항 검증 통과 — 스캔 파일 ${files.length}개, 위반 0건`);
console.log('  · 외부 CDN 0건  · localStorage 0건  · 날짜 하드코딩 0건  · 한자 혼용 0건  · API Key 노출 0건');
