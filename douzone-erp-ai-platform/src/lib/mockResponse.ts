import type { AutomationItem } from '../types/automation';
import type { ModuleId, ProductId, StageName } from '../types/domain';
import { PRODUCT_LABEL } from '../types/domain';
import { fiscalYears, todayISO } from './date';
import { resolveTokens } from './tokens';

/**
 * 시뮬레이션 모드 응답 생성기 (설계서 5.3)
 *
 * API Key 미입력 시 타입별 목업 응답을 타이핑 출력한다.
 * [제약] 모든 날짜·연도는 런타임 산출값을 삽입한다.
 */

export interface MockContext {
  item: AutomationItem;
  product: ProductId;
  moduleId: ModuleId;
  moduleName: string;
  stage: StageName;
  /** 기준 시각 — 테스트 주입용, 기본은 실행 시점 */
  base?: Date;
}

/** 타이핑 출력 파라미터 — 4자씩 5ms 간격 */
export const TYPE_CHUNK = 4;
export const TYPE_INTERVAL_MS = 5;

function header(c: MockContext, title: string): string[] {
  const base = c.base ?? new Date();
  const { cy, py, ppy } = fiscalYears(base);
  return [
    `## ${title}`,
    '',
    `**처리일시**: ${todayISO(base)}   **비교연도**: ${ppy}/${py}/${cy}`,
    `**대상**: ${PRODUCT_LABEL[c.product]} · ${c.moduleId} ${c.moduleName} · ${c.stage}`,
    `**도구**: ${resolveTokens(c.item.tool)}`,
    '',
  ];
}

/** 완전 자동화 — 처리 체크리스트 + 검증 결과 */
function autoBody(c: MockContext): string[] {
  const base = c.base ?? new Date();
  const { cy, py, ppy } = fiscalYears(base);
  return [
    '■ 처리 체크리스트',
    '✓ 대상 데이터 범위 확정 및 추출',
    '✓ 표준 마스터 대비 매핑 규칙 적용',
    '✓ 예외 항목 자동 분류 및 사유 태깅',
    '✓ 산출물 포맷 검증 (계정체계·단위·부호)',
    `✓ 3개년 비교 정합성 확인 (${ppy}/${py}/${cy})`,
    '✓ 결과 파일 생성 및 이력 등록',
    '✓ 담당자 알림 발송',
    '',
    '■ 검증 결과',
    `· K-IFRS 18 표시 기준: 손익계산서 소계 구조 적합, MPM 항목 ${cy}년 공시 대상 확인`,
    `· 3개년 비교재무: ${ppy}년 재작성 항목 반영, 계정 연속성 이상 없음`,
    '· 수정 분개: 발생·이연·감가 유형 자동 생성 대상 식별 완료',
    '',
    `■ 절감 공수: 약 ${c.item.hours}시간`,
    '',
    '※ 시뮬레이션 모드 결과입니다. API Key 입력 시 Claude가 실제 산출물을 생성합니다.',
  ];
}

/** 반자동 — AI 초안 + 담당자 확인 체크리스트 */
function semiBody(c: MockContext): string[] {
  const base = c.base ?? new Date();
  const { cy, py } = fiscalYears(base);
  return [
    '■ AI 초안 개요',
    `· 대상 업무: ${resolveTokens(c.item.task)}`,
    '· 초안 구성: 현황 요약 → 쟁점 정리 → 권고안 → 후속 조치',
    '· 근거 데이터: 기존 산출물 및 표준 템플릿 자동 참조',
    '',
    '■ 적용률',
    '· AI 초안 반영 예상 비율: 62%',
    '· 담당자 보완 필요 구간: 고객사 고유 정책·예외 처리',
    `· 기준 연도: ${cy}년 (전기 ${py}년 대비 변경분 표기)`,
    '',
    '■ 담당자 확인 체크리스트',
    '□ 고객사 명칭·조직 체계 표기 확인',
    '□ 예외 처리 정책이 실제 운영과 일치하는지 검토',
    '□ 관련 부서 협의 필요 항목 표시',
    '□ 산출물 승인 경로 지정',
    '□ 최종본 확정 및 형상 등록',
    '',
    `■ 절감 공수: 약 ${c.item.hours}시간 (초안 작성 기준)`,
    '',
    '※ 시뮬레이션 모드 결과입니다. API Key 입력 시 Claude가 실제 초안을 생성합니다.',
  ];
}

