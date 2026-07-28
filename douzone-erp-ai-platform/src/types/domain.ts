/** 제품 구분 */
export type ProductId = 'A10' | 'OE';

/** A10 모듈 ID */
export type A10ModuleId = 'FI' | 'CO' | 'MM' | 'SD' | 'PP' | 'HCM' | 'FA';

/** OmniEsol 모듈 ID */
export type OEModuleId = 'FIN' | 'TAX' | 'HRM' | 'PUR' | 'SLS' | 'RPT';

export type ModuleId = A10ModuleId | OEModuleId;

/** 모듈 정의 */
export interface ModuleDef {
  id: ModuleId;
  /** 한글명 (예: '재무회계') */
  name: string;
  /** 영문명 (예: 'Financial Accounting') */
  nameEn: string;
  product: ProductId;
}

/**
 * 구축 단계 — 순 한글 표기 고정
 *
 * [중요] 한자 혼용 절대 금지. 아래 유니코드 코드포인트만 정본으로 인정한다.
 * '착수·분석'   = U+CC29 U+C218 U+00B7 U+BD84 U+C11D
 * '이행·안정화' = U+C774 U+D589 U+00B7 U+C548 U+C815 U+D654
 * 비정규 표기는 lib/normalize.ts 의 normalizeStageKeys 로 런타임 교정한다.
 */
export const STAGES = [
  '착수·분석',
  '설계 (BD/DD)',
  '개발·구성',
  '테스트 (IUT)',
  '이행·안정화',
] as const;

export type StageName = (typeof STAGES)[number];
export type StageIndex = 0 | 1 | 2 | 3 | 4;

/** 단계 인덱스 → 단계명 (범위 밖이면 1단계) */
export function stageNameOf(index: StageIndex): StageName {
  return STAGES[index] ?? STAGES[0];
}

/** 단계명 → 인덱스 (미일치 시 -1) */
export function stageIndexOf(name: string): number {
  return (STAGES as readonly string[]).indexOf(name);
}

/** 제품 표시명 */
export const PRODUCT_LABEL: Record<ProductId, string> = {
  A10: 'Amaranth10',
  OE: 'OmniEsol',
};

/** 제품별 기본 모듈 (제품 전환 시 리셋 대상) */
export const DEFAULT_MODULE: Record<ProductId, ModuleId> = {
  A10: 'FI',
  OE: 'FIN',
};
