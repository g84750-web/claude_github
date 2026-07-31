import { buildModuleData, type RawStageMap } from '../build';

/** MM — 구매·자재 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '구매 프로세스 현황 분석 보고서 초안 ({today})',
      tool: 'Claude API',
      hours: 3,
    },
    { type: 'auto', task: '품목 마스터 AI 중복·이상 탐지 리포트', tool: '데이터 품질 AI', hours: 5 },
    {
      type: 'asst',
      task: '전자세금계산서 매입 처리 현황 진단 ({cy}년 의무 확대 기준)',
      tool: 'RAG 기반 법령 검색',
      hours: 2,
      tags: ['전자세금계산서'],
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'semi',
      task: '품목 분류 체계 설계 초안 (대·중·소분류 자동 제안)',
      tool: '분류 AI',
      hours: 4,
    },
    {
      type: 'asst',
      task: '발주 승인 플로우 설계서 및 내부통제 체크리스트',
      tool: '설계 AI',
      hours: 3,
    },
    {
      type: 'auto',
      task: '전자세금계산서 매입 자동 대사 프로세스 설계',
      tool: '세금계산서 설계 AI',
      hours: 4,
      tags: ['전자세금계산서'],
    },
  ],
  '개발·구성': [
    { type: 'auto', task: 'AI 자동 발주점 산정 (수요예측 기반 ROP)', tool: '수요예측 AI', hours: 5 },
    { type: 'semi', task: '공급업체 평가 AI 스코어링', tool: '공급업체 평가 AI', hours: 3 },
    {
      type: 'auto',
      task: '전자세금계산서 매입 자동 수취·검증 연동 설정',
      tool: '홈택스 API 연동',
      hours: 4,
      tags: ['전자세금계산서'],
    },
  ],
  '테스트 (IUT)': [
    { type: 'auto', task: '구매오더~입고 E2E TC 자동 생성', tool: 'TC 자동화', hours: 5 },
    { type: 'semi', task: '재고 수불 시나리오 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: '매입 세금계산서 대사 정합성 검증 TC',
      tool: '세금계산서 검증 AI',
      hours: 3,
      tags: ['전자세금계산서'],
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '품목 마스터 이행 품질 자동 검증', tool: '이행 검증 배치', hours: 4 },
    {
      type: 'auto',
      task: '발주 이상 패턴 실시간 AI 모니터링',
      tool: 'A10 AI 모니터링',
      hours: 3,
    },
    {
      type: 'semi',
      task: '매입 누락 세금계산서 AI 탐지 ({today}~ 기준)',
      tool: '세금계산서 모니터링 AI',
      hours: 3,
      tags: ['전자세금계산서'],
    },
  ],
};

export const MM = buildModuleData('MM', RAW);