/** AI 어시스턴트 — 기준·법령 가이드 */
function asstBody(c: MockContext): string[] {
  const base = c.base ?? new Date();
  const { cy, py, ppy } = fiscalYears(base);
  return [
    '■ K-IFRS 18 체크포인트',
    '· 손익계산서 소계 표준화 — 영업이익 의무 표시 대상 확인',
    '· MPM(경영성과지표) 공시 항목 정의 및 산출 근거 문서화',
    '· 집계·분해 원칙에 따른 표시 과목 재검토',
    '',
    `■ ${cy}년 세법 변경 요약`,
    '· 전자세금계산서 의무 발급 대상 확대 — 발행 대상 자동 분류 설정 점검',
    '· 글로벌 최저한세(Pillar 2) 적용 대상 그룹 실효세율 산출 체계 확인',
    `· 원천세 간이세액표 개정 반영 여부 (${cy}년 귀속분)`,
    '',
    '■ 수정 분개 가이드',
    '· 발생주의 조정: 미지급비용·선급비용 월말 자동 생성',
    '· 이연 처리: 수익·비용 기간 귀속 재배분',
    '· 감가·충당: 자산 대장 연동 자동 계산',
    '· 환율 평가: 기말 환율 적용 외화 자산·부채 평가',
    `· 3개년 비교 표시 시 ${ppy}/${py}/${cy}년 조정 이력 주석 연결`,
    '',
    `■ 절감 공수: 약 ${c.item.hours}시간 (조사·정리 기준)`,
    '',
    '※ 시뮬레이션 모드 결과입니다. API Key 입력 시 Claude가 상세 답변을 생성합니다.',
  ];
}

const TITLE: Record<AutomationItem['type'], string> = {
  auto: '완전 자동화 처리 결과',
  semi: 'AI 초안 (담당자 확정 필요)',
  asst: 'AI 어시스턴트 가이드',
};

/** 타입별 목업 응답 본문 생성 */
export function buildMockResponse(c: MockContext): string {
  const body =
    c.item.type === 'auto' ? autoBody(c) : c.item.type === 'semi' ? semiBody(c) : asstBody(c);
  return [...header(c, TITLE[c.item.type]), ...body].join('\n');
}

/** 법령 AI 조회 목업 응답 */
export function buildMockLawResponse(question: string, base: Date = new Date()): string {
  const { cy, py, ppy } = fiscalYears(base);
  return [
    '## AI 법령 조회 결과',
    '',
    `**기준일**: ${todayISO(base)}   **비교연도**: ${ppy}/${py}/${cy}`,
    `**질의**: ${question}`,
    '',
    '■ 요약',
    '· 질의하신 주제는 K-IFRS 및 당해 세법 개정 사항과 연관됩니다.',
    '· ERP 적용 관점에서는 마스터 설정, 자동 분개 규칙, 보고서 양식 세 영역을 점검해야 합니다.',
    '',
    '■ 실무 체크리스트',
    '□ 관련 기준서 시행일 및 경과 규정 확인',
    '□ 고객사 회계정책 변경 필요 여부 판단',
    '□ A10 / OmniEsol 표준 양식 대응 여부 확인',
    '□ 전기 대비 재작성 필요 항목 식별',
    '',
    '※ 시뮬레이션 모드 결과입니다. API Key 입력 시 Claude가 실제 답변을 생성합니다.',
  ].join('\n');
}

/**
 * 목업 텍스트를 타이핑 출력한다.
 * @returns 취소 함수
 */
export function typeOut(
  text: string,
  onDelta: (chunk: string) => void,
  onDone: (full: string) => void,
  chunkSize = TYPE_CHUNK,
  intervalMs = TYPE_INTERVAL_MS
): () => void {
  let i = 0;
  const timer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(timer);
      onDone(text);
      return;
    }
    const chunk = text.slice(i, i + chunkSize);
    i += chunkSize;
    onDelta(chunk);
  }, intervalMs);

  return () => clearInterval(timer);
}
