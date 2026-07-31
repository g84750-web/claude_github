/**
 * 데이터 문자열의 날짜 토큰 치환기.
 *
 * [절대 제약] 날짜 하드코딩 금지.
 * 자동화 항목·법령 텍스트에 연도/기준일을 직접 박아 넣지 않고 토큰으로 표기한 뒤,
 * 화면 렌더 시점에 `new Date()` 기준으로 치환한다.
 *
 *   {today} → 2000-01-01 형식 실행일
 *   {cy}    → 당기 연도
 *   {py}    → 전기 연도
 *   {ppy}   → 전전기 연도
 *
 * (Phase 3 에서 lib/date.ts 의 날짜 유틸로 계산부를 위임한다.)
 */

export type DateToken = 'today' | 'cy' | 'py' | 'ppy';

export interface TokenContext {
  today: string;
  cy: number;
  py: number;
  ppy: number;
}

/** 런타임 기준 토큰 컨텍스트 생성 */
export function tokenContext(base: Date = new Date()): TokenContext {
  const cy = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return { today: `${cy}-${m}-${d}`, cy, py: cy - 1, ppy: cy - 2 };
}

const TOKEN_RE = /\{(today|cy|py|ppy)\}/g;

/** 문자열 내 날짜 토큰 치환 */
export function resolveTokens(text: string, ctx: TokenContext = tokenContext()): string {
  return text.replace(TOKEN_RE, (_, key: DateToken) => String(ctx[key]));
}

/** 미치환 토큰 존재 여부 (검증용) */
export function hasUnresolvedToken(text: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(text);
}
