import { buildModuleData, type RawStageMap } from '../build';

/** FI — 재무회계 (Amaranth10) */
const RAW: RawStageMap = {
  '착수·분석': [
    {
      type: 'semi',
      task: '재무 프로세스 인터뷰 자동 구조화 및 As-Is 분석서 초안 ({today})',
      tool: 'Claude API / 회의록 분석',
      hours: 3,
    },
    {
      type: 'auto',
      task: '계정과목 자동 매핑 비교표 생성 (고객사 ↔ A10 표준)',
      tool: '계정과목 매핑 AI',
      hours: 4,
    },
    {
      type: 'asst',
      task: 'K-IFRS 18·세법 AI 요약 (부가세·법인세·수익인식 5단계)',
      tool: 'RAG 기반 법령 검색',
      hours: 2,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'semi',
      task: 'K-IFRS 18 GAP 진단 (수익인식 5단계 모델 기준)',
      tool: 'K-IFRS 18 GAP AI',
      hours: 4,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교재무제표 범위 확인 ({ppy}~{cy}년)',
      tool: '비교재무 분석 AI',
      hours: 3,
      tags: ['3개년비교'],
    },
  ],
  '설계 (BD/DD)': [
    {
      type: 'auto',
      task: '계정과목 매핑 설계서 초안 자동 생성',
      tool: 'Claude API / 문서 생성',
      hours: 5,
    },
    {
      type: 'semi',
      task: 'K-IFRS 18 사용자정의 재무제표 템플릿 설계 (손익·재무상태·현금흐름)',
      tool: 'K-IFRS 18 템플릿 AI',
      hours: 6,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교재무제표 양식 설계 ({ppy}·{py}·{cy}년 구조)',
      tool: '비교재무 템플릿 AI',
      hours: 5,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: '수정 분개 프로세스 설계 (발생·이연·감가·충당·환율 유형별)',
      tool: '수정 분개 설계 AI',
      hours: 5,
      tags: ['수정분개'],
    },
    {
      type: 'semi',
      task: '결산 프로세스 Flow 설계서 (월마감·연마감 체크리스트)',
      tool: 'Claude API',
      hours: 6,
    },
  ],
  '개발·구성': [
    {
      type: 'auto',
      task: '전표 자동분개 규칙 설정 (비용 유형별 차변/대변)',
      tool: 'A10 자동분개 AI',
      hours: 5,
    },
    {
      type: 'auto',
      task: 'K-IFRS 18 재무제표 자동 생성 모듈 구성 (표시 과목·주석 연결)',
      tool: 'K-IFRS 18 리포트 엔진',
      hours: 6,
      tags: ['K-IFRS 18'],
    },
    {
      type: 'auto',
      task: '3개년 비교재무제표 자동 집계 모듈 ({ppy}/{py}/{cy}년)',
      tool: '비교재무 집계 배치',
      hours: 5,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: '수정 분개 자동화 (월말 생성·승인 워크플로우·역분개 처리)',
      tool: '수정 분개 자동화 엔진',
      hours: 6,
      tags: ['수정분개'],
    },
    {
      type: 'auto',
      task: '마감 자동화 스케줄러 (월마감 시퀀스 자동 등록)',
      tool: 'A10 배치 자동화',
      hours: 3,
    },
  ],
  '테스트 (IUT)': [
    {
      type: 'auto',
      task: '전표 입력 TC 자동 생성 — 유형별 100개+ (기준일: {today})',
      tool: 'TC 자동 생성 AI',
      hours: 6,
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
      task: '3개년 비교 수치 정합성 자동 검증 ({ppy}/{py}/{cy}년)',
      tool: '비교재무 검증 배치',
      hours: 4,
      tags: ['3개년비교'],
    },
    {
      type: 'semi',
      task: '수정 분개 TC 자동 생성 (누락·역분개 시나리오)',
      tool: '수정 분개 검증 AI',
      hours: 4,
      tags: ['수정분개'],
    },
  ],
  '이행·안정화': [
    {
      type: 'auto',
      task: '계정 잔액 이행 검증 ({py}년 기말 대사, 기준일: {today})',
      tool: '이행 검증 배치',
      hours: 4,
    },
    {
      type: 'auto',
      task: 'K-IFRS 18 최초 적용 이행 검증 및 전환 조정 확인',
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
      tool: 'A10 AI 모니터링',
      hours: 3,
    },
    {
      type: 'asst',
      task: 'K-IFRS 18·세법 Q&A AI 봇',
      tool: 'RAG 기반 FAQ 봇',
      hours: 2,
      tags: ['K-IFRS 18'],
    },
  ],
};

export const FI = buildModuleData('FI', RAW);
