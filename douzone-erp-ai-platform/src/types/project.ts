import type { StageName } from './domain';

export type ProjectInputMode = 'manual' | 'api';
export type AppliedProduct = 'A10' | 'OE' | 'BOTH';

export interface ProjectInfo {
  /** 필수 */
  projectName: string;
  clientName: string;
  /** 선택 */
  projectCode: string;
  pmName: string;
  /** ISO date (YYYY-MM-DD) — 기본값은 런타임 todayISO() 산출 */
  startDate: string;
  endDate: string;
  currentStage: StageName | '';
  appliedProduct: AppliedProduct;
  /** URL 3종 */
  clientHomepageUrl: string;
  pmsUrl: string;
  demoServerUrl: string;
  note: string;
}

export interface ApiConnConfig {
  endpointUrl: string;
  /** [보안] 로그·코드 노출 금지, sessionStorage 외 저장 금지 */
  bearerToken: string;
  projectId: string;
}

export type ConnStatus = 'idle' | 'testing' | 'success' | 'failed';

/** 프로젝트 폼 필드 메타 (검증 규칙) */
export interface ProjectFieldRule {
  field: keyof ProjectInfo;
  label: string;
  required: boolean;
  /** 입력 타입 */
  kind: 'text' | 'date' | 'select' | 'url' | 'textarea';
}

export const PROJECT_FIELD_RULES: readonly ProjectFieldRule[] = [
  { field: 'projectName', label: '프로젝트명', required: true, kind: 'text' },
  { field: 'projectCode', label: '프로젝트 코드', required: false, kind: 'text' },
  { field: 'clientName', label: '고객사명', required: true, kind: 'text' },
  { field: 'pmName', label: 'PM', required: false, kind: 'text' },
  { field: 'startDate', label: '시작일', required: false, kind: 'date' },
  { field: 'endDate', label: '종료일', required: false, kind: 'date' },
  { field: 'currentStage', label: '현재 단계', required: false, kind: 'select' },
  { field: 'appliedProduct', label: '적용 제품', required: false, kind: 'select' },
  { field: 'clientHomepageUrl', label: '고객사 홈페이지', required: false, kind: 'url' },
  { field: 'pmsUrl', label: 'PMS URL', required: false, kind: 'url' },
  { field: 'demoServerUrl', label: '데모 서버 URL', required: false, kind: 'url' },
  { field: 'note', label: '비고', required: false, kind: 'textarea' },
] as const;

/** 빈 프로젝트 정보 — startDate 기본값은 스토어에서 todayISO()로 주입 */
export const EMPTY_PROJECT: ProjectInfo = {
  projectName: '',
  clientName: '',
  projectCode: '',
  pmName: '',
  startDate: '',
  endDate: '',
  currentStage: '',
  appliedProduct: 'A10',
  clientHomepageUrl: '',
  pmsUrl: '',
  demoServerUrl: '',
  note: '',
};
