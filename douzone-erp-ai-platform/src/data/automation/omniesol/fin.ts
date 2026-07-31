import { buildModuleData, type RawStageMap } from '../build';

/** FIN — 재무관리 (OmniEsol) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: 'OmniEsol 재무관리 현황 분석 및 As-Is 보고서 초안 ({today})',
      tool: 'Claude API / 회의록 분석',
      hours: 3,
    },
    {
      type: 'auto',
      task: '고객사 계정과목 ↔ OmniEsol 표준 매핑 자동 비교표',
      tool: '계정과목 매핑 AI',
      hours: 4,
    },
    {
      type: 'asst',
      task: 'K-IFRS 18 / 세법 적용 GAP 진단 (OmniEsol 구현 범위)',
      tool: 'K-IFRS 18 GAP AI',
      hours: 3,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교재무제표 범위 확인 ({ppy}~{cy}년, OmniEsol 집계 기준)',
      tool: '비교재무 분석 AI',
      hours: 3,
      tags: ['3개년비교'],
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'auto',
      task: 'OmniEsol K-IFRS 18 사용자정의 재무제표 템플릿 설계 초안',
      tool: 'K-IFRS 18 템플릿 AI',
      hours: 6,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교재무제표 양식 및 계정 매핑 설계 ({ppy}·{py}·{cy}년)',
      tool: '비교재무 템플릿 AI',
      hours: 5,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: '수정 분개 프로세스 설계 (발생·이연·감가·환율 유형별)',
      tool: '수정 분개 설계 AI',
      hours: 5,
      tags: ['수정분개'],
    },
    {
      type: 'semi',
      task: '결산 월마감·연마감 체크리스트 및 승인 워크플로우',
      tool: 'Claude API',
      hours: 4,
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: 'K-IFRS 18 사용자정의 재무제표 자동 출력 모듈 구성',
      tool: 'OmniEsol 리포트 엔진',
      hours: 6,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교재무제표 자동 집계 ({ppy}/{py}/{cy} 동시 조회)',
      tool: '비교재무 집계 배치',
      hours: 5,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: '수정 분개 자동화 (월말 자동 생성·역분개 예약·승인 알림)',
      tool: '수정 분개 자동화 엔진',
      hours: 5,
      tags: ['수정분개'],
    },
    {
      type: 'auto',
      task: '전표 자동분개 규칙 및 마감 배치 스케줄러',
      tool: 'OmniEsol 배치 자동화',
      hours: 4,
    },
  ],
  '테스트 (IUT)': [
    {
      type: 'auto',
      task: '전표·결산 TC 자동 생성 (80개+, 기준일: {today})',
      tool: 'TC 자동 생성 AI',
      hours: 5,
    },
    {
      type: 'auto',
      task: 'K-IFRS 18 재무제표 출력 정합성 검증 TC',
      tool: 'K-IFRS 18 검증 AI',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교 수치 연속성·재작성 정합성 자동 검증',
      tool: '비교재무 검증 배치',
      hours: 4,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: '수정 분개 누락·역분개 시나리오 TC 자동 생성',
      tool: '수정 분개 검증 AI',
      hours: 4,
      tags: ['수정분개'],
    },
  ],
  '이행·안정화': [
    {
      type: 'auto',
      task: '계정 잔액 이행 검증 ({py}년 기말 대사, {today})',
      tool: '이행 검증 배치',
      hours: 4,
    },
    {
      type: 'auto',
      task: 'K-IFRS 18 최초 적용 재무제표 이행 검증',
      tool: 'K-IFRS 18 이행 검증',
      hours: 5,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'semi',
      task: '수정 분개 누락 AI 탐지 — 월마감 전 자동 체크',
      tool: '수정 분개 모니터링 AI',
      hours: 3,
      tags: ['수정분개'],
    },
    {
      type: 'auto',
      task: '이상 전표 실시간 탐지 ({today}~ 기준)',
      tool: 'OmniEsol AI 모니터링',
      hours: 3,
    },
  ],
};

export const FIN = buildModuleData('FIN', RAW);
