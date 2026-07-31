import { buildModuleData, type RawStageMap } from '../build';

/** PP — 생산관리 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'asst',
      task: '생산 공정 현황 분석 및 병목 구간 진단 ({today})',
      tool: '공정 분석 AI',
      hours: 3,
    },
    { type: 'semi', task: 'BOM 구조 정합성 검토', tool: 'BOM 검증 AI', hours: 4 },
    {
      type: 'auto',
      task: '생산 실적 3개년 추이 자동 집계 ({ppy}~{cy}년)',
      tool: '비교 분석 AI',
      hours: 3,
      tags: ['3개년비교'],
    },
  ],
  '설계 (BD/DD)': [
    { type: 'semi', task: 'BOM/라우팅 설계서 초안', tool: '설계 AI', hours: 4 },
    { type: 'asst', task: '생산 일정 계획 프로세스 설계 가이드', tool: 'Claude AI', hours: 2 },
    {
      type: 'semi',
      task: '재공품 평가 및 원가 반영 프로세스 설계',
      tool: '원가 설계 AI',
      hours: 4,
    },
  ],
  '개발·구성': [
    { type: 'semi', task: 'AI 생산 일정 최적화 (수요 기반)', tool: '생산 최적화 AI', hours: 4 },
    { type: 'auto', task: '불량률 이상 탐지 자동 설정', tool: 'QC AI', hours: 3 },
    {
      type: 'auto',
      task: '재공품 평가 자동 계산 로직 구성 (월말 자동 반영)',
      tool: 'A10 원가 자동화',
      hours: 4,
    },
  ],
  '테스트 (IUT)': [
    { type: 'semi', task: '생산오더 시나리오 TC 자동 생성', tool: 'TC 자동화', hours: 3 },
    { type: 'auto', task: '원가 집계 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: 'BOM 전개 정합성 자동 검증 TC (다단계 구성)',
      tool: 'BOM 검증 배치',
      hours: 3,
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: 'BOM 이행 정합성 자동 검증', tool: '이행 검증 AI', hours: 4 },
    { type: 'auto', task: '생산 실적 이상값 자동 탐지', tool: 'A10 AI 모니터링', hours: 3 },
    {
      type: 'semi',
      task: '월간 생산·원가 분석 리포트 AI 자동 초안 ({today} 기준)',
      tool: '리포트 생성 AI',
      hours: 3,
    },
  ],
};

export const PP = buildModuleData('PP', RAW);
