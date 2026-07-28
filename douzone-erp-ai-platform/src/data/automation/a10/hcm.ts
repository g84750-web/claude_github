import { buildModuleData, type RawStageMap } from '../build';

/** HCM — 인사·급여 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '조직 구조 현황 분석 및 To-Be 설계 AI 제안 ({today})',
      tool: '조직 분석 AI',
      hours: 3,
    },
    { type: 'auto', task: '직원 데이터 품질 자동 진단', tool: '마스터 AI', hours: 5 },
    {
      type: 'asst',
      task: '{cy}년 원천세 서식 변경 및 노동법 개정 AI 요약',
      tool: 'RAG 법령 AI',
      hours: 2,
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'semi',
      task: '급여 항목 설계 문서 초안 ({cy}년 귀속 기준, 과세/비과세)',
      tool: 'Claude API',
      hours: 5,
    },
    { type: 'asst', task: '근태·휴가 정책 설계 및 노동법 검토', tool: 'RAG 법령 AI', hours: 2 },
    {
      type: 'semi',
      task: '원천세 신고 서식 변경 대응 설계 ({cy}년 귀속 서식)',
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
      task: '근태 이상 패턴 AI 탐지 설정 (무단결근·초과근무)',
      tool: '근태 AI',
      hours: 3,
    },
  ],
  '테스트 (IUT)': [
    { type: 'auto', task: '급여 계산 TC 자동 생성 (직급별·호봉별)', tool: 'TC 자동화', hours: 5 },
    { type: 'semi', task: '조직 변경 시나리오 자동 검증', tool: '자동 검증', hours: 3 },
    {
      type: 'auto',
      task: '원천세 신고 데이터 정합성 검증 TC ({cy}년 서식)',
      tool: '세무 검증 AI',
      hours: 4,
    },
  ],
  '이행·안정화': [
    { type: 'auto', task: '인사 데이터 이행 품질 자동 검증', tool: '이행 검증 AI', hours: 4 },
    { type: 'auto', task: '급여 오류 AI 실시간 탐지', tool: 'A10 AI 모니터링', hours: 3 },
    {
      type: 'semi',
      task: '연말정산 준비 현황 AI 점검 ({cy}년 귀속, {today} 기준)',
      tool: '세무 모니터링 AI',
      hours: 3,
    },
  ],
};

export const HCM = buildModuleData('HCM', RAW);
