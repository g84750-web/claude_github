import type { ExecRecord } from '../types/kpi';
import { clamp, round1, round2 } from './kpi';

/** 공수 시뮬레이터 (설계서 3.3 / 3.4) */

export interface SimInput {
  /** AI 도구 활용률 % (10~100, step 5) */
  dauRate: number;
  /** AI 산출물 초안율 % (0~100, step 5) */
  draftRate: number;
  /** TC 자동화율 % (0~100, step 5) */
  tcRate: number;
  /** PM 관리 프로젝트 수 (1~5, step 1) */
  pmProjects: number;
}

export interface SimOutput {
  /** 예상 공수 절감률 % (상한 35) */
  savingsRate: number;
  /** 연간 절감 공수 (h) */
  annualSavedHours: number;
  /** PM 관리 가능 프로젝트 수 */
  pmCapacity: number;
  /** 설계서 1건당 초안 소요 시간 (h) */
  docHoursPerItem: number;
}

/** 슬라이더 기본값 (세션 초기화 시 복귀 대상) */
export const SIM_DEFAULTS: SimInput = {
  dauRate: 70,
  draftRate: 50,
  tcRate: 40,
  pmProjects: 2,
};

/** Fast Track 기준 연간 처리 건수 기본값 */
export const FT_DEFAULT_ANNUAL_COUNT = 20;

/** PM 1인당 연간 기준 공수 */
const HOURS_PER_PM_YEAR = 2400;
/** 설계서 1건 기준 소요 시간 */
const BASE_DOC_HOURS = 16;
/** 절감률 상한 */
export const SAVINGS_CAP = 35;

/**
 * 절감률 가중치: DAU 0.10 / 초안율 0.15 / TC 0.10
 * 세 슬라이더가 모두 100% 일 때 raw = 35 로 상한과 정확히 일치한다.
 */
export function calcSimulation(input: SimInput): SimOutput {
  const { dauRate, draftRate, tcRate, pmProjects } = input;

  const raw = dauRate * 0.1 + draftRate * 0.15 + tcRate * 0.1;
  const savingsRate = Math.min(SAVINGS_CAP, round1(raw));

  const baseHours = pmProjects * HOURS_PER_PM_YEAR;

  return {
    savingsRate,
    annualSavedHours: Math.round(baseHours * (savingsRate / 100)),
    // 절감률의 70% 만 실제 추가 수용력으로 환산
    pmCapacity: round1(pmProjects * (1 + (savingsRate / 100) * 0.7)),
    docHoursPerItem: Math.round(BASE_DOC_HOURS * (1 - (draftRate / 100) * 0.65)),
  };
}

export interface FastTrackOutput {
  /** 도입 후 연간 처리량 (건) */
  afterCount: number;
  /** 증가 건수 */
  deltaCount: number;
  /** 1건당 기간 단축 (일) */
  daysSavedPerItem: number;
  /** 적용 배율 */
  multiplier: number;
}

/** 표준 프로젝트 기간 (일) */
const BASE_PROJECT_DAYS = 180;

/**
 * @param currentAnnualCount 현재 연간 처리 건수
 * @param autoRatio 실제 auto 타입 실행 비율 (0~1)
 */
export function calcFastTrack(currentAnnualCount: number, autoRatio: number): FastTrackOutput {
  // 자동화 비율에 따라 1.3배 ~ 2.5배 동적 산출
  const multiplier = round2(1.3 + clamp(autoRatio, 0, 1) * 1.2);
  const afterCount = Math.round(currentAnnualCount * multiplier);
  const daysSaved = round1(
    (BASE_PROJECT_DAYS - BASE_PROJECT_DAYS / multiplier) / Math.max(afterCount, 1)
  );
  return {
    afterCount,
    deltaCount: afterCount - currentAnnualCount,
    daysSavedPerItem: daysSaved,
    multiplier,
  };
}

/**
 * 항목 실행 시 슬라이더를 실제 실적 기반으로 자동 갱신할 값 산출.
 * 실행 이력이 없으면 빈 객체를 반환해 슬라이더를 건드리지 않는다.
 */
export function deriveSimFromLog(log: ExecRecord[], totalItems: number): Partial<SimInput> {
  const n = log.length;
  if (n === 0) return {};

  const coverage = totalItems > 0 ? n / totalItems : 0;
  const semiN = log.filter((r) => r.type === 'semi').length;
  const autoN = log.filter((r) => r.type === 'auto').length;

  return {
    dauRate: clamp(Math.round(coverage * 250 + 20), 20, 100),
    draftRate: Math.min(100, Math.round((semiN / n) * 100)),
    tcRate: Math.min(100, Math.round((autoN / n) * 100)),
  };
}

/**
 * ease-out cubic 애니메이션 — 24 step / 18ms
 * @returns 취소 함수
 */
export function animateValue(
  from: number,
  to: number,
  onTick: (v: number) => void,
  steps = 24,
  intervalMs = 18
): () => void {
  if (from === to || steps <= 0) {
    onTick(to);
    return () => {};
  }

  let i = 0;
  const diff = to - from;
  const timer = setInterval(() => {
    i += 1;
    const ease = 1 - Math.pow(1 - i / steps, 3);
    onTick(Math.round(from + diff * ease));
    if (i >= steps) {
      onTick(to);
      clearInterval(timer);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
