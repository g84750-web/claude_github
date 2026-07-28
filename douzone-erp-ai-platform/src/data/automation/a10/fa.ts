import { buildModuleData, type RawStageMap } from '../build';

/** FA — 고정자산 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '자산 대장 현황 분석 및 데이터 품질 진단 ({today})',
      tool: '데이터 품질 AI',
      hours: 3,
    },
    {
      type: 'asst',
      task: '감가상각 방법별 현황 및 세법 기준 검토',
      tool: '문서 분석 AI',
      hours: 2,
    },
    {
      type: 'asst',
      task: 'K-IFRS 1116 리스 적용 현황 AI 진단 (사용권자산 인식 범위)',
      tool: 'RAG 기반 법령 검색',
      hours: 3,
      tags: ['K-IFRS 1116'],
    },
  ],
  '설계 (BD/DD)': [
    { type: 'semi', task: '자산 분류 체계 설계 초안', tool: '설계 AI', hours: 4 },
    {
      type: 'asst',
      task: '감가상각 시나리오 설계서 및 내용연수 가이드',
      tool: 'Claude AI',
      hours: 2,
    },
    {
      type: 'semi',
      task: 'K-IFRS 1116 사용권자산·리스부채 처리 설계',
      tool: '리스 설계 AI',
      hours: 4,
      tags: ['K-IFRS 1116'],
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: '자동 감가상각 계산 설정 (직선법·정률법)',
      tool: 'A10 감가상각 AI',
      hours: 3,
    },
    { type: 'semi', task: '자산 이상 거래 AI 탐지', tool: 'Anomaly Detection', hours: 3 },
    {
      type: 'auto',
      task: '리스 상각 스케줄 자동 생성 모듈 구성',
      tool: 'A10 리스 자동화',
      hours: 4,
      tags: ['K-IFRS 1116'],
    },
  ],
  '테스트 (IUT)': [
    { type: 'auto', task: '감가상각 시나리오 TC 자동 생성', tool: 'TC 자동화', hours: 3 },
    { type: 'semi', task: '자산 취득·처분·이전 시나리오 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: '리스부채 상각표 정합성 자동 검증 TC',
      tool: '리스 검증 배치',
      hours: 3,
      tags: ['K-IFRS 1116'],
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '자산 대장 이행 정합성 자동 검증', tool: '이행 검증 AI', hours: 3 },
    { type: 'auto', task: '잔존가치·내용연수 이상값 탐지', tool: 'A10 AI 모니터링', hours: 2 },
    {
      type: 'semi',
      task: '감가상각 수정 분개 누락 AI 점검 ({today}~ 기준)',
      tool: '수정 분개 모니터링 AI',
      hours: 3,
      tags: ['수정분개'],
    },
  ],
};

export const FA = buildModuleData('FA', RAW);
