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

## 배포

`main` 에 머지되면 `.github/workflows/deploy-pages.yml` 이 테스트 → 빌드 → 게시를 수행한다.

| 대상 | 주소 |
|------|------|
| 앱 | `https://g84750-web.github.io/claude_github/erp-ai/` |
| 단일 파일 | `https://g84750-web.github.io/claude_github/erp-ai/standalone.html` |

`gh-pages` 브랜치 루트에는 별도 사이트가 이미 게시되어 있으므로 `erp-ai/` 하위만 교체한다.
프로젝트 페이지는 `/<repo>/erp-ai/` 경로에 놓이므로 워크플로가 `VITE_BASE` 를 주입하며,
값이 없으면 `'/'` 이므로 로컬 `dev` · `preview` 는 영향을 받지 않는다.

```bash
npm run build:single   # dist/standalone.html — 정적 호스팅 없이 파일 하나로 실행
```

API 키 없이 열면 시뮬레이션 모드로 209항목이 모두 동작한다. 키는 브라우저에 노출되는
구조이므로 공개 주소에서 개인 키 입력은 권장하지 않는다.

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
- [x] **Phase 3 — 비즈니스 로직** (3.1 날짜 / 3.2 KPI / 3.3 시뮬레이터 / 3.4 세션 / 3.5 Anthropic 스트리밍 / 3.6 목업)
- [x] **Phase 4 — 상태 관리** (앱 / 실행이력 / 프로젝트 / API / 시뮬레이터 / 토스트 스토어)
- [x] **Phase 5 — UI 컴포넌트** (레이아웃 / 사이드바 / 카드 / 우측 5탭 / 토스트)
- [x] **Phase 6 — 통합 및 검증** (실행→KPI→슬라이더 연동 / 세션 초기화 / 제품 전환)

검증 현황: 단위 테스트 **95건** 전부 통과 · 65슬롯 209항목 **전수 실행 209/209** · 콘솔 오류 0건 · 외부 요청 0건

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
