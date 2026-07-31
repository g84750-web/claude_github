import { buildModuleData, type RawStageMap } from '../build';

/** RPT — 경영보고 (OmniEsol) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '경영보고 현황 분석 및 BI 요건 정의 초안 ({today})',
      tool: 'Claude API',
      hours: 3,
    },
    {
      type: 'asst',
      task: 'K-IFRS 18 MPM(경영성과지표) 공시 요건 AI 안내',
      tool: 'K-IFRS 18 가이드 AI',
      hours: 2,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'asst',
      task: 'Pillar 2 글로벌 최저한세 보고 요건 AI 진단 ({cy}년 기준)',
      tool: 'RAG 세법 검색',
      hours: 3,
      tags: ['Pillar 2'],
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'semi',
      task: '경영보고서 양식 설계 초안 (K-IFRS 18 손익 구조 반영)',
      tool: '리포트 설계 AI',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교 경영보고서 레이아웃 설계 ({ppy}·{py}·{cy}년)',
      tool: '비교 리포트 AI',
      hours: 4,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: 'Pillar 2 최저한세 보고 항목 설계 (구성기업별 실효세율)',
      tool: 'Pillar 2 설계 AI',
      hours: 4,
      tags: ['Pillar 2'],
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: 'K-IFRS 18 MPM 자동 집계 및 경영보고서 자동 생성',
      tool: 'OmniEsol BI 엔진',
      hours: 6,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교 경영보고서 자동 출력 모듈 구성',
      tool: '비교 리포트 배치',
      hours: 5,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: 'AI 경영 분석 코멘트 자동 생성 (주요 변동 원인 분석)',
      tool: 'AI 코멘트 생성',
      hours: 4,
    },
  ],
  '테스트 (IUT)': [
    { type: 'auto', task: '경영보고서 출력 정합성 TC 자동 생성', tool: 'TC 자동화', hours: 4 },
    {
      type: 'semi',
      task: '3개년 비교 수치 정합성 자동 검증',
      tool: '자동 검증',
      hours: 3,
      tags: ['3개년비교'],
    },
    {
      type: 'auto',
      task: 'Pillar 2 보고 지표 산출 정합성 검증 TC',
      tool: 'Pillar 2 검증 AI',
      hours: 4,
      tags: ['Pillar 2'],
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '경영보고 데이터 이행 정합성 자동 검증', tool: '이행 검증 AI', hours: 3 },
    {
      type: 'auto',
      task: '월간 경영보고서 AI 자동 초안 생성 (매월 1일 배치)',
      tool: 'OmniEsol AI 모니터링',
      hours: 3,
    },
    {
      type: 'semi',
      task: 'MPM 지표 이상 변동 AI 탐지 ({today}~ 기준)',
      tool: 'BI 모니터링 AI',
      hours: 3,
      tags: ['K-IFRS 18'],
    },
  ],
};

export const RPT = buildModuleData('RPT', RAW);
