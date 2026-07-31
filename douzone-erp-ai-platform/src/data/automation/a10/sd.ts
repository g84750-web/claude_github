import { buildModuleData, type RawStageMap } from '../build';

/** SD — 영업·유통 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '영업 프로세스 분석 및 Pain Point 자동 구조화 ({today})',
      tool: 'Claude API',
      hours: 3,
    },
    { type: 'auto', task: '고객 마스터 품질 AI 진단', tool: '마스터 AI', hours: 5 },
    {
      type: 'asst',
      task: 'K-IFRS 18 수익인식 5단계 적용 범위 AI 진단',
      tool: 'K-IFRS 18 GAP AI',
      hours: 3,
      tags: ['K-IFRS 18'],
    },
  ],
  '설계 (BD/DD)': [
    { type: 'semi', task: '단가/할인 정책 설계서 초안', tool: '설계 AI', hours: 4 },
    { type: 'asst', task: '출하·배송 프로세스 설계 가이드', tool: 'Claude AI', hours: 2 },
    {
      type: 'semi',
      task: 'K-IFRS 18 수행의무 식별 및 수익인식 시점 설계',
      tool: 'K-IFRS 18 설계 AI',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
  ],
  '개발·구성': [
    { type: 'auto', task: '자동 견적서 생성 (표준단가 + 할인율)', tool: 'A10 견적 AI', hours: 4 },
    {
      type: 'semi',
      task: 'AI 수요 예측 기반 재고 배분 최적화',
      tool: '수요예측 AI',
      hours: 5,
    },
    {
      type: 'auto',
      task: 'K-IFRS 18 기준 수익인식 자동 분개 설정',
      tool: 'A10 수익인식 엔진',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
  ],
  '테스트 (IUT)': [
    { type: 'semi', task: '수주~출하 E2E 시나리오 자동 생성', tool: 'TC 자동화', hours: 4 },
    { type: 'auto', task: '단가 적용 정합성 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: '수익인식 시점 정합성 검증 TC (K-IFRS 18 기준)',
      tool: 'K-IFRS 18 검증 AI',
      hours: 4,
      tags: ['K-IFRS 18'],
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '고객 오더 이행 정합성 검증', tool: '이행 검증 AI', hours: 4 },
    { type: 'auto', task: '미수금 이상 패턴 AI 탐지', tool: '미수금 AI', hours: 3 },
    {
      type: 'semi',
      task: '수익인식 조정 분개 누락 AI 점검 ({today}~ 기준)',
      tool: '수정 분개 모니터링 AI',
      hours: 3,
      tags: ['수정분개'],
    },
  ],
};

export const SD = buildModuleData('SD', RAW);
