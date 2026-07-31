import { buildModuleData, type RawStageMap } from '../build';

/** CO — 관리회계 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    { type: 'semi', task: '원가 구조 분석 보고서 초안 ({today})', tool: 'Claude API', hours: 3 },
    { type: 'auto', task: '회의록 자동 요약 및 관리회계 니즈 구조화', tool: '회의록 AI', hours: 3 },
    {
      type: 'asst',
      task: 'Pillar 2 글로벌 최저한세 대응 범위 AI 진단 ({cy}년 기준)',
      tool: 'RAG 기반 법령 검색',
      hours: 2,
      tags: ['Pillar 2'],
    },
  ],
  '설계 (BD/DD)': [
    { type: 'semi', task: '코스트센터 계층 구조 설계 초안', tool: '조직 구조 AI', hours: 4 },
    { type: 'semi', task: '내부거래 배부 시나리오별 설계서', tool: '문서 생성 AI', hours: 4 },
    {
      type: 'auto',
      task: 'Pillar 2 실효세율 산출 항목 설계 (구성기업별 집계 구조)',
      tool: 'Pillar 2 설계 AI',
      hours: 4,
      tags: ['Pillar 2'],
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: '원가 배부 자동화 로직 (배부 기준별 자동 계산)',
      tool: 'A10 배부 자동화',
      hours: 4,
    },
    {
      type: 'semi',
      task: 'AI 예산 편차 이상 탐지 임계값 자동 제안',
      tool: 'Anomaly Detection',
      hours: 3,
    },
    {
      type: 'auto',
      task: 'Pillar 2 실효세율 자동 집계 모듈 구성 ({cy}년 귀속)',
      tool: 'Pillar 2 집계 배치',
      hours: 5,
      tags: ['Pillar 2'],
    },
  ],
  '테스트 (IUT)': [
    { type: 'semi', task: '배부 시나리오 TC 자동 생성', tool: 'TC 자동화', hours: 3 },
    { type: 'auto', task: '예산 대비 실적 검증 자동화', tool: '자동 검증 배치', hours: 3 },
    {
      type: 'auto',
      task: 'Pillar 2 실효세율 계산 정합성 검증 TC',
      tool: 'Pillar 2 검증 AI',
      hours: 4,
      tags: ['Pillar 2'],
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '원가 기초 데이터 이행 정합성 자동 검증', tool: '이행 검증 AI', hours: 4 },
    {
      type: 'semi',
      task: '월간 관리회계 분석 리포트 AI 자동 초안',
      tool: '리포트 생성 AI',
      hours: 4,
    },
    {
      type: 'auto',
      task: '배부 결과 이상값 실시간 탐지 ({today}~ 기준)',
      tool: 'A10 AI 모니터링',
      hours: 3,
    },
  ],
};

export const CO = buildModuleData('CO', RAW);
