/**
 * 데이터 정합성 검증 스크립트 (설계서 10.3)
 *
 *  · A10 7모듈 × 5단계 = 35슬롯 전부 최소 2건
 *  · OmniEsol 6모듈 × 5단계 = 30슬롯 전부 최소 2건
 *  · 비정규(한자 혼용) 단계 키 0건
 *  · 항목 ID 전역 중복 0건 / ID 형식 준수
 *  · 법령 정의 7건 이상, 발행일·시행일 명시
 *
 * 실행: npm run validate:data
 */
import { A10_DATA, A10_MODULE_IDS } from '../src/data/automation/a10';
import { OE_DATA, OE_MODULE_IDS } from '../src/data/automation/omniesol';
import { assertDataCompleteness, assertUniqueIds } from '../src/lib/normalize';
import { STAGES } from '../src/types/domain';
import { buildLaws } from '../src/data/laws';
import { hasUnresolvedToken, resolveTokens } from '../src/lib/tokens';

const MIN_PER_STAGE = 2;
const ID_RE = /^[A-Z]{2,3}-[0-4]-\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── 1. 완전성 ──────────────────────────────────────────
assertDataCompleteness(A10_DATA, A10_MODULE_IDS, MIN_PER_STAGE);
assertDataCompleteness(OE_DATA, OE_MODULE_IDS, MIN_PER_STAGE);

// ── 2. 단계 키 표기 ────────────────────────────────────
const allKeys = new Set<string>();
[A10_DATA, OE_DATA].forEach((d) =>
  Object.values(d).forEach((s) => Object.keys(s).forEach((k) => allKeys.add(k)))
);
const invalid = [...allKeys].filter((k) => !(STAGES as readonly string[]).includes(k));
if (invalid.length) throw new Error(`비정규 단계 키: ${invalid.join(', ')}`);

// ── 3. ID 형식 + 중복 ──────────────────────────────────
const total = assertUniqueIds(A10_DATA, OE_DATA);
const badIds: string[] = [];
[A10_DATA, OE_DATA].forEach((d) =>
  Object.values(d).forEach((s) =>
    Object.values(s).forEach((arr) =>
      arr.forEach((i) => {
        if (!ID_RE.test(i.id)) badIds.push(i.id);
      })
    )
  )
);
if (badIds.length) throw new Error(`ID 형식 위반: ${badIds.join(', ')}`);

// ── 4. 날짜 토큰 치환 가능 여부 ────────────────────────
const unresolved: string[] = [];
[A10_DATA, OE_DATA].forEach((d) =>
  Object.values(d).forEach((s) =>
    Object.values(s).forEach((arr) =>
      arr.forEach((i) => {
        if (hasUnresolvedToken(resolveTokens(i.task))) unresolved.push(i.id);
        if (hasUnresolvedToken(resolveTokens(i.tool))) unresolved.push(i.id);
      })
    )
  )
);
if (unresolved.length) throw new Error(`미치환 날짜 토큰: ${unresolved.join(', ')}`);

// ── 5. 슬롯 리포트 ─────────────────────────────────────
function report(name: string, data: typeof A10_DATA, ids: readonly string[]) {
  const rows = ids.map((id) => {
    const per = STAGES.map((s) => data[id][s].length);
    return { id, per, sum: per.reduce((a, b) => a + b, 0) };
  });
  const slots = rows.length * STAGES.length;
  const min = Math.min(...rows.flatMap((r) => r.per));
  console.log(`\n  ${name} — ${rows.length}모듈 × ${STAGES.length}단계 = ${slots}슬롯`);
  rows.forEach((r) =>
    console.log(`    ${r.id.padEnd(4)} [${r.per.join(' ')}]  합계 ${String(r.sum).padStart(2)}건`)
  );
  console.log(`    슬롯 최소 건수: ${min}건 (기준 ${MIN_PER_STAGE}건)`);
  return { slots, sum: rows.reduce((a, r) => a + r.sum, 0) };
}

const a10 = report('A10', A10_DATA, A10_MODULE_IDS);
const oe = report('OmniEsol', OE_DATA, OE_MODULE_IDS);

// ── 6. 법령 ────────────────────────────────────────────
const laws = buildLaws();
if (laws.length < 7) throw new Error(`법령 정의 부족: ${laws.length}건 (최소 7건)`);
const badLaw = laws.filter(
  (l) => !ISO_DATE_RE.test(l.publishedDate) || !ISO_DATE_RE.test(l.effectiveDate)
);
if (badLaw.length) throw new Error(`법령 날짜 형식 오류: ${badLaw.map((l) => l.id).join(', ')}`);
const dupLaw = laws.map((l) => l.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupLaw.length) throw new Error(`법령 ID 중복: ${dupLaw.join(', ')}`);

console.log(`\n  법령·IFRS — ${laws.length}건`);
laws.forEach((l) => console.log(`    ${l.tag.padEnd(12)} ${l.title}  (시행 ${l.effectiveDate})`));

console.log(
  `\n✓ 데이터 검증 완료 — 총 ${total}개 항목 / ${a10.slots + oe.slots}슬롯 ` +
    `(A10 ${a10.sum}건, OmniEsol ${oe.sum}건), 법령 ${laws.length}건\n`
);
