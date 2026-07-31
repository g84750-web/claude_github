import { buildModuleData, type RawStageMap } from '../build';

/** HRM — 인사급여 (OmniEsol) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '인사급여 현황 분석 및 As-Is 보고서 초안 ({today})',
      tool: 'Claude API',
      hours: 3,
    },
    { type: 'auto', task: '직원 마스터 데이터 품질 자동 진단', tool: '마스터 AI', hours: 4 },
    {
      type: 'asst',
      task: '{cy}년 노동법·급여 관련 법령 변경 사항 AI 요약',
      tool: 'RAG 법령 AI',
      hours: 2,
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'semi',
      task: '급여 항목 설계서 초안 (과세/비과세, {cy}년 귀속 기준)',
      tool: '급여 설계 AI',
      hours: 5,
    },
    { type: 'asst', task: '근태·휴가 정책 설계 가이드 및 노동법 검토', tool: 'RAG 법령 AI', hours: 2 },
    {
      type: 'semi',
      task: '원천세 서식 변경 대응 설계 ({cy}년 귀속 신고 서식)',
      tool: '세무 설계 AI',
      hours: 4,
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: '급여 계산 로직 자동 검증 (소득세·4대보험 {cy}년 기준)',
      tool: '급여 계산 AI',
      hours: 5,
    },
    {
      type: 'auto',
      task: '원천세·연말정산 자동 연계 ({cy}년 귀속 서식)',
      tool: '세무 자동화',
      hours: 4,
    },
    {
      type: 'semi',
      task: '근태 이상 패턴 AI 탐지 (무단결근·패턴 이상)',
      tool: '근태 AI',
      hours: 3,
    },
  ],
  '테스트 (IUT)': [
    { type: 'auto', task: '급여 계산 TC 자동 생성 (직급별·호봉별)', tool: 'TC 자동화', hours: 5 },
    { type: 'semi', task: '조직 변경 시나리오 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: '원천세 신고 데이터 정합성 검증 TC ({cy}년 서식 반영)',
      tool: '세무 검증 AI',
      hours: 4,
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '인사 데이터 이행 품질 자동 검증', tool: '이행 검증 AI', hours: 4 },
    { type: 'auto', task: '급여 오류 AI 실시간 탐지', tool: 'OmniEsol AI 모니터링', hours: 3 },
    {
      type: 'semi',
      task: '연말정산 준비 현황 AI 점검 ({cy}년 귀속, {today} 기준)',
      tool: '세무 모니터링 AI',
      hours: 3,
    },
  ],
};

export const HRM = buildModuleData('HRM', RAW);
