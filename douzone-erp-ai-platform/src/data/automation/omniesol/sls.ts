import { buildModuleData, type RawStageMap } from '../build';

/** SLS — 영업CRM (OmniEsol) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '영업CRM 현황 분석 및 고객 데이터 품질 진단 ({today})',
      tool: 'Claude API',
      hours: 3,
    },
    { type: 'auto', task: '고객 마스터 중복·이상 AI 자동 탐지', tool: '마스터 AI', hours: 4 },
    {
      type: 'asst',
      task: 'K-IFRS 18 수익인식 5단계 적용 범위 AI 진단',
      tool: 'K-IFRS 18 GAP AI',
      hours: 3,
      tags: ['K-IFRS 18'],
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'semi',
      task: '수주~출하 프로세스 설계서 초안 (K-IFRS 18 수익인식 반영)',
      tool: '설계 AI',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'asst',
      task: '고객 신용한도·미수금 관리 정책 설계 가이드',
      tool: 'Claude AI',
      hours: 2,
    },
    {
      type: 'semi',
      task: '수익인식 조정 분개 처리 설계 (기간귀속·반품 추정)',
      tool: '수정 분개 설계 AI',
      hours: 4,
      tags: ['수정분개'],
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: 'K-IFRS 18 기준 수익인식 자동화 설정 (수행의무 이행 기준)',
      tool: 'OmniEsol 수익인식 AI',
      hours: 6,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '자동 견적서 생성 및 수주 처리 자동화',
      tool: 'OmniEsol 영업 AI',
      hours: 4,
    },
    {
      type: 'semi',
      task: 'AI 수요 예측 기반 재고·배분 최적화',
      tool: '수요예측 AI',
      hours: 4,
    },
  ],
  '테스트 (IUT)': [
    {
      type: 'semi',
      task: '수주~매출인식 E2E TC 자동 생성 (K-IFRS 18 수익인식 포함)',
      tool: 'TC 자동화',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
    { type: 'auto', task: '단가·할인 적용 정합성 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: '수익인식 조정 분개 시나리오 검증 TC',
      tool: '수정 분개 검증 AI',
      hours: 3,
      tags: ['수정분개'],
    },
  ],
  '이행·안정화': [
    {
      type: 'auto',
      task: '고객 오더·수익인식 이행 정합성 자동 검증',
      tool: '이행 검증 AI',
      hours: 4,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '미수금 이상 패턴 AI 탐지 및 담당자 알림',
      tool: 'OmniEsol AI 모니터링',
      hours: 3,
    },
    {
      type: 'semi',
      task: '수익인식 조정 분개 누락 AI 점검 ({today}~ 기준)',
      tool: '수정 분개 모니터링 AI',
      hours: 3,
      tags: ['수정분개'],
    },
  ],
};

export const SLS = buildModuleData('SLS', RAW);
