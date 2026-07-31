import { describe, expect, it, vi } from 'vitest';
import {
  SAVINGS_CAP,
  SIM_DEFAULTS,
  animateValue,
  calcFastTrack,
  calcSimulation,
  deriveSimFromLog,
} from './simulator';
import type { AutomationType } from '../types/automation';
import type { ExecRecord } from '../types/kpi';
import type { StageIndex } from '../types/domain';

const rec = (type: AutomationType, i = 0): ExecRecord => ({
  timestamp: new Date(2026, 4, 22, 10, 0, i).toISOString(),
  product: 'A10',
  moduleId: 'FI',
  stageIndex: 0 as StageIndex,
  itemId: `FI-0-${String(i).padStart(2, '0')}`,
  task: '테스트',
  type,
  hours: 1,
  liveApi: false,
});

describe('calcSimulation', () => {
  it('기본값 세트를 산출한다', () => {
    const out = calcSimulation(SIM_DEFAULTS);
    // 70*0.1 + 50*0.15 + 40*0.1 = 7 + 7.5 + 4 = 18.5
    expect(out.savingsRate).toBe(18.5);
    expect(out.annualSavedHours).toBe(Math.round(2 * 2400 * 0.185));
  });

  it('절감률 상한 35% 를 넘지 않는다', () => {
    const out = calcSimulation({ dauRate: 100, draftRate: 100, tcRate: 100, pmProjects: 5 });
    expect(out.savingsRate).toBe(SAVINGS_CAP);
  });

  it('전 슬라이더 최대치의 raw 값이 상한과 정확히 일치한다', () => {
    const raw = 100 * 0.1 + 100 * 0.15 + 100 * 0.1;
    expect(raw).toBe(SAVINGS_CAP);
  });

  it('전 슬라이더 0 이면 절감 효과가 없다', () => {
    const out = calcSimulation({ dauRate: 0, draftRate: 0, tcRate: 0, pmProjects: 1 });
    expect(out.savingsRate).toBe(0);
    expect(out.annualSavedHours).toBe(0);
    expect(out.pmCapacity).toBe(1);
    expect(out.docHoursPerItem).toBe(16);
  });

  it('PM 수용력은 절감률의 70% 만 반영한다', () => {
    const out = calcSimulation({ dauRate: 100, draftRate: 100, tcRate: 100, pmProjects: 2 });
    // 2 * (1 + 0.35*0.7) = 2 * 1.245 = 2.49
    expect(out.pmCapacity).toBe(2.5);
  });

  it('초안율이 높을수록 설계서 1건당 소요 시간이 줄어든다', () => {
    const low = calcSimulation({ ...SIM_DEFAULTS, draftRate: 0 }).docHoursPerItem;
    const high = calcSimulation({ ...SIM_DEFAULTS, draftRate: 100 }).docHoursPerItem;
    expect(low).toBe(16);
    expect(high).toBe(6); // 16 * (1 - 0.65) = 5.6 → 6
    expect(high).toBeLessThan(low);
  });
});

describe('calcFastTrack', () => {
  it('auto 비율 0 → 배율 1.3', () => {
    expect(calcFastTrack(20, 0).multiplier).toBe(1.3);
  });
  it('auto 비율 1 → 배율 2.5', () => {
    expect(calcFastTrack(20, 1).multiplier).toBe(2.5);
  });
  it('배율은 1.3~2.5 범위를 벗어나지 않는다', () => {
    for (const r of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
      const m = calcFastTrack(20, r).multiplier;
      expect(m).toBeGreaterThanOrEqual(1.3);
      expect(m).toBeLessThanOrEqual(2.5);
    }
  });
  it('처리량 증가분을 산출한다', () => {
    const ft = calcFastTrack(20, 1);
    expect(ft.afterCount).toBe(50);
    expect(ft.deltaCount).toBe(30);
  });
  it('처리 건수 0 이어도 나눗셈 오류가 없다', () => {
    const ft = calcFastTrack(0, 0.5);
    expect(ft.afterCount).toBe(0);
    expect(Number.isFinite(ft.daysSavedPerItem)).toBe(true);
  });
});

describe('deriveSimFromLog', () => {
  it('실행 이력이 없으면 빈 객체를 반환한다', () => {
    expect(deriveSimFromLog([], 200)).toEqual({});
  });
  it('실적 기반 슬라이더 값을 산출한다', () => {
    const log = [rec('semi', 0), rec('semi', 1), rec('auto', 2), rec('asst', 3)];
    expect(deriveSimFromLog(log, 200)).toEqual({
      dauRate: 25, // round(4/200*250 + 20)
      draftRate: 50,
      tcRate: 25,
    });
  });
  it('DAU 는 20~100 으로 제한된다', () => {
    const log = Array.from({ length: 100 }, (_, i) => rec('auto', i));
    expect(deriveSimFromLog(log, 100).dauRate).toBe(100);
  });
});

describe('animateValue', () => {
  it('동일 값이면 즉시 확정하고 타이머를 만들지 않는다', () => {
    vi.useFakeTimers();
    const ticks: number[] = [];
    animateValue(50, 50, (v) => ticks.push(v));
    expect(ticks).toEqual([50]);
    vi.useRealTimers();
  });

  it('ease-out 으로 목표값에 도달한다', () => {
    vi.useFakeTimers();
    const ticks: number[] = [];
    animateValue(0, 100, (v) => ticks.push(v), 24, 18);
    vi.advanceTimersByTime(24 * 18);
    expect(ticks.at(-1)).toBe(100);
    expect(ticks.length).toBeGreaterThan(1);
    // ease-out: 초반 변화폭이 후반보다 크다
    expect(ticks[0]).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('취소 함수 호출 시 목표값에 도달하지 않는다', () => {
    vi.useFakeTimers();
    const ticks: number[] = [];
    const cancel = animateValue(0, 100, (v) => ticks.push(v));
    vi.advanceTimersByTime(18 * 3);
    cancel();
    vi.advanceTimersByTime(18 * 30);
    expect(ticks.at(-1)).not.toBe(100);
    vi.useRealTimers();
  });
});
