import { buildModuleData, type RawStageMap } from '../build';

/** TAX — 세무신고 (OmniEsol) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '세무신고 현황 분석 및 전자신고 대응 현황 점검 ({today})',
      tool: '세무 분석 AI',
      hours: 3,
    },
    {
      type: 'asst',
      task: '{cy}년 세법 개정 주요 변경 사항 AI 요약',
      tool: 'RAG 세법 검색',
      hours: 2,
    },
    {
      type: 'auto',
      task: '홈택스 연동 상태 진단 및 전자세금계산서 발행 대상 자동 확인',
      tool: '홈택스 API 진단 AI',
      hours: 3,
      tags: ['전자세금계산서'],
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'semi',
      task: '세무신고 프로세스 설계서 초안 (부가세·법인세·원천세 월별 일정)',
      tool: '설계 AI',
      hours: 4,
    },
    {
      type: 'auto',
      task: '전자세금계산서 의무 확대 대응 설계 초안 ({cy}년 시행 기준)',
      tool: '세금계산서 설계 AI',
      hours: 3,
      tags: ['전자세금계산서'],
    },
    {
      type: 'asst',
      task: 'Pillar 2 글로벌 최저한세 신고 대응 설계 가이드',
      tool: 'RAG 세법 검색',
      hours: 3,
      tags: ['Pillar 2'],
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: '세금계산서 자동 발행 및 홈택스 자동 연동 설정',
      tool: '홈택스 API 연동',
      hours: 4,
      tags: ['전자세금계산서'],
    },
    {
      type: 'auto',
      task: '부가세·법인세 자동 집계 및 신고 데이터 생성',
      tool: '세무 자동화 AI',
      hours: 5,
    },
    {
      type: 'semi',
      task: '세무 이상 거래 AI 탐지 (과소·과다 신고 위험)',
      tool: '세무 Anomaly AI',
      hours: 3,
    },
  ],
  '테스트 (IUT)': [
    {
      type: 'auto',
      task: '세금계산서 발행~신고 E2E TC 자동 생성',
      tool: 'TC 자동화',
      hours: 4,
      tags: ['전자세금계산서'],
    },
    { type: 'semi', task: '세무 집계 정합성 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: 'Pillar 2 신고 데이터 정합성 검증 TC ({cy}년 귀속)',
      tool: 'Pillar 2 검증 AI',
      hours: 4,
      tags: ['Pillar 2'],
    },
  ],
  '이행·안정화': [
    {
      type: 'auto',
      task: '세무 신고 이행 데이터 자동 검증 ({py}년 대비)',
      tool: '이행 검증 AI',
      hours: 3,
    },
    {
      type: 'auto',
      task: '세금계산서 발행 오류 실시간 AI 모니터링',
      tool: 'OmniEsol AI 모니터링',
      hours: 3,
      tags: ['전자세금계산서'],
    },
    {
      type: 'semi',
      task: '신고 기한 임박 항목 AI 알림 ({today} 기준 월별 일정)',
      tool: '세무 모니터링 AI',
      hours: 2,
    },
  ],
};

export const TAX = buildModuleData('TAX', RAW);
