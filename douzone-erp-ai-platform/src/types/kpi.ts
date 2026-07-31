import type { AutomationType } from './automation';
import type { ModuleId, ProductId, StageIndex } from './domain';

/** 실행 이력 레코드 */
export interface ExecRecord {
  /** ISO 8601 타임스탬프 — 런타임 new Date() 기준 (하드코딩 금지) */
  timestamp: string;
  product: ProductId;
  moduleId: ModuleId;
  stageIndex: StageIndex;
  itemId: string;
  task: string;
  type: AutomationType;
  hours: number;
  /** 실제 Claude API 호출 여부 (시뮬레이션 구분) */
  liveApi: boolean;
}

/** 계산된 KPI 스냅샷 */
export interface KpiSnapshot {
  execCount: number;
  totalHours: number;
  a10Count: number;
  oeCount: number;
  autoCount: number;
  semiCount: number;
  asstCount: number;
  /** AI 도구 활용률 % (목표 70) */
  dauRate: number;
  /** AI 기인 공수 절감률 % (목표 15, 상한 35) */
  savingsRate: number;
  /** AI 산출물 초안율 % (목표 50) */
  draftRate: number;
  /** TC 자동화율 % (목표 40) */
  tcAutomationRate: number;
  /** AI Attach Rate % (목표 30) */
  attachRate: number;
}

/** KPI 표시 메타 (목표·색상·상한) */
export interface KpiMeta {
  key: keyof Pick<
    KpiSnapshot,
    'dauRate' | 'savingsRate' | 'draftRate' | 'tcAutomationRate' | 'attachRate'
  >;
  label: string;
  target: number;
  /** CSS 변수명 */
  colorVar: string;
  max: number;
}

export const KPI_METAS: readonly KpiMeta[] = [
  { key: 'dauRate', label: 'AI 도구 DAU%', target: 70, colorVar: '--blue', max: 100 },
  { key: 'savingsRate', label: 'AI 기인 공수 절감률', target: 15, colorVar: '--green', max: 35 },
  { key: 'draftRate', label: 'AI 산출물 초안율', target: 50, colorVar: '--amber', max: 100 },
  { key: 'tcAutomationRate', label: 'TC 자동화율', target: 40, colorVar: '--purple', max: 100 },
  { key: 'attachRate', label: 'AI Attach Rate', target: 30, colorVar: '--blue', max: 100 },
] as const;

/** 빈 KPI 스냅샷 (실행 이력 0건) */
export const EMPTY_KPI: KpiSnapshot = {
  execCount: 0,
  totalHours: 0,
  a10Count: 0,
  oeCount: 0,
  autoCount: 0,
  semiCount: 0,
  asstCount: 0,
  dauRate: 0,
  savingsRate: 0,
  draftRate: 0,
  tcAutomationRate: 0,
  attachRate: 0,
};
