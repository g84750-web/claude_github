import type { LawBadge, LawBadgeLevel } from '../types/law';

/**
 * 날짜 유틸
 *
 * [절대 제약] 날짜 하드코딩 금지 — 모든 값은 `now()` 기준 런타임 산출.
 * 테스트에서는 base 인자로 기준 시각을 주입한다.
 */

const MS_PER_DAY = 86_400_000;

/** 시스템 현재 시각 (테스트 주입 가능) */
export function now(): Date {
  return new Date();
}

/** YYYY-MM-DD 형식 문자열 */
export function todayISO(base: Date = now()): string {
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 'YYYY-MM-DD' 를 **로컬 자정**으로 파싱한다.
 * `new Date('2027-01-01')` 은 UTC 자정으로 해석되어 KST(+9) 기준 하루 어긋나므로
 * D-Day 계산에는 사용하지 않는다.
 */
export function parseISODate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 해당 일자의 로컬 자정 */
export function startOfDay(base: Date = now()): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

/** 회계연도 3개년 (당기/전기/전전기) */
export function fiscalYears(base: Date = now()): { cy: number; py: number; ppy: number } {
  const cy = base.getFullYear();
  return { cy, py: cy - 1, ppy: cy - 2 };
}

/**
 * 대상일까지 남은 일수 (음수 = 경과)
 * 로컬 자정 기준 정수 일수이므로 시각·서머타임에 흔들리지 않는다.
 */
export function daysUntil(targetISO: string, base: Date = now()): number {
  const target = startOfDay(parseISODate(targetISO)).getTime();
  const from = startOfDay(base).getTime();
  return Math.round((target - from) / MS_PER_DAY);
}

/** 기준일로부터 경과 개월 수 (음수 방지) */
export function monthsSince(fromISO: string, base: Date = now()): number {
  const from = parseISODate(fromISO);
  return Math.max(
    0,
    (base.getFullYear() - from.getFullYear()) * 12 + (base.getMonth() - from.getMonth())
  );
}

/** 'N년 M개월' 또는 'M개월' 포맷 */
export function elapsedLabel(fromISO: string, base: Date = now()): string {
  const m = monthsSince(fromISO, base);
  const y = Math.floor(m / 12);
  const mm = m % 12;
  return y > 0 ? `${y}년 ${mm}개월` : `${mm}개월`;
}

/** 일수 → 'N년 M개월' / 'N개월' / 'N일' 표기 */
export function daysLabel(days: number): string {
  const abs = Math.abs(days);
  if (abs < 30) return `${abs}일`;
  if (abs < 365) return `${Math.round(abs / 30)}개월`;
  return `${Math.floor(abs / 365)}년 ${Math.round((abs % 365) / 30)}개월`;
}

/** D-Day 배지 레벨 판정 */
export function badgeLevel(effectiveISO: string, base: Date = now()): LawBadge {
  const d = daysUntil(effectiveISO, base);

  if (d > 90) return { level: 'upcoming-far', label: `D-${d}일` };
  if (d > 0) return { level: 'upcoming-near', label: `D-${d}일 ⚠` };
  if (d === 0) return { level: 'dday', label: 'D-day' };
  return { level: 'active', label: `시행 ${daysLabel(d)}` };
}

export type { LawBadge, LawBadgeLevel };

/** HH:mm:ss (실행 이력 표시용) */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
