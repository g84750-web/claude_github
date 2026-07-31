import type { AutomationType, ModuleDataMap } from '../types/automation';
import { EMPTY_KPI, type ExecRecord, type KpiSnapshot } from '../types/kpi';

/** KPI 계산 엔진 (설계서 3.2) */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** 전체 자동화 항목 총 개수 (분모) */
export function totalItemCount(a10: ModuleDataMap, oe: ModuleDataMap): number {
  const count = (d: ModuleDataMap) =>
    Object.values(d).reduce(
      (acc, stages) => acc + Object.values(stages).reduce((a, arr) => a + arr.length, 0),
      0
    );
  return count(a10) + count(oe);
}

/** 실행 이력 → KPI 스냅샷 산출 */
export function calcKpi(log: ExecRecord[], totalItems: number): KpiSnapshot {
  const n = log.length;
  if (n === 0) return { ...EMPTY_KPI };

  const totalHours = log.reduce((a, r) => a + r.hours, 0);

  const byType = (t: AutomationType) => log.filter((r) => r.type === t).length;
  const autoCount = byType('auto');
  const semiCount = byType('semi');
  const asstCount = byType('asst');

  const coverage = totalItems > 0 ? n / totalItems : 0;

  return {
    execCount: n,
    totalHours: round1(totalHours),
    a10Count: log.filter((r) => r.product === 'A10').length,
    oeCount: log.filter((r) => r.product === 'OE').length,
    autoCount,
    semiCount,
    asstCount,

    // DAU% : 커버리지 × 250 보정 + 기저 20, 상한 100
    dauRate: clamp(Math.round(coverage * 250 + 20), 20, 100),

    // 절감률 : 누적 절감시간 × 0.8, 상한 35%
    savingsRate: round1(Math.min(35, totalHours * 0.8)),

    // 초안율 : semi 타입 비율
    draftRate: Math.round((semiCount / n) * 100),

    // TC 자동화율 : auto 타입 비율
    tcAutomationRate: Math.round((autoCount / n) * 100),

    // Attach Rate : 전체 항목 대비 실행 비율
    attachRate: Math.min(100, Math.round(coverage * 100)),
  };
}

/** auto 타입 실행 비율 (0~1) — Fast Track 배율 산출 입력 */
export function autoRatio(log: ExecRecord[]): number {
  if (log.length === 0) return 0;
  return log.filter((r) => r.type === 'auto').length / log.length;
}
