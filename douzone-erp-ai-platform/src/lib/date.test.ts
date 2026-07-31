import { describe, expect, it } from 'vitest';
import {
  badgeLevel,
  daysLabel,
  daysUntil,
  elapsedLabel,
  fiscalYears,
  monthsSince,
  todayISO,
} from './date';

/** 설계서 3.1 단위 테스트 필수 케이스 */

// 기준 시각 — 로컬 정오로 고정해 서머타임/시각 영향 제거
const BASE = new Date(2026, 4, 22, 12, 0, 0);

const shift = (days: number, base: Date = BASE) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);

const isoShift = (days: number) => todayISO(shift(days));

describe('todayISO', () => {
  it('YYYY-MM-DD 로 포맷한다', () => {
    expect(todayISO(BASE)).toBe('2026-05-22');
  });
  it('한 자리 월·일을 0 으로 채운다', () => {
    expect(todayISO(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('fiscalYears', () => {
  it('당기/전기/전전기를 산출한다', () => {
    expect(fiscalYears(BASE)).toEqual({ cy: 2026, py: 2025, ppy: 2024 });
  });
});

describe('daysUntil', () => {
  it('미래일 +51일 → 51', () => {
    expect(daysUntil(isoShift(51), BASE)).toBe(51);
  });
  it('과거일 -131일 → -131', () => {
    expect(daysUntil(isoShift(-131), BASE)).toBe(-131);
  });
  it('당일 → 0', () => {
    expect(daysUntil(isoShift(0), BASE)).toBe(0);
  });
  it('연도 경계를 넘어도 정확하다', () => {
    expect(daysUntil(isoShift(365), BASE)).toBe(365);
  });
});

describe('badgeLevel', () => {
  it('D+120 → upcoming-far', () => {
    expect(badgeLevel(isoShift(120), BASE)).toEqual({
      level: 'upcoming-far',
      label: 'D-120일',
    });
  });
  it('D+51 → upcoming-near (경고)', () => {
    expect(badgeLevel(isoShift(51), BASE)).toEqual({
      level: 'upcoming-near',
      label: 'D-51일 ⚠',
    });
  });
  it('D+91 / D+90 이 far / near 경계', () => {
    expect(badgeLevel(isoShift(91), BASE).level).toBe('upcoming-far');
    expect(badgeLevel(isoShift(90), BASE).level).toBe('upcoming-near');
  });
  it('D-0 → dday', () => {
    expect(badgeLevel(isoShift(0), BASE)).toEqual({ level: 'dday', label: 'D-day' });
  });
  it('D-400 → active, 시행 1년 1개월', () => {
    expect(badgeLevel(isoShift(-400), BASE)).toEqual({
      level: 'active',
      label: '시행 1년 1개월',
    });
  });
  it('시행 직후 30일 미만은 일 단위로 표기한다', () => {
    expect(badgeLevel(isoShift(-10), BASE).label).toBe('시행 10일');
  });
  it('시행 후 1년 미만은 개월 단위로 표기한다', () => {
    expect(badgeLevel(isoShift(-90), BASE).label).toBe('시행 3개월');
  });
});

describe('daysLabel', () => {
  it('일 / 개월 / 년 단위를 전환한다', () => {
    expect(daysLabel(-10)).toBe('10일');
    expect(daysLabel(-90)).toBe('3개월');
    expect(daysLabel(-400)).toBe('1년 1개월');
  });
});

describe('monthsSince / elapsedLabel', () => {
  const monthsAgo = (n: number) =>
    todayISO(new Date(BASE.getFullYear(), BASE.getMonth() - n, 1));

  it('25개월 전 → 2년 1개월', () => {
    expect(monthsSince(monthsAgo(25), BASE)).toBe(25);
    expect(elapsedLabel(monthsAgo(25), BASE)).toBe('2년 1개월');
  });
  it('4개월 전 → 4개월', () => {
    expect(elapsedLabel(monthsAgo(4), BASE)).toBe('4개월');
  });
  it('정확히 12개월 전 → 1년 0개월', () => {
    expect(elapsedLabel(monthsAgo(12), BASE)).toBe('1년 0개월');
  });
  it('미래 일자는 0 으로 방어한다', () => {
    expect(monthsSince(isoShift(400), BASE)).toBe(0);
    expect(elapsedLabel(isoShift(400), BASE)).toBe('0개월');
  });
});
