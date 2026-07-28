# 더존 ERP AI 자동화 플랫폼

더존비즈온 PKG 사업본부 AI혁신TF — ERP AI 자동화 플랫폼 (React + TypeScript + Vite)

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # 제약 검증 + 타입 체크 + 프로덕션 빌드
npm run typecheck  # tsc --noEmit
npm run test       # Vitest 단위 테스트
npm run validate:constraints  # 절대 제약사항 정적 검증
```

## 절대 제약사항

| # | 제약 | 구현 |
|---|------|------|
| 1 | 외부 CDN 링크 금지 | 폰트 = 시스템 폰트 스택(`styles/tokens.css`), 아이콘 = 인라인 SVG(`ui/Icon.tsx`) |
| 2 | `localStorage` 금지 | `sessionStorage` 전용 (`lib/session.ts`) |
| 3 | 날짜 하드코딩 금지 | 모든 날짜·D-Day 는 `new Date()` 기준 런타임 산출 (`lib/date.ts`) |
| 4 | 단계명 순 한글 고정 | `착수·분석` / `이행·안정화` — 한자 혼용 금지, `lib/normalize.ts` 로 이중 방어 |
| 5 | API Key 노출 금지 | 사용자 입력 → `sessionStorage` → 메모리 전달만 허용 |

`npm run validate:constraints` 가 위 5개 항목을 정적 스캔으로 검증하며, `npm run build` 의 선행 단계로 실행된다.

## 진행 현황

- [x] **Phase 1 — 기반 구축** (1.1 프로젝트 초기화 / 1.2 디자인 토큰 / 1.3 타입 정의 / 1.4 아이콘)
- [x] **Phase 2 — 데이터 레이어** (2.1 모듈·단계 / 2.2 A10 35슬롯 / 2.3 OmniEsol 30슬롯 / 2.4 정규화·완전성 / 2.5 법령)
- [x] **Phase 3 — 비즈니스 로직** (3.1 날짜 / 3.2 KPI / 3.3 시뮬레이터 / 3.4 세션 / 3.5 Anthropic 스트리밍 / 3.6 목업) — 단위 테스트 72건
- [x] **Phase 4 — 상태 관리** (앱 / 실행이력 / 프로젝트 / API / 시뮬레이터 스토어)
- [x] **Phase 5 — UI 컴포넌트** (레이아웃 / 사이드바 / 카드 / 우측 5탭 / 토스트)
- [x] **Phase 6 — 통합 및 검증** (실행→KPI→슬라이더 연동 / 세션 초기화 / 제품 전환 / 콘솔 오류 0건 / 슬롯 실행)

## 디렉토리

```
src/
├── types/        # 도메인·자동화·KPI·프로젝트·법령 타입
├── data/         # 모듈·단계 정의, 자동화 항목 209건, 법령 8건
├── lib/          # 날짜·KPI·시뮬레이터·세션·Anthropic·목업·토큰·정규화
├── store/        # Zustand — 앱 / 실행이력 / 프로젝트 / API / 시뮬 / 토스트
├── hooks/        # useRunItem (실행 오케스트레이션)
├── components/   # layout / sidebar / center / panel / ui
├── styles/       # tokens.css (디자인 토큰) / global.css
└── App.tsx
scripts/
├── validate-constraints.ts   # 절대 제약 5종 정적 검증
└── validate-data.ts          # 슬롯·ID·토큰·법령 정합성 검증
```
