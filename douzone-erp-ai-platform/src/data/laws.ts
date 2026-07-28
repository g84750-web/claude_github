import type { LawDateContext, LawItem } from '../types/law';
import type { AutomationTag } from '../types/automation';
import type { ModuleId } from '../types/domain';

/**
 * 법령 / K-IFRS 정의
 *
 * [절대 제약] 날짜 하드코딩 금지.
 *  - 확정 시행일이 존재하는 기준서(K-IFRS 18·1116·1117, Pillar 2)는 사실로서의
 *    발행일·시행일만 ISO 문자열로 보유하고, 경과/잔여 기간은 전부 런타임 산출한다.
 *  - '당해년도 개정'처럼 해마다 갱신되는 항목은 실행 시점 연도로 날짜를 구성한다.
 *    → buildLaws(base) 를 호출 시점마다 평가하므로 연도 변경에도 자동 추종한다.
 */

const janFirst = (year: number) => `${year}-01-01`;
const julFirst = (year: number) => `${year}-07-01`;

/** 실행 시점 기준 법령 목록 생성 */
export function buildLaws(base: Date = new Date()): LawItem[] {
  const cy = base.getFullYear();

  return [
    // ─────────────── K-IFRS ───────────────
    {
      id: 'kifrs-18',
      category: 'ifrs',
      tag: 'K-IFRS 18',
      tagStyle: 'ifrs',
      title: '수익인식 기준서 (IFRS 18 대응)',
      publishedDate: '2024-04-01',
      effectiveDate: '2027-01-01',
      buildBody: (c) =>
        `IASB 발행 <strong>${c.sincePublished} 경과</strong> (기존 IAS 1 대체). ` +
        (c.daysToEffective > 0
          ? `한국 도입 예상일까지 <strong>D-${c.daysToEffective}일</strong> 남음.`
          : `<strong>시행 ${c.sinceEffective} 경과</strong> — 적용 현황 점검 권장.`),
      bullets: [
        '<strong>핵심 변경</strong>: 손익계산서 소계 표준화 (영업이익 의무 표시)',
        '<strong>MPM(경영성과지표)</strong> 공시 의무화',
        '집계 및 분해 원칙 명확화',
        'A10/OmniEsol 재무제표 템플릿 사전 검토 필요',
      ],
      actions: [
        { label: '비교검증', action: 'goCompare' },
        { label: 'AI 상세 조회', action: 'goAiQuery' },
      ],
    },
    {
      id: 'kifrs-1116',
      category: 'ifrs',
      tag: 'K-IFRS 1116',
      tagStyle: 'new',
      title: '리스 기준서 — 적용 현황',
      publishedDate: '2019-01-01',
      effectiveDate: '2019-01-01',
      buildBody: (c) =>
        `<strong>시행 ${c.sinceEffective} 경과</strong>. 사용권자산·리스부채 인식 현황 정기 점검 권장.`,
      bullets: [
        '단기리스·소액리스 면제 선택 여부 확인',
        'A10 고정자산 모듈 리스 처리 설정 검토',
        '재무상태표 분류 표시 방법 고객사 확인',
      ],
      actions: [{ label: 'AI 상세 조회', action: 'goAiQuery' }],
    },
    {
      id: 'kifrs-1117',
      category: 'ifrs',
      tag: 'K-IFRS 1117',
      tagStyle: 'ifrs',
      title: '보험계약 기준서',
      publishedDate: '2023-01-01',
      effectiveDate: '2023-01-01',
      buildBody: (c) =>
        `<strong>시행 ${c.sinceEffective} 경과</strong>. 측정 모델(BBA/PAA/VFA) 선택 현황 확인 권장.`,
      bullets: [
        '일반 제조/유통 고객사: 직접 영향 제한적',
        '금융계열사 포함 그룹사: 별도 검토 권장',
      ],
      actions: [],
    },
    {
      id: 'kssb-esg',
      category: 'ifrs',
      tag: 'ESG 공시',
      tagStyle: 'new',
      title: '지속가능성 공시기준 (KSSB) 대응',
      publishedDate: janFirst(cy - 1),
      effectiveDate: janFirst(cy + 1),
      buildBody: (c) =>
        c.daysToEffective > 0
          ? `국내 도입 준비 단계 — 적용까지 <strong>D-${c.daysToEffective}일</strong> 남음 ` +
            `(공개 초안 발표 후 ${c.sincePublished} 경과).`
          : `<strong>시행 ${c.sinceEffective} 경과</strong> — 공시 데이터 수집 체계 점검 권장.`,
      bullets: [
        'IFRS S1·S2 기반 기후 관련 공시 항목 식별',
        '온실가스 배출량(Scope 1·2) 집계 데이터 소스 확인',
        'RPT 경영보고 모듈 공시 지표 연계 사전 검토',
      ],
      actions: [{ label: 'AI 상세 조회', action: 'goAiQuery' }],
    },

    // ─────────────── 세법 ───────────────
    {
      id: 'vat-einvoice',
      category: 'tax',
      tag: '부가가치세',
      tagStyle: 'tax',
      title: '전자세금계산서 의무 발급 확대',
      publishedDate: janFirst(cy),
      effectiveDate: julFirst(cy),
      buildBody: (c) =>
        c.daysToEffective > 0
          ? `시행까지 <strong>D-${c.daysToEffective}일</strong>. 직전연도 공급가액 기준 개인사업자 포함 대상 확대.`
          : `<strong>시행 중</strong> (${c.daysSinceEffective}일 경과). 발행 대상 준수 현황 점검 권장.`,
      bullets: [
        'A10 세금계산서 자동 발행 모듈 설정 점검',
        'OmniEsol 홈택스 API 연동 상태 확인',
        '발행 대상 사업자 자동 분류 설정 필요',
      ],
      actions: [
        { label: '대응 확인', action: 'goCompare' },
        { label: 'AI 상세 조회', action: 'goAiQuery' },
      ],
    },
    {
      id: 'corporate-tax',
      category: 'tax',
      tag: '법인세',
      tagStyle: 'tax',
      title: '법인세 주요 개정 (당해 귀속분)',
      publishedDate: janFirst(cy),
      effectiveDate: janFirst(cy),
      buildBody: (c) =>
        `<strong>${c.currentYear}년 귀속분부터 적용</strong> — 시행 ${c.daysSinceEffective}일 경과. ` +
        `글로벌 최저한세 Pillar 2 국내 입법 적용 중.`,
      bullets: [
        'Pillar 2 글로벌 최저한세 적용 (대기업 그룹)',
        '이월결손금 공제 한도 확인 필요',
        'R&D 세액공제 요건 변경 확인 필요',
        'A10 세무 신고 모듈 양식 업데이트 여부 확인',
      ],
      actions: [{ label: 'AI 상세 조회', action: 'goAiQuery' }],
    },
    {
      id: 'withholding-tax',
      category: 'tax',
      tag: '원천세',
      tagStyle: 'warn',
      title: '인건비 신고 서식 변경 (당해 귀속분)',
      publishedDate: janFirst(cy),
      effectiveDate: janFirst(cy),
      buildBody: (c) =>
        `<strong>${c.currentYear}년 귀속분부터 적용</strong> — 시행 ${c.daysSinceEffective}일 경과. ` +
        `근로소득 간이세액표 개정 및 연말정산 서식 변경 반영 필요.`,
      bullets: [
        'HCM/HRM 모듈 급여 계산 로직 업데이트 확인',
        '연말정산 서식 변경 반영 여부 점검',
      ],
      actions: [{ label: '대응 확인', action: 'goCompare' }],
    },
    {
      id: 'pillar2',
      category: 'tax',
      tag: '국제조세',
      tagStyle: 'tax',
      title: 'BEPS Pillar 2 글로벌 최저한세',
      publishedDate: '2024-01-01',
      effectiveDate: '2024-01-01',
      buildBody: (c) =>
        `<strong>시행 ${c.sinceEffective} 경과</strong>. ` +
        `연결 매출 7억 5천만 유로 이상 다국적기업 그룹 대상, ${c.currentYear}년 귀속분 신고 준비 필요.`,
      bullets: [
        'CO/RPT 모듈 실효세율 집계 보고서 연동 검토 필요',
        '구성기업별 실효세율(ETR) 산출 데이터 확보',
      ],
      actions: [{ label: '비교검증', action: 'goCompare' }],
    },
  ];
}

