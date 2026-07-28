import { describe, expect, it } from 'vitest';
import { autoRatio, calcKpi, totalItemCount } from './kpi';
import { A10_DATA, OE_DATA } from '../data/automation';
import type { AutomationType } from '../types/automation';
import type { ExecRecord } from '../types/kpi';
import type { ProductId, StageIndex } from '../types/domain';

const rec = (
  type: AutomationType,
  hours: number,
  product: ProductId = 'A10',
  i = 0
): ExecRecord => ({
  timestamp: new Date(2026, 4, 22, 10, 0, i).toISOString(),
  product,
  moduleId: product === 'A10' ? 'FI' : 'FIN',
  stageIndex: 0 as StageIndex,
  itemId: `${product}-0-${String(i).padStart(2, '0')}`,
  task: `테스트 항목 ${i}`,
  type,
  hours,
  liveApi: false,
});

describe('totalItemCount', () => {
  it('실제 데이터의 전 항목 수를 센다', () => {
    const n = totalItemCount(A10_DATA, OE_DATA);
    expect(n).toBeGreaterThanOrEqual(130); // 65슬롯 × 최소 2건
    expect(n).toBe(
      [A10_DATA, OE_DATA]
        .flatMap((d) => Object.values(d))
        .flatMap((s) => Object.values(s))
        .reduce((a, arr) => a + arr.length, 0)
    );
  });
  it('빈 데이터는 0 을 반환한다', () => {
    expect(totalItemCount({}, {})).toBe(0);
  });
});

describe('calcKpi — 경계값', () => {
  it('실행 0건이면 전 지표가 0 이다', () => {
    const k = calcKpi([], 200);
    expect(k).toMatchObject({
      execCount: 0,
      totalHours: 0,
      dauRate: 0,
      savingsRate: 0,
      draftRate: 0,
      tcAutomationRate: 0,
      attachRate: 0,
    });
  });

  it('1건 실행 시 DAU 기저값 20 이 적용된다', () => {
    const k = calcKpi([rec('auto', 3)], 200);
    expect(k.execCount).toBe(1);
    expect(k.dauRate).toBe(21); // round(1/200*250 + 20) = 21
    expect(k.attachRate).toBe(1);
  });

  it('전체 항목 실행 시 DAU·Attach 가 상한 100 이다', () => {
    const total = 40;
    const log = Array.from({ length: total }, (_, i) => rec('auto', 0.1, 'A10', i));
    const k = calcKpi(log, total);
    expect(k.dauRate).toBe(100);
    expect(k.attachRate).toBe(100);
  });

  it('절감률은 35% 를 넘지 않는다', () => {
    const log = Array.from({ length: 50 }, (_, i) => rec('auto', 10, 'A10', i));
    expect(calcKpi(log, 200).savingsRate).toBe(35);
  });

  it('절감률은 누적 시간 × 0.8 이다 (상한 이하)', () => {
    const k = calcKpi([rec('semi', 5), rec('auto', 5, 'A10', 1)], 200);
    expect(k.totalHours).toBe(10);
    expect(k.savingsRate).toBe(8);
  });

  it('타입 비율로 초안율·TC 자동화율을 산출한다', () => {
    const log = [
      rec('semi', 1, 'A10', 0),
      rec('semi', 1, 'A10', 1),
      rec('auto', 1, 'A10', 2),
      rec('asst', 1, 'A10', 3),
    ];
    const k = calcKpi(log, 200);
    expect(k.semiCount).toBe(2);
    expect(k.autoCount).toBe(1);
    expect(k.asstCount).toBe(1);
    expect(k.draftRate).toBe(50);
    expect(k.tcAutomationRate).toBe(25);
  });

  it('제품별 실행 건수를 분리 집계한다', () => {
    const log = [rec('auto', 1, 'A10', 0), rec('auto', 1, 'OE', 1), rec('semi', 1, 'OE', 2)];
    const k = calcKpi(log, 200);
    expect(k.a10Count).toBe(1);
    expect(k.oeCount).toBe(2);
  });

  it('분모가 0 이어도 나눗셈 오류가 없다', () => {
    const k = calcKpi([rec('auto', 2)], 0);
    expect(k.attachRate).toBe(0);
    expect(k.dauRate).toBe(20);
  });
});

describe('autoRatio', () => {
  it('실행 0건이면 0 이다', () => {
    expect(autoRatio([])).toBe(0);
  });
  it('auto 비율을 0~1 로 반환한다', () => {
    const log = [rec('auto', 1, 'A10', 0), rec('semi', 1, 'A10', 1)];
    expect(autoRatio(log)).toBe(0.5);
  });
});
