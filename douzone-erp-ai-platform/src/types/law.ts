export type LawCategory = 'ifrs' | 'tax';
export type LawTagStyle = 'ifrs' | 'tax' | 'new' | 'warn';

export interface LawDateContext {
  /** 발행 후 경과 (예: '2년 1개월') */
  sincePublished: string;
  /** 시행 후 경과 (예: '7년 4개월') */
  sinceEffective: string;
  /** 시행까지 남은 일수 (음수면 이미 시행) */
  daysToEffective: number;
  /** 시행 후 경과 일수 */
  daysSinceEffective: number;
  currentYear: number;
  /** 전기 */
  priorYear: number;
  /** 전전기 */
  priorPriorYear: number;
}

export type LawActionId = 'goCompare' | 'goAiQuery';

export interface LawAction {
  label: string;
  action: LawActionId;
}

export interface LawItem {
  id: string;
  category: LawCategory;
  /** 배지 라벨 (예: 'K-IFRS 18') */
  tag: string;
  tagStyle: LawTagStyle;
  title: string;
  /** 발행일 ISO date */
  publishedDate: string;
  /** 시행/발효 예정일 ISO date */
  effectiveDate: string;
  /**
   * 본문 생성 함수 — 반드시 런타임 날짜 기준 동적 산출
   * @param ctx 계산된 날짜 컨텍스트
   */
  buildBody: (ctx: LawDateContext) => string;
  bullets: string[];
  /** 연동 액션 버튼 */
  actions?: LawAction[];
}

export type LawBadgeLevel = 'upcoming-far' | 'upcoming-near' | 'dday' | 'active';

export interface LawBadge {
  level: LawBadgeLevel;
  label: string;
}

/** 비교검증 항목 상태 */
export type ComplianceStatus = 'ok' | 'review' | 'action';

export interface ComplianceCheck {
  id: string;
  label: string;
  status: ComplianceStatus;
  detail: string;
}

export const COMPLIANCE_STATUS_LABEL: Record<ComplianceStatus, string> = {
  ok: '정상',
  review: '검토 필요',
  action: '대응 필요',
};
