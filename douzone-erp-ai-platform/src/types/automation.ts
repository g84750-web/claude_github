import type { StageName } from './domain';

/** 자동화 유형 */
export type AutomationType =
  /** 완전 자동화 — AI 단독 처리 */
  | 'auto'
  /** 반자동 — AI 초안 + 담당자 확정 */
  | 'semi'
  /** AI 어시스턴트 — 가이드·참고 제공 */
  | 'asst';

/** 회계/세무 기준 태그 */
export type AutomationTag =
  | 'K-IFRS 18'
  | 'K-IFRS 1116'
  | '3개년비교'
  | '수정분개'
  | '전자세금계산서'
  | 'Pillar 2';

/** AI 자동화 항목 */
export interface AutomationItem {
  /** 고유 ID (모듈-단계-순번, 예: 'FI-0-01') */
  id: string;
  type: AutomationType;
  /** 업무 설명 (사용자 노출 텍스트) */
  task: string;
  /** 사용 도구/엔진명 */
  tool: string;
  /** 절감 공수 (시간) */
  hours: number;
  /** 관련 회계/세무 기준 태그 (선택) */
  tags?: AutomationTag[];
}

/** 모듈별 단계별 항목 맵 */
export type StageItemMap = Record<StageName, AutomationItem[]>;
export type ModuleDataMap = Record<string, StageItemMap>;

/** 자동화 유형 표시 메타 (배지 렌더링용) */
export interface AutomationTypeMeta {
  label: string;
  /** 배경 CSS 변수명 */
  bgVar: string;
  /** 텍스트 CSS 변수명 */
  fgVar: string;
}

export const AUTOMATION_TYPE_META: Record<AutomationType, AutomationTypeMeta> = {
  auto: { label: '완전 자동화', bgVar: '--gbg', fgVar: '--green' },
  semi: { label: '반자동 (보조)', bgVar: '--abg', fgVar: '--amber' },
  asst: { label: 'AI 어시스턴트', bgVar: '--bbg', fgVar: '--blue' },
};

/** 카드 상태 머신 */
export type CardState = 'idle' | 'running' | 'done' | 'error';