/** 모듈 로드 시점 기준 목록 (연도 변경 추종이 필요한 화면은 buildLaws() 를 직접 호출) */
export const LAWS: LawItem[] = buildLaws();

/**
 * 비교검증 탭 검증 항목 정의 (설계서 4.8)
 * 실제 상태 판정은 실행 이력과 대조하여 Phase 5 에서 수행한다.
 */
export interface ComplianceDef {
  id: string;
  label: (ctx: LawDateContext) => string;
  /** 이 태그를 가진 항목 실행 시 충족 */
  tags?: AutomationTag[];
  /** 이 모듈의 항목 실행 시 충족 */
  modules?: ModuleId[];
  /** 연동 법령 ID — D-Day 를 상태 판정에 반영 */
  lawId?: string;
}

export const COMPLIANCE_DEFS: readonly ComplianceDef[] = [
  {
    id: 'cmp-kifrs18-template',
    label: () => 'K-IFRS 18 재무제표 템플릿 설계',
    tags: ['K-IFRS 18'],
    modules: ['FI', 'FIN'],
    lawId: 'kifrs-18',
  },
  {
    id: 'cmp-einvoice',
    label: () => '전자세금계산서 의무 대응',
    tags: ['전자세금계산서'],
    modules: ['TAX', 'MM', 'PUR'],
    lawId: 'vat-einvoice',
  },
  {
    id: 'cmp-3year',
    label: (c) => `3개년 비교재무제표 (${c.priorPriorYear}~${c.currentYear})`,
    tags: ['3개년비교'],
  },
  {
    id: 'cmp-adjusting-entry',
    label: () => '수정 분개 자동화 프로세스',
    tags: ['수정분개'],
  },
  {
    id: 'cmp-pillar2',
    label: () => '글로벌 최저한세 Pillar 2',
    tags: ['Pillar 2'],
    modules: ['CO', 'RPT'],
    lawId: 'pillar2',
  },
  {
    id: 'cmp-withholding',
    label: (c) => `원천세 서식 변경 반영 (${c.currentYear}년 귀속)`,
    modules: ['HCM', 'HRM'],
    lawId: 'withholding-tax',
  },
] as const;
