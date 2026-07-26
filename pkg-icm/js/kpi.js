/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — KPI 산출 엔진
   기준 문서: PKG사업본부 A10 구축업무 ERP 관리지표 가이드라인 v1.0
             (KPI Definition Book / 7 Pillar)
   참조 기준: EQT 구축·컨설팅 관리지표 가이드라인 v2.0

   산출상태(state) 정의
     auto    — GCMS 현행 데이터로 공식 그대로 자동 산출
     proxy   — 원천 필드 일부 부재. 가이드라인 명시 대체값으로 근사 산출
     pending — 원천 시스템 미연동. 로드맵 Phase에 따라 연동 후 산출
   ══════════════════════════════════════════════════════════════════ */
const KPI = (() => {

  const PILLARS = [
    { no: 1, name: 'Project Delivery & Progress', ko: '구축 진척 · 납기 · 완료율',
      desc: 'PKG사업본부의 가장 근본적인 생산성 지표. 구축 접수 대비 완료 처리 능력을 측정한다.' },
    { no: 2, name: 'Margin Quality & Revenue Mix', ko: '수익성 · 마진 품질',
      desc: '구축방식·모듈별 GM% 및 비용 효율. ERP 원가 연동이 선결 과제.' },
    { no: 3, name: 'Standardization & Scalability', ko: '표준화 · 확장성 ★',
      desc: 'FoEX 방식 전환율이 PKG사업본부의 핵심 가치 동인. CTD·GM%에 직접 연동된다.' },
    { no: 4, name: 'Resource Productivity & Utilization', ko: '인력 가동률 · 생산성',
      desc: 'PM당 관리 건수, Billable Utilization, 지역별 효율 최적화.' },
    { no: 5, name: 'Customer Outcome & ARR Renewal', ko: '고객 성과 · ARR 갱신',
      desc: 'TTV, CSAT, Renewal-Ready, AI Attach Rate. VOC·A10 사용로그 연동 필요.' },
    { no: 6, name: 'Quality & Risk Management', ko: '품질 · 리스크',
      desc: '이월 부담, 지연 프로젝트, H/W 조달 리스크, 개통 안정성.' },
    { no: 7, name: 'AI Transformation KPIs', ko: 'AI 전환 지표',
      desc: 'PM AI DAU%, 공수 절감률, Embedded AI ARR. EQT iLevel 연계 지표.' },
  ];

  /* ── 산출 헬퍼 ───────────────────────────────────────────────── */
  const pct = (n, d) => (d > 0 ? n / d * 100 : null);
  const f1 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(1);
  const f0 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : Math.round(v).toLocaleString();
  const NA = { v: null, disp: '연동 필요', sub: '', detail: [] };

  /* 진행 중(활성) 프로젝트: 화면정의서 slide5 — 상태가 <완료,반품>이 아닌 건 */
  const activeOf = D => D.rows.filter(p => p.isActive);

  /* ── KPI 정의 목록 ───────────────────────────────────────────── */
  const LIST = [

    /* ═══════════ Pillar 1 — Project Delivery & Progress ═══════════ */
    {
      id: '1.1', pillar: 1, star: true, name: '구축 완료율 (건수 기준)',
      def: 'PKG사업본부 A10 구축 사업의 누적 완료 건수 비율. 분기·연간 구축 처리 능력의 핵심 지표.',
      formula: '완료율(%) = 구축완료(B) / 구축접수(A) × 100\n구축접수(A) = 전년이월 + 당해연도 신규접수\n구축완료(B) = 개통확인서 발행 완료 건 (누적)',
      source: 'GCMS: 완료 상태코드, 접수 마스터',
      cycle: '월간 누적 / 전체·구축방식별·지역별·서버유형별',
      target: '월간 누적 70%+, 연말 90%+', targetVal: 70, op: 'gte', unit: '%',
      asIs: '58.4% (2026 1~5월)', state: 'auto',
      note: 'GCMS 수기 입력 → NSM10 자동 집계 연동 필요(Phase 1). 전년이월 비중 관리 병행.',
      calc: D => {
        const done = D.rows.filter(p => p.status === '완료').length;
        const v = pct(done, D.rows.length);
        return { v, disp: f1(v) + '%', sub: `완료 ${done.toLocaleString()}건 / 접수 ${D.rows.length.toLocaleString()}건` };
      }
    },
    {
      id: '1.2', pillar: 1, name: '완료율 (금액 기준)',
      def: '총접수금액 대비 완료금액 비율. 건수 완료율과의 Gap은 고단가 구축형 완료 지연 신호.',
      formula: '금액 완료율(%) = 누적완료금액 / 누적접수금액 × 100\nGap = 건수 완료율 − 금액 완료율  (Gap > 0: 고단가 지연)',
      source: 'NSM10/AMS: 계약금액, GCMS: 완료 상태',
      cycle: '월간 누적',
      target: '금액 완료율 50%+ (상반기), 70%+ (연간). 건수 Gap ±3%p 이내', unit: '%',
      asIs: '52.4% (건수 대비 −6.0%p)', state: 'pending',
      note: 'NSM10/AMS 계약금액(총수주액·라이선스·교육비) 연동 필요. 화면정의서 [빌링정보] 탭 원천.',
      calc: () => NA
    },
    {
      id: '1.3', pillar: 1, name: '재공 처리 속도',
      def: '전월 잔여건 대비 당월 완료 처리 비율. 재공(WIP) 소화 속도의 효율 지표.',
      formula: '처리 속도(%) = 당월 완료건수(B) / 전월 말 재공 잔여건수 × 100\n재공 잔여 = 전월 잔여 − 당월 완료 − 당월 반품 + 당월 신규접수',
      source: 'GCMS: 월별 완료건 집계, 잔여건 집계',
      cycle: '월간 스냅샷',
      target: '월간 30%+ (최저), 35%+ (목표)', targetVal: 35, op: 'gte', unit: '%',
      asIs: '31.2% (4개월 평균)', state: 'proxy',
      note: '구축완료보고일 원천 미보유 → 완료예정일을 완료 시점 대체값으로 사용. Phase 1 연동 시 정합.',
      calc: D => {
        // 접수 마지막 월을 현재 시점 경계로 사용 (이후 월은 완료예정일만 존재하는 미래 구간)
        const bound = D.meta.lastReceipt.slice(0, 7);
        const ms = D.monthly.filter(x => x.ym <= bound);
        if (ms.length < 2) return NA;
        const rates = [];
        for (let i = 1; i < ms.length; i++) {
          if (ms[i - 1].wip > 0) rates.push({ ym: ms[i].ym, r: pct(ms[i].completed, ms[i - 1].wip), c: ms[i].completed, w: ms[i - 1].wip });
        }
        if (!rates.length) return NA;
        const last4 = rates.slice(-4);
        const v = last4.reduce((a, x) => a + x.r, 0) / last4.length;
        const cur = rates[rates.length - 1];
        return {
          v, disp: f1(v) + '%',
          sub: `최근 ${last4.length}개월 평균 · ${cur.ym} 완료 ${cur.c}건 / 전월말 재공 ${f0(cur.w)}건`,
          detail: last4.map(x => ({ label: x.ym, value: `${f1(x.r)}% (완료 ${x.c} / 재공 ${f0(x.w)})` }))
        };
      }
    },
    {
      id: '1.4', pillar: 1, name: '구축방식별 완료율',
      def: '방문구축·FoEX교육(1:N)·FoEX단독·FoEX+방문 복합 유형별 완료율. 방식별 효율 비교.',
      formula: '구축방식별 완료율(%) = 해당 방식 완료건 / 해당 방식 접수건 × 100\n─ 방문구축 / FoEX(1:N) / FoEX단독 / FoEX+방문 복합 4유형 분리 산출',
      source: 'GCMS: 구축방식 분류 코드',
      cycle: '월간 / 유형별',
      target: 'FoEX단독 70%+, 방문구축 58%+, 복합 58%+, FoEX(1:N) 58%+', targetVal: 58, op: 'gte', unit: '%',
      asIs: 'FoEX단독 68.5% (최고) / 복합 54.7% (최저)', state: 'auto',
      calc: D => {
        const g = D.byMethod;
        const best = [...g].sort((a, b) => b.doneRate - a.doneRate)[0];
        return {
          v: best ? best.doneRate : null,
          disp: best ? f1(best.doneRate) + '%' : '—',
          sub: best ? `최고: ${best.key}` : '',
          detail: g.map(x => ({ label: x.key, value: `${f1(x.doneRate)}% (${x.done}/${x.total})` }))
        };
      }
    },
    {
      id: '1.5', pillar: 1, name: 'SaaS vs 구축형 완료율 Gap',
      def: 'SaaS(클라우드)와 구축형(On-premise) 간 완료율 차이. H/W 조달 지연 등 구조적 문제 측정.',
      formula: 'Gap(%p) = SaaS 완료율 − 구축형 완료율\n─ SaaS 완료율 = SaaS 완료건 / SaaS 접수건 × 100\n─ 구축형 완료율 = 구축형 완료건 / 구축형 접수건 × 100',
      source: 'GCMS: 서버유형 코드 (SaaS / 구축형)',
      cycle: '월간',
      target: 'Gap 5%p 이내로 축소. 구축형 완료율 55%+', targetVal: 5, op: 'lte', unit: '%p',
      asIs: '7.5%p', state: 'auto',
      note: '구축형 지연 주요 원인: 더존구매팀↔DELL↔고은정보통신 H/W 납품 대기. 조달 SLA 설정 필요.',
      calc: D => {
        const s = D.byServer.find(x => x.key === 'SaaS');
        const o = D.byServer.find(x => x.key === '구축형');
        if (!s || !o) return NA;
        const v = s.doneRate - o.doneRate;
        return {
          v: Math.abs(v), disp: f1(v) + '%p',
          sub: `SaaS ${f1(s.doneRate)}% / 구축형 ${f1(o.doneRate)}%`,
          detail: [
            { label: 'SaaS', value: `${f1(s.doneRate)}% (${s.done}/${s.total})` },
            { label: '구축형(On-prem)', value: `${f1(o.doneRate)}% (${o.done}/${o.total})` }
          ]
        };
      }
    },
    {
      id: '1.6', pillar: 1, name: '반품률 (Cancellation Rate)',
      def: '접수 후 고객 사정 등으로 취소된 프로젝트 비율. 수주 품질 및 초기 고객 검증 수준 측정.',
      formula: '반품률(%) = 반품(C) / 접수(A) × 100',
      source: 'GCMS: 반품 상태코드 / NSM10: 취소 계약',
      cycle: '월간 누적',
      target: '0.5% 이내 유지', targetVal: 0.5, op: 'lte', unit: '%',
      asIs: '0.44% (양호)', state: 'auto',
      calc: D => {
        const c = D.rows.filter(p => p.status === '반품').length;
        const v = pct(c, D.rows.length);
        return { v, disp: f1(v) + '%', sub: `반품 ${c}건 / 접수 ${D.rows.length.toLocaleString()}건` };
      }
    },

    /* ═══════════ Pillar 2 — Margin Quality & Revenue Mix ═══════════ */
    {
      id: '2.1', pillar: 2, name: '건당 평균 완료금액',
      def: '완료 처리된 프로젝트 1건당 평균 매출 금액. 고단가 프로젝트 완료 집중 여부를 측정.',
      formula: '건당 완료금액(백만원) = 누적완료금액 / 누적완료건수\nGap = 건당 수주금액 − 건당 완료금액  (Gap > 0: 고단가 지연)',
      source: 'NSM10/AMS: 계약금액, GCMS: 완료건 집계',
      cycle: '월간',
      target: '건당 완료금액 ≥ 건당 수주금액 × 0.95. Gap 5% 이내', unit: '백만원',
      asIs: '25.5백만원 (수주 28.5M 대비 −3.0M)', state: 'pending',
      note: '화면정의서 [빌링정보] 탭 — 총수주액·라이선스·교육비 필드 NSM10 연동 후 산출.',
      calc: () => NA
    },
    {
      id: '2.2', pillar: 2, star: true, name: '구축 Gross Margin (GM%)',
      def: '구축 사업 매출총이익률. EQT BMS 핵심 수익성 지표.',
      formula: 'GM% = (구축매출 − 직접원가) / 구축매출 × 100\n직접원가 = 인건비(투입MD × 원가율) + 외주비 + 자재비 + 직접출장비\n※ 간접비·본사비·R&D 배부 제외 (Pure Project Margin)',
      source: 'ERP(옴니이솔): 매출·직접원가 / HR: 직급별 원가율 / GCMS: 투입MD',
      cycle: '월간 / 프로젝트·구축방식별',
      target: '25%+ (전체), FoEX단독 30%+. 분기 변동성 ±3%p 이내', targetVal: 25, op: 'gte', unit: '%',
      asIs: '측정 필요 (EQT Median 23%)', state: 'pending',
      note: '투입MD는 GCMS 보유(산출 가능). 직급별 원가율(HR) + 매출(ERP) 연동 시 즉시 자동 산출 가능.',
      calc: () => NA
    },
    {
      id: '2.3', pillar: 2, name: '비용 대비 처리 효율 (CTD)',
      def: '완료 프로젝트 1건당 평균 직접원가. 표준화·FoEX 확대 효과를 비용 측면에서 측정.',
      formula: 'CTD = 분기 누적 직접원가 / 분기 완료 건수\n※ 구축방식별(방문구축 vs FoEX단독) 분리 산출 병행',
      source: 'ERP: 직접원가 / GCMS: 완료건 마스터',
      cycle: '분기 / 구축방식·서버유형별',
      target: 'YoY −5% 이상. FoEX단독 CTD가 방문구축 대비 25% 이하', unit: '원/건',
      asIs: '측정 필요', state: 'pending',
      note: '분모(구축방식별 완료건수)는 GCMS로 산출 가능. ERP 직접원가 연동이 선결 과제.',
      calc: () => NA
    },
    {
      id: '2.4', pillar: 2, name: '매출 실현율 (Realization Rate)',
      def: '투입된 유상 공수(MD) 중 실제 청구된 비율. 무상 추가 작업으로 인한 수익 누수 측정.',
      formula: 'RR% = 청구가능 인일수(Billed MD) / 투입 유상 인일수(Billable MD) × 100\n※ 청구 MD = ERP 청구서 기준 / 투입 MD = GCMS MD실적등록 기준',
      source: 'ERP: 청구서 / GCMS(HR): MD실적등록',
      cycle: '월간 / 프로젝트별',
      target: '90%+. 범위외 무상작업 누적 시 즉시 VRB 수행', targetVal: 90, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'pending',
      note: '화면정의서 [투입정보] 탭의 <공수구분(유/무/기타)>·<선발행여부> 필드 입력 체계 확립이 선결.',
      calc: () => NA
    },
    {
      id: '2.5', pillar: 2, name: '모듈 구성별 수익 Mix',
      def: '관리모듈·전모듈·전방모듈·UC모듈 등 모듈 구성별 매출 비중과 GM%. 수익성 높은 Mix로 개선.',
      formula: '모듈 Mix(%) = 해당 모듈 구성 완료금액 / 전체 완료금액 × 100\n모듈별 GM% = 해당 모듈 구성 GM 합계 / 해당 모듈 구성 매출 × 100',
      source: 'NSM10/AMS: 모듈 구성 코드 / ERP: 원가·매출',
      cycle: '분기',
      target: '관리모듈 단독 비중 65% 이하로 축소, 전모듈 비중 25%+ 확대', unit: '%',
      asIs: '전모듈 19.9% 비중', state: 'proxy',
      note: '금액 원천(ERP) 미연동 → 배정정보 모듈 태그 기준 <건수> Mix로 대체 산출.',
      calc: D => {
        const cnt = new Map();
        let tot = 0;
        D.rows.forEach(p => p.assignees.forEach(a => a.modules.forEach(m => {
          cnt.set(m, (cnt.get(m) || 0) + 1); tot++;
        })));
        if (!tot) return NA;
        const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        return {
          v: null, disp: `${cnt.size}개 모듈`, sub: `배정 태그 ${tot.toLocaleString()}건 기준 (건수 Mix)`,
          detail: top.map(([m, c]) => ({ label: m, value: `${f1(c / tot * 100)}% (${c}건)` }))
        };
      }
    },

    /* ═══════════ Pillar 3 — Standardization & Scalability ═══════════ */
    {
      id: '3.1', pillar: 3, star: true, name: 'FoEX 방식 전환율 (FAR)',
      def: 'EQT SPAR(Standard Product Adoption Rate)의 PKG 버전. 방문구축 대비 FoEX 방식 적용 비율. 표준화·확장성의 핵심 가치 동인.',
      formula: 'FAR(%) = FoEX 방식 접수건 / 전체 접수건 × 100\nFoEX 방식 = FoEX교육(단독) + FoEX교육(1:N) + FoEX(1:N)+방문 복합 합산\n※ 순수 FoEX(방문 없음) 비중 분리 보고 권장',
      source: 'GCMS: 구축방식 분류 코드',
      cycle: '월간 / 신규접수·처리별',
      target: '전체 FAR 50%+ (방문구축 50% 미만). FoEX단독 비중 20%+', targetVal: 50, op: 'gte', unit: '%',
      asIs: '41.4% (EQT Median 60%)', state: 'auto',
      note: 'FoEX 1:N은 처리 효율 방문구축 대비 6.3배. FAR 개선이 CTD·GM%에 직접 연동.',
      calc: D => {
        const foex = D.rows.filter(p => p.isFoEX).length;
        const pure = D.rows.filter(p => p.isPureFoEX).length;
        const v = pct(foex, D.rows.length);
        return {
          v, disp: f1(v) + '%',
          sub: `FoEX ${foex.toLocaleString()}건 / 전체 ${D.rows.length.toLocaleString()}건`,
          detail: [
            { label: '전체 FAR (복합 포함)', value: `${f1(v)}% (${foex}건)` },
            { label: '순수 FoEX (방문 없음)', value: `${f1(pct(pure, D.rows.length))}% (${pure}건)` },
            { label: '방문구축 비중', value: `${f1(pct(D.rows.length - foex, D.rows.length))}%` }
          ]
        };
      }
    },
    {
      id: '3.2', pillar: 3, name: '업세일(Upsell) 전환율',
      def: 'BizboxA/iCUBE → Amaranth10 전환(업세일) 비중. PKG사업본부 성장의 주요 엔진.',
      formula: '업세일 전환율(%) = 업세일 접수건 / 전체 접수건 × 100\n업세일 = BizboxA/iCUBE에서 A10으로 전환한 계약',
      source: 'NSM10/AMS: 계약유형 코드(업세일/신규)',
      cycle: '월간 / 누적 분기',
      target: '업세일 비중 80%+ 유지. 신규 15~20% 전략 확보', targetVal: 80, op: 'gte', unit: '%',
      asIs: '85.5%', state: 'proxy',
      note: 'NSM10 계약유형 코드 미연동 → GCMS <프로젝트구분(신규/추가)> 기준 대체 표기. 업세일 정의와 불일치하므로 Phase 1 연동 필수.',
      calc: D => {
        const g = D.byPjtType;
        return {
          v: null, disp: '대체 지표',
          sub: 'GCMS 프로젝트구분 기준 (업세일 코드 아님)',
          detail: g.map(x => ({ label: x.key, value: `${f1(pct(x.total, D.rows.length))}% (${x.total.toLocaleString()}건)` }))
        };
      }
    },
    {
      id: '3.3', pillar: 3, name: '구축 방법론 준수율 (MC%)',
      def: '표준 PMO 방법론(산출물·게이트·승인) 준수율. A10 구축 6단계 기준.',
      formula: 'MC% = 게이트 통과 산출물 수 / 표준 게이트 산출물 수 × 100\n6단계: 착수(PO) → 분석 → 설계 → 개발 → 테스트(UAT) → 완료(개통확인서)',
      source: 'GCMS: 게이트 체크리스트·승인 로그 (Phase 1 개발 필요)',
      cycle: '프로젝트별 / 분기 가중평균',
      target: '95%+. 개통확인서 미발행 완료 처리 0건', targetVal: 95, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'pending',
      note: '화면정의서 [투입정보] 탭의 <회의록>·<교육확인서> 증적 필드가 게이트 산출물 원천. 체크리스트 메뉴 신설 필요.',
      calc: () => NA
    },
    {
      id: '3.4', pillar: 3, name: '산업팩 / Quick-Start 채택률',
      def: '사전 구성된 A10 산업군별 구축 가이드(Quick-Start 패키지)로 시작한 프로젝트 비율.',
      formula: 'QS% = Quick-Start 패키지 시작 프로젝트 수 / 신규 시작 프로젝트 수 × 100',
      source: 'NSM10: 프로젝트 시작 시 패키지 코드 / GCMS: 구축 착수 템플릿',
      cycle: '월간',
      target: '신규 프로젝트 50%+', targetVal: 50, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'pending',
      note: 'ERPBG_SCM구축본부 OmniEsol 구축가이드 산업군별 팩 카탈로그 코드 신설 필요.',
      calc: () => NA
    },

    /* ═══════════ Pillar 4 — Resource Productivity ═══════════ */
    {
      id: '4.1', pillar: 4, star: true, name: '컨설턴트 Billable Utilization (BU%)',
      def: '유상 청구 가능한 시간(MD)의 비중. PKG 구축 인력의 핵심 가동성과 지표.',
      formula: 'BU% = 유상투입 MD / (총가동 MD − 휴가 − 법정휴일 − 표준교육) × 100\n유상투입 MD = GCMS MD실적등록 중 프로젝트 투입 MD (공통 제외)',
      source: 'GCMS(HR): MD실적등록 (Billable 플래그 구분 입력 필요)',
      cycle: '월간 / 본부·팀·개인 단위',
      target: '개인 70%+, 팀 평균 75%+. 상한 85% (번아웃 방지)', targetVal: 75, op: 'gte', unit: '%',
      asIs: '측정 필요 (EQT Median 75%)', state: 'pending',
      note: '분자(유상투입 MD)는 GCMS 보유. 분모(가동 MD·휴가·법정휴일) HR 연동 필요. 즉시 실행 3순위 과제.',
      calc: D => {
        const md = D.rows.reduce((a, p) => a + p.mdInPaid, 0);
        return {
          v: null, disp: '연동 필요',
          sub: `분자 산출 가능: 총 투입 ${f0(md)} MD · 구축인력 ${D.assignees.length}명`,
          detail: [{ label: '1인 평균 투입 MD', value: `${f1(md / D.assignees.length)} MD` }]
        };
      }
    },
    {
      id: '4.2', pillar: 4, name: 'PM당 동시 관리 프로젝트 수',
      def: 'PM 1인이 동시에 책임지는 활성 프로젝트 수. 과부하 모니터링 및 인력 배분 효율 지표.',
      formula: '동시 관리수 = 진행중 프로젝트 수 / PM 수 (활성 PM 기준)\n※ FoEX(1:N)은 동시 수강 고객수로 별도 산출',
      source: 'GCMS: 프로젝트-PM 배정 현황',
      cycle: '월간 스냅샷 / PM별·팀별',
      target: '방문구축 PM 10건 이하. FoEX 강사 동시 그룹 5개 이하', targetVal: 10, op: 'lte', unit: '건',
      asIs: 'PM당 8건', state: 'auto',
      calc: D => {
        const act = activeOf(D);
        const pmSet = new Set(act.map(p => p.pm));
        const v = pmSet.size > 0 ? act.length / pmSet.size : null;
        const load = new Map();
        act.forEach(p => load.set(p.pm, (load.get(p.pm) || 0) + 1));
        const over = [...load.entries()].filter(([, c]) => c > 10).sort((a, b) => b[1] - a[1]);
        return {
          v, disp: f1(v) + '건',
          sub: `진행 ${act.length.toLocaleString()}건 / 활성 PM ${pmSet.size}명`,
          detail: [
            { label: '10건 초과 PM (과부하)', value: `${over.length}명` },
            ...over.slice(0, 5).map(([n, c]) => ({ label: n, value: `${c}건` }))
          ]
        };
      }
    },
    {
      id: '4.3', pillar: 4, name: '월평균 완료 처리 건수 (생산성)',
      def: '컨설턴트 1인당 월간 완료 처리 건수. 구축방식별 개인 생산성 벤치마크.',
      formula: '인당 완료 건수 = 팀 월 완료건수 / 팀 FTE (투입인력 수)\n※ FoEX단독·방문구축·복합 구분 분리 산출',
      source: 'GCMS: 월 완료건 / HR: FTE',
      cycle: '월간',
      target: '방문구축 8건+, FoEX단독 15건+, 전체 평균 10건+', targetVal: 10, op: 'gte', unit: '건/월',
      asIs: '인당 8.7건/월', state: 'proxy',
      note: 'HR FTE 원천 미연동 → 배정정보 기준 <구축 참여 인원수>를 FTE 대체값으로 사용. ' +
            '본 데이터셋은 전체 구축 건의 부분 추출본이므로 절대값은 가이드라인 As-Is와 직접 비교하지 않는다.',
      calc: D => {
        const bound = D.meta.lastReceipt.slice(0, 7);
        const done = D.rows.filter(p => p.status === '완료' && p.dueYM && p.dueYM <= bound);
        const months = new Set(done.map(p => p.dueYM)).size || 1;
        const fte = D.assignees.length || 1;
        const perMonth = done.length / months;
        const v = perMonth / fte;
        return {
          v, disp: f1(v) + '건',
          sub: `월평균 완료 ${f1(perMonth)}건 / FTE ${fte}명 (${months}개월 기준)`,
          detail: [
            { label: '월평균 완료 건수', value: `${f1(perMonth)}건` },
            { label: 'FTE (구축 참여 인원)', value: `${fte}명` },
            ...D.byMethod.map(x => ({ label: x.key, value: `누적 완료 ${x.done}건` }))
          ]
        };
      }
    },
    {
      id: '4.4', pillar: 4, name: '지역별 인력 효율',
      def: '지역(수도권·중부호남·부산영남)별 처리 효율. 인력 불균형 및 FoEX 확대 필요 지역 진단.',
      formula: '지역 처리 비율(%) = 지역 완료건 / 지역 접수건 × 100\n지역 부담 지수 = 지역 접수 비중(%) / 지역 인력 비중(%)  (>1이면 인력 부족)',
      source: 'GCMS: 지역 코드 / HR: 지역 배정 인력',
      cycle: '분기',
      target: '지역 간 완료율 편차 5%p 이내', targetVal: 5, op: 'lte', unit: '%p',
      asIs: '수도권 60.3% / 중부호남 55.0%', state: 'proxy',
      note: 'GCMS 구축지역 코드 미보유 → 구축부서(Unit) 기준 대체 산출. 화면정의서 [구축정보] 탭 <구축지역> 필드 신설 필요. ' +
            '표본 10건 미만 조직은 편차 산출에서 제외한다.',
      calc: D => {
        const MIN_N = 10;
        const g = D.byUnit.filter(x => x.total >= MIN_N);
        if (g.length < 2) return NA;
        const max = Math.max(...g.map(x => x.doneRate));
        const min = Math.min(...g.map(x => x.doneRate));
        const excluded = D.byUnit.filter(x => x.total < MIN_N);
        return {
          v: max - min, disp: f1(max - min) + '%p',
          sub: `Unit 간 완료율 편차 (지역 코드 대체) · 표본 ${MIN_N}건 이상 ${g.length}개 조직`,
          detail: [
            ...D.byUnit.map(x => ({
              label: x.key + (x.total < MIN_N ? ' (표본부족·제외)' : ''),
              value: `${f1(x.doneRate)}% (${x.done}/${x.total})`
            })),
            ...(excluded.length ? [{ label: '※ 제외 조직', value: `${excluded.length}개 (10건 미만)` }] : [])
          ]
        };
      }
    },

    /* ═══════════ Pillar 5 — Customer Outcome & ARR ═══════════ */
    {
      id: '5.1', pillar: 5, star: true, name: 'Time to Value (TTV — 개통 소요기간)',
      def: '계약 → 개통확인서 발행까지의 평균 소요 기간. A10 빠른 가치 실현의 핵심 지표.',
      formula: 'TTV(일) = AVG(개통확인서 발행일 − 계약일)  [완료 프로젝트]\n※ 구축방식별·서버유형별 분리 산출 필수',
      source: 'NSM10/AMS: 계약일 / GCMS: 개통(완료)일',
      cycle: '월간 / 구축방식·서버유형별',
      target: 'SaaS 60일 이내, 구축형 90일 이내, FoEX단독 40일 이내', targetVal: 60, op: 'lte', unit: '일',
      asIs: 'SaaS 45일 / 구축형 75일 (EQT Median 60일)', state: 'proxy',
      note: 'NSM10 계약일·GCMS 개통확인서 발행일 미보유 → <구축접수일 ~ 완료예정일> 기준 대체 산출. Phase 1 연동 시 정합.',
      calc: D => {
        const done = D.rows.filter(p => p.status === '완료' && p.days !== null && p.days >= 0);
        if (!done.length) return NA;
        const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const v = avg(done.map(p => p.days));
        const bySrv = ['SaaS', '구축형'].map(s => ({
          label: s, value: `${f0(avg(done.filter(p => p.serverType === s).map(p => p.days)))}일`
        }));
        const byM = D.CODE.METHOD.map(m => ({
          label: m, value: `${f0(avg(done.filter(p => p.method === m).map(p => p.days)))}일`
        }));
        return { v, disp: f0(v) + '일', sub: `완료 ${done.length.toLocaleString()}건 평균 (접수→완료예정 기준)`, detail: [...bySrv, ...byM] };
      }
    },
    {
      id: '5.2', pillar: 5, name: 'CSAT (개통 후 만족도)',
      def: '프로젝트 완료(개통) 직후 고객 만족도 (5점 척도). 구축 품질과 서비스 수준의 직접 측정.',
      formula: 'CSAT = AVG(고객 응답 점수, 5점 척도)\n표준 5문항: 일정·품질·소통·역량·전반 만족도\n※ 응답률 70%+ 이상에서만 유효 집계',
      source: 'VOC: 완료 설문 (현재 수기 → 시스템화 필요)',
      cycle: '프로젝트별 (완료 후 7일 이내 수집)',
      target: '4.2/5.0 이상 (단기), 4.4/5.0 이상 (1년)', targetVal: 4.2, op: 'gte', unit: '/5.0',
      asIs: '미집계 (EQT Median 4.0)', state: 'pending',
      note: 'VOC 설문 시스템화가 선결 과제. Phase 3 로드맵 항목.',
      calc: () => NA
    },
    {
      id: '5.3', pillar: 5, name: 'ARR 갱신 준비도 (Renewal-Ready Score)',
      def: '개통 후 6개월 시점 A10 SaaS 고객의 갱신 의향 종합 점수. ARR 조기화·CSPS 전략의 선행 지표.',
      formula: 'Renewal-Ready = 0.3×Adoption + 0.3×CSAT정규화 + 0.2×무장애일수 + 0.2×VoC응답성\n※ 100점 만점. Adoption = 핵심 모듈 활성 사용자비율(라이선스 대비)',
      source: 'A10 사용로그: Adoption / VOC: CSAT·NPS / ITSM: Incident',
      cycle: '개통 후 6개월 시점 / 월간 갱신',
      target: '70점+. 위험 고객(60점 이하) 즉시 CS 개입', targetVal: 70, op: 'gte', unit: '점',
      asIs: '미집계', state: 'pending',
      note: 'A10 사용로그·VOC·ITSM 3개 원천 동시 연동 필요. Phase 3 로드맵 항목.',
      calc: () => NA
    },
    {
      id: '5.4', pillar: 5, name: 'A10 SaaS AI Attach Rate',
      def: '최근 30일 내 A10 AI 기능(자동분개·이상탐지·문서요약 등)을 1회 이상 사용한 고객 비율.',
      formula: 'AI Attach Rate(%) = 30일 내 AI 이벤트 발생 고객수 / 전체 라이브 고객수 × 100\n라이브 고객 = 개통확인서 발행 후 유지보수 계약 활성 상태',
      source: 'A10 사용로그 → GCMS 연동 (Phase 1 개발)',
      cycle: '월간 (매월 말 기준)',
      target: '1년차 30%+, 2년차 50%+', targetVal: 30, op: 'gte', unit: '%',
      asIs: '미집계', state: 'pending',
      note: '화면정의서 [구축정보] 탭 <ONE AI 도입여부>·<과금개시일(ONE AI)> 필드가 분모 원천. A10 텔레메트리 연동 필요.',
      calc: () => NA
    },

    /* ═══════════ Pillar 6 — Quality & Risk ═══════════ */
    {
      id: '6.1', pillar: 6, name: '전년 이월 부담률',
      def: '연초 접수 잔여건 중 전년도에서 넘어온 이월 비중. 연간 처리 과부하 구조의 선행 지표.',
      formula: '이월 부담률(%) = 전년 이월건 / 연초 전체 잔여건 × 100\n연초 전체 잔여건 = 전년이월 + 당해연도 1월 신규접수',
      source: 'GCMS: 이월 분류 코드',
      cycle: '연 1회 (1월 첫째 주)',
      target: '이월 부담률 60% 이하', targetVal: 60, op: 'lte', unit: '%',
      asIs: '81.3% (2026년 1월 — 과부하)', state: 'auto',
      note: '연말 잔여건 사전 협의·완료 강화로 구조 개선 필요. 연말 이월 50건 이하 목표.',
      calc: D => {
        const years = [...new Set(D.rows.map(p => p.receiptYear).filter(Boolean))].sort();
        const last = years[years.length - 1];
        if (!last) return NA;
        // 전년 이월 = 전년도 이전 접수 중 당해 1월 시점 미완결
        const carry = D.rows.filter(p => p.receiptYear < last && p.isActive).length;
        const janNew = D.rows.filter(p => p.receiptYM === `${last}-01`).length;
        const v = pct(carry, carry + janNew);
        return {
          v, disp: f1(v) + '%',
          sub: `${last}년 기준 · 이월 ${carry.toLocaleString()}건 / 1월 신규 ${janNew.toLocaleString()}건`
        };
      }
    },
    {
      id: '6.2', pillar: 6, name: 'Go-live 후 30일 안정성',
      def: '개통 후 첫 30일 내 Critical 장애(Sev1) 발생 건수. 구축 품질의 최종 검증 지표.',
      formula: 'Stability = COUNT(Sev1 incident, 개통일 ~ 개통일+30일)\nSev1 = 업무 중단·데이터 손실·결산 불가 등 Critical 장애',
      source: 'ITSM: Incident 로그 (현재 수기 접수 → 시스템화 필요)',
      cycle: '프로젝트별',
      target: 'Sev1 0건, Sev2 3건 이내', targetVal: 0, op: 'lte', unit: '건',
      asIs: '미집계', state: 'pending',
      note: 'ITSM Incident 로그 시스템화가 선결 과제. Phase 3 로드맵 항목.',
      calc: () => NA
    },
    {
      id: '6.3', pillar: 6, star: true, name: '지연 프로젝트 비율 (RAG Red%)',
      def: '구축 기간 내 정상 처리가 어렵거나 60일 이상 미완료로 경고 상태인 프로젝트 비율.',
      formula: 'Red% = 지연(Red) 프로젝트 수 / 전체 진행 프로젝트 수 × 100\nRed 기준: 약정 완료일 초과 또는 60일 이상 진행 중인 건\nAmber 기준: 약정 완료일 D-14일 이내 / 중간 게이트 지연',
      source: 'GCMS: RAG 상태코드 / 완료 약정일 대비 현재일 비교',
      cycle: '주간 스냅샷',
      target: 'Red% 8% 이하 (단기), 5% 이하 (연말)', targetVal: 8, op: 'lte', unit: '%',
      asIs: '11.2% (EQT Median 5%)', state: 'auto',
      note: '지연 구축진행 현황 80건 → 40건 축소 목표.',
      calc: D => {
        const act = activeOf(D);
        const red = act.filter(p => p.status === '지연').length;
        const amber = act.filter(p => p.status === '보류').length;
        const v = pct(red, act.length);
        return {
          v, disp: f1(v) + '%',
          sub: `Red ${red}건 / 진행 ${act.length.toLocaleString()}건`,
          detail: [
            { label: 'Red (지연)', value: `${red}건 · ${f1(v)}%` },
            { label: 'Amber (보류)', value: `${amber}건 · ${f1(pct(amber, act.length))}%` },
            { label: 'Green (정상 진행)', value: `${act.length - red - amber}건` }
          ]
        };
      }
    },
    {
      id: '6.4', pillar: 6, name: 'H/W 조달 대기 리스크 지수',
      def: 'On-prem 구축형 프로젝트에서 H/W 납품 대기로 착수 지연된 건수. 구축형 완료율 저하의 핵심 원인.',
      formula: 'H/W 대기율(%) = H/W 대기 건 / 전체 구축형 진행 건 × 100\n평균 대기일 = AVG(H/W 납품일 − 착수 예정일)',
      source: 'GCMS: 서버유형코드(구축형) + 착수 지연사유 코드',
      cycle: '주간',
      target: 'H/W 대기율 10% 이하, 평균 대기일 14일 이하', targetVal: 10, op: 'lte', unit: '%',
      asIs: '추정 20%+ (평균 대기 18일)', state: 'proxy',
      note: '착수 지연사유 코드 미보유 → 분모(구축형 진행건)만 산출. 화면정의서 [구축정보] 탭 <지연사유> 코드 신설 필요.',
      calc: D => {
        const onp = activeOf(D).filter(p => p.serverType === '구축형');
        const zero = onp.filter(p => p.mdInPaid === 0).length;   // 미착수(투입 0) = H/W 대기 추정
        const v = pct(zero, onp.length);
        return {
          v, disp: f1(v) + '%',
          sub: `구축형 진행 ${onp.length}건 중 미착수(투입 0MD) ${zero}건`,
          detail: [{ label: '※ 추정 기준', value: '투입공수 0MD = 착수 대기 간주' }]
        };
      }
    },

    /* ═══════════ Pillar 7 — AI Transformation ═══════════ */
    {
      id: '7.1', pillar: 7, name: 'PM·컨설턴트 AI 도구 활용률 (DAU%)',
      def: 'Claude/Copilot 등 AI 도구를 일일 활성 사용하는 PM·컨설턴트 비율. 내부 AI 역량의 핵심 지표.',
      formula: 'AI DAU% = AI 도구 일일 활성 인원 / 전체 구축 인력 × 100\n주간 활성(WAU)으로 대체 측정 가능',
      source: 'HR: AI 도구 사용현황 로그 (IT인프라 협력)',
      cycle: '주간',
      target: 'DAU/WAU 70%+ (Green) / 40~70% (Amber) / 40% 미만 (Red)', targetVal: 70, op: 'gte', unit: '%',
      asIs: '미집계', state: 'pending',
      note: '분모(전체 구축 인력)는 GCMS 배정정보로 산출 가능. AI 도구 사용 로그는 IT인프라 협력 필요.',
      calc: D => ({ v: null, disp: '연동 필요', sub: `분모 산출 가능: 구축 인력 ${D.assignees.length}명`, detail: [] })
    },
    {
      id: '7.2', pillar: 7, star: true, name: 'AI 기인 공수 절감률',
      def: '표준 공수 대비 AI 도구 활용 시 실제 투입 공수 감소율. AI 생산성 향상의 정량 증명.',
      formula: 'AI 공수 절감률(%) = (표준공수 − 실투입공수) / 표준공수 × 100\n표준공수 = 공수표준표 기준 (기능·규모별 표준 MD)',
      source: 'GCMS: 투입 MD / 공수표준표: 표준 MD 기준',
      cycle: '프로젝트별 → 분기 평균',
      target: '15%+ (1년차), 20%+ (2년차)', targetVal: 15, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'auto',
      note: 'AI 활용 프로젝트 플래그 미보유 → 전체 완료 프로젝트 기준 산출. AI 활용 여부 코드 추가 시 정밀 산출 가능.',
      calc: D => {
        const done = D.rows.filter(p => p.status === '완료' && p.mdContract > 0 && p.mdInPaid > 0);
        if (!done.length) return NA;
        const std = done.reduce((a, p) => a + p.mdContract, 0);
        const inp = done.reduce((a, p) => a + p.mdInPaid, 0);
        const v = (std - inp) / std * 100;
        return {
          v, disp: f1(v) + '%',
          sub: `표준 ${f0(std)}MD → 투입 ${f0(inp)}MD (완료 ${done.length.toLocaleString()}건)`,
          detail: [{ label: '절감 공수', value: `${f0(std - inp)} MD` }]
        };
      }
    },
    {
      id: '7.3', pillar: 7, name: 'Embedded AI ARR 비중',
      def: 'iCUBE→A10 전환 업세일 시 AI 기능 포함 요금 차이(업세일 ARR) 비중. AI 가치의 재무적 가시화.',
      formula: 'Embedded AI ARR = Σ(A10 월요금 − iCUBE 환산 월요금) × 12  [EMB_AI 코드 건]\nEmbedded AI ARR% = Embedded AI ARR / 전체 A10 ARR × 100',
      source: 'NSM10/AMS: 계약유형 코드(EMB_AI), 마이그레이션 계약 전후 요금',
      cycle: '분기',
      target: '전체 ARR 대비 10%+', targetVal: 10, op: 'gte', unit: '%',
      asIs: '미집계', state: 'pending',
      note: 'NSM10 EMB_AI 계약유형 코드 신설 + 전환 전후 요금 이력 관리 필요.',
      calc: () => NA
    },
  ];

  /* ── Executive Dashboard 6대 KPI (가이드라인 §2) ─────────────── */
  const EXEC = ['1.1', '2.1', '1.3', '1.4', '1.5', '1.6'];

  /* ── 목표 대비 판정 ──────────────────────────────────────────── */
  function judge(k, v) {
    if (v === null || v === undefined || !isFinite(v) || k.targetVal === undefined)
      return { cls: 'idle', txt: '측정 대기' };
    const t = k.targetVal;
    const ok = k.op === 'lte' ? v <= t : v >= t;
    if (ok) return { cls: 'ok', txt: '달성' };
    // 목표의 80% 이상 근접 시 주의
    const ratio = k.op === 'lte' ? t / v : v / t;
    return ratio >= 0.8 ? { cls: 'warn', txt: '주의' } : { cls: 'risk', txt: '미달' };
  }

  /* ── 전체 산출 실행 ──────────────────────────────────────────── */
  function computeAll(D) {
    const out = new Map();
    LIST.forEach(k => {
      let r;
      try { r = k.calc(D) || NA; }
      catch (e) { r = { v: null, disp: '산출 오류', sub: String(e.message || e), detail: [] }; }
      out.set(k.id, { ...k, result: r, judge: judge(k, r.v) });
    });
    return out;
  }

  const summary = computed => {
    const all = [...computed.values()];
    return {
      total: all.length,
      auto: all.filter(k => k.state === 'auto').length,
      proxy: all.filter(k => k.state === 'proxy').length,
      pending: all.filter(k => k.state === 'pending').length,
      ok: all.filter(k => k.judge.cls === 'ok').length,
      risk: all.filter(k => k.judge.cls === 'risk').length,
    };
  };

  return { PILLARS, LIST, EXEC, computeAll, judge, summary };
})();
