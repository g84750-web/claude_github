/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — KPI 산출 엔진
   기준 : PKG사업본부 A10 구축업무 ERP 관리지표 가이드라인 v1.0 (7 Pillar)
        + PKG 주간보고 One-Page 작업지침 v2 (계약공수 기준 산식 확정)
   원천 : GCMS A10(통합)구축진행현황 260724

   산출상태(state)
     auto    — GCMS 현행 데이터로 공식 그대로 자동 산출
     proxy   — 원천 필드 일부 부재. 지침 명시 대체값으로 근사 산출
     pending — 원천 시스템(ERP·VOC·ITSM·HR·A10로그) 미연동
   ══════════════════════════════════════════════════════════════════ */
const KPI = (() => {

  const PILLARS = [
    { no: 1, name: 'Project Delivery & Progress', ko: '구축 진척 · 납기 · 완료율',
      desc: 'PKG사업본부의 가장 근본적인 생산성 지표. 구축 접수 대비 완료 처리 능력과 납기 준수 수준을 측정한다.' },
    { no: 2, name: 'Margin Quality & Revenue Mix', ko: '수익성 · 마진 품질',
      desc: '구축방식·모듈별 GM% 및 비용 효율. 금액 지표는 GCMS 수주액으로 산출, 원가는 ERP 연동이 선결 과제.' },
    { no: 3, name: 'Standardization & Scalability ★', ko: '표준화 · 확장성',
      desc: 'FoEX 방식 전환율이 PKG사업본부의 핵심 가치 동인. 1:N 집체방식만 부하를 절감한다.' },
    { no: 4, name: 'Resource Productivity & Utilization', ko: '인력 가동률 · 생산성',
      desc: 'PM당 관리 건수, 월가용 CAPA, 지역·센터별 효율 최적화.' },
    { no: 5, name: 'Customer Outcome & ARR Renewal', ko: '고객 성과 · ARR 갱신',
      desc: 'TTV, CSAT, Renewal-Ready, AI Attach Rate. VOC·A10 사용로그 연동 필요.' },
    { no: 6, name: 'Quality & Risk Management', ko: '품질 · 리스크',
      desc: '이월 부담, 지연 프로젝트, 구축지연(M), H/W 조달 리스크, 개통 안정성.' },
    { no: 7, name: 'AI Transformation KPIs', ko: 'AI 전환 지표',
      desc: 'PM AI DAU%, 공수 절감률, Embedded AI ARR. EQT iLevel 연계 지표.' },
  ];

  const pct = (n, d) => (d > 0 ? n / d * 100 : null);
  const f1 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(1);
  const f2 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(2);
  const f0 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : Math.round(v).toLocaleString();
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const NA = { v: null, disp: '연동 필요', sub: '', detail: [] };
  const KEEP = ['조기', '정시', '30일내'];

  const LIST = [

    /* ═══════════ Pillar 1 ═══════════ */
    {
      id: '1.1', pillar: 1, star: true, name: '구축 완료율 (건수 기준)',
      def: 'PKG사업본부 A10 구축 사업의 누적 완료 건수 비율. 분기·연간 구축 처리 능력의 핵심 지표.',
      formula: '완료율(%) = 구축완료(B) / 구축접수(A) × 100\n구축접수(A) = 전년이월 + 당해연도 신규접수\n구축완료(B) = 개통확인서 발행 완료 건 (누적)',
      source: 'GCMS: 진행상태(M열), 구축접수일(Z열)',
      cycle: '월간 누적 / 전체·구축방식별·센터별·서버유형별',
      target: '월간 누적 70%+, 연말 90%+', targetVal: 70, op: 'gte', unit: '%',
      asIs: '68.05% (260724 확정)', state: 'auto',
      note: '검증: 상태별 5구분 합 = 총접수 / 이월 + 신규 = 총접수 (작업지침 §3-3 [G1])',
      calc: D => {
        const done = D.stat.done, total = D.stat.total;
        const v = pct(done, total);
        const carry = D.meta.carry, nw = D.meta.new;
        return {
          v, disp: f2(v) + '%',
          sub: `완료 ${done.toLocaleString()}건 / 접수 ${total.toLocaleString()}건`,
          detail: [
            { label: '이월 + 신규', value: `${carry?.toLocaleString()} + ${nw?.toLocaleString()} = ${total.toLocaleString()}` },
            ...D.CODE.STATUS.map(s => ({ label: s, value: `${(D.meta.status?.[s] || 0).toLocaleString()}건` })),
          ]
        };
      }
    },
    {
      id: '1.2', pillar: 1, name: '완료율 (금액 기준)',
      def: '총접수금액 대비 완료금액 비율. 건수 완료율과의 Gap은 고단가 구축형 완료 지연 신호.',
      formula: '금액 완료율(%) = 누적완료금액 / 누적접수금액 × 100\nGap = 건수 완료율 − 금액 완료율  (Gap > 0: 고단가 지연)',
      source: 'GCMS: 총수주액(O열) — ※ 라이선스(P열) 아님',
      cycle: '월간 누적',
      target: '금액 완료율 50%+ (상반기), 70%+ (연간). 건수 Gap ±3%p 이내', targetVal: 50, op: 'gte', unit: '%',
      asIs: '52.4% (가이드라인 v1.0)', state: 'auto',
      note: '⚠ 수주금액은 반드시 O열(총수주액) 사용. P열(라이선스)과 혼동 금지 (검증체크리스트 ①).',
      calc: D => {
        const tot = D.rows.reduce((a, p) => a + (p.orderAmt || 0), 0);
        const done = D.rows.filter(p => p.status === '완료').reduce((a, p) => a + (p.orderAmt || 0), 0);
        const v = pct(done, tot);
        const cntRate = pct(D.stat.done, D.stat.total);
        return {
          v, disp: f1(v) + '%',
          sub: `완료 ${f0(done / 1e6)}백만 / 접수 ${f0(tot / 1e6)}백만`,
          detail: [
            { label: '건수 완료율', value: `${f2(cntRate)}%` },
            { label: 'Gap (건수 − 금액)', value: `${f1(cntRate - v)}%p` },
          ]
        };
      }
    },
    {
      id: '1.3', pillar: 1, name: '재공 처리 속도',
      def: '전월 잔여건 대비 당월 완료 처리 비율. 재공(WIP) 소화 속도의 효율 지표.',
      formula: '처리 속도(%) = 당월 완료건수(B) / 전월 말 재공 잔여건수 × 100\n재공 잔여 = 전월 잔여 − 당월 완료 − 당월 반품 + 당월 신규접수',
      source: 'GCMS: 월별 완료건 집계, 잔여건 집계',
      cycle: '월간 스냅샷',
      target: '월간 30%+ (최저), 35%+ (목표)', targetVal: 35, op: 'gte', unit: '%',
      asIs: '31.2% (4개월 평균)', state: 'auto',
      note: 'FoEX 확대가 핵심 레버. 완료 시점은 구축완료일(AF열) 기준.',
      calc: D => {
        const ms = D.monthly;
        const rates = [];
        for (let i = 1; i < ms.length; i++)
          if (ms[i - 1].wip > 0) rates.push({ ym: ms[i].ym, r: pct(ms[i].completed, ms[i - 1].wip), c: ms[i].completed, w: ms[i - 1].wip });
        if (!rates.length) return NA;
        const last4 = rates.slice(-4);
        const v = avg(last4.map(x => x.r));
        return {
          v, disp: f1(v) + '%', sub: `최근 ${last4.length}개월 평균`,
          detail: last4.map(x => ({ label: x.ym, value: `${f1(x.r)}% (완료 ${x.c} / 재공 ${f0(x.w)})` }))
        };
      }
    },
    {
      id: '1.4', pillar: 1, name: '구축방식별 완료율',
      def: '방문구축·FoEX교육(1:N)·FoEX단독·FoEX+방문 복합 유형별 완료율. 방식별 효율 비교.',
      formula: '구축방식별 완료율(%) = 해당 방식 완료건 / 해당 방식 접수건 × 100',
      source: 'GCMS: 구축구분(Y열)',
      cycle: '월간 / 유형별',
      target: 'FoEX단독 70%+, 방문구축 58%+, 복합 58%+, FoEX(1:N) 58%+', targetVal: 58, op: 'gte', unit: '%',
      asIs: 'FoEX단독 68.5%(최고) / 복합 54.7%(최저)', state: 'auto',
      calc: D => {
        const g = D.byMethod;
        const worst = [...g].sort((a, b) => a.doneRate - b.doneRate)[0];
        return {
          v: worst ? worst.doneRate : null,
          disp: worst ? f1(worst.doneRate) + '%' : '—',
          sub: worst ? `최저: ${worst.key}` : '',
          detail: g.map(x => ({ label: x.key, value: `${f1(x.doneRate)}% (${x.done}/${x.total})` }))
        };
      }
    },
    {
      id: '1.5', pillar: 1, name: 'SaaS vs 구축형 완료율 Gap',
      def: 'SaaS(클라우드)와 구축형(On-premise) 간 완료율 차이. H/W 조달 지연 등 구조적 문제 측정.',
      formula: 'Gap(%p) = SaaS 완료율 − 구축형 완료율',
      source: 'GCMS: 제품구분(G열) → 서버유형 파생',
      cycle: '월간',
      target: 'Gap 5%p 이내로 축소. 구축형 완료율 55%+', targetVal: 5, op: 'lte', unit: '%p',
      asIs: '7.5%p', state: 'auto',
      note: '구축형 지연 주요 원인: 더존구매팀↔DELL↔고은정보통신 H/W 납품 대기. 조달 SLA 설정 필요.',
      calc: D => {
        const s = D.byServer.find(x => x.key === 'SaaS'), o = D.byServer.find(x => x.key === '구축형');
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
      source: 'GCMS: 진행상태(M열) = 반품',
      cycle: '월간 누적',
      target: '0.5% 이내 유지', targetVal: 0.5, op: 'lte', unit: '%',
      asIs: '0.44% (양호)', state: 'auto',
      calc: D => {
        const c = D.rows.filter(p => p.status === '반품').length;
        const v = pct(c, D.stat.total);
        return { v, disp: f2(v) + '%', sub: `반품 ${c}건 / 접수 ${D.stat.total.toLocaleString()}건` };
      }
    },
    {
      id: '1.7', pillar: 1, star: true, name: '납기준수율 (완료건 기준)',
      def: '완료 프로젝트 중 약정 완료예정일 대비 30일 이내 완료한 비율. 주간보고 4대 KPI.',
      formula: '납기준수율(%) = 납기준수건 / 판정모수(완료건) × 100\n납기준수건 = 조기 + 정시 + 30일이내\nBP(약정일) = 변경완료예정일(AE) 1순위 → 구축완료예정일(AD) 2순위\ndelta = 구축완료일(AF) − BP',
      source: 'GCMS: AE→AD, AF열',
      cycle: '주간 / 월간',
      target: '94.8% 유지 (가중 99.7%)', targetVal: 94, op: 'gte', unit: '%',
      asIs: '94.8% = 1,522/1,606', state: 'auto',
      note: '🔴 AF≤BP 이진판정(70.0%/71.5%)은 구버전 — 인용 금지. ⚠ 94.8%는 라이선스 발행율과 값이 우연히 동일하므로 라벨 구분 필수.',
      calc: D => {
        const j = D.rows.filter(p => p.dlvBucket);
        const keep = j.filter(p => KEEP.includes(p.dlvBucket)).length;
        const v = pct(keep, j.length);
        const c = {};
        D.CODE.DLV.forEach(b => c[b] = j.filter(p => p.dlvBucket === b).length);
        return {
          v, disp: f1(v) + '%',
          sub: `준수 ${keep.toLocaleString()} / 모수 ${j.length.toLocaleString()}건`,
          detail: [
            { label: '조기 · 정시 · 30일내', value: `${c['조기']} · ${c['정시']} · ${c['30일내']} = ${keep}` },
            { label: '1M · 2M · 3M 초과', value: `${c['1M초과']} · ${c['2M초과']} · ${c['3M초과']} = ${j.length - keep}` },
          ]
        };
      }
    },
    {
      id: '1.8', pillar: 1, name: '계약기간준수율 (설치형 · 참고지표)',
      def: '설치형(Amaranth10) 신규 계약 중 계약종료일 이내 구축완료한 비율. ' +
           '설치형은 계약기간을 적용받을 수 있어 확인하는 보조 지표이며, 대표 납기 지표는 1.9 구축기간 준수율이다.',
      formula: '계약기간준수율(%) = 준수건 / 완료건 × 100\n모집단: 프로젝트구분=신규 & 제품구분=Amaranth10 & 계약시작일·종료일 존재\n※ PAC240528003(신영) 제외',
      source: 'GCMS: H·G·AY·AZ·AF열',
      cycle: '월간',
      target: '참고 수준 (대표 지표는 1.9)', unit: '%',
      asIs: '80.8% = 143/177 (지침)', state: 'proxy',
      note: '⚠ 데이터 품질 한계 — 계약시작일·종료일은 구축자가 NSM·계약서를 기반으로 GCMS에 등록하며, ' +
            '영업에서 진행하는 계약정보 변경이력이 실시간 공유되지 않아 일부 프로젝트에서 오입력이 발생할 수 있다. ' +
            '따라서 본 지표는 참고용이며 지침 확정값과의 소수 건 차이는 추적하지 않는다. ' +
            '납기 변경 발생 건은 1.9 구축기간 준수율로 판정한다. 🔴 95.3%(SaaS 포함) 인용 금지.',
      calc: D => {
        const ct = D.meta.contractTerm || {};
        const v = ct.rate;
        return {
          v, disp: f1(v) + '%',
          sub: `준수 ${ct.ok} / 완료 ${ct.fin}건 (모집단 ${ct.pop} → ${ct.popEx})`,
          detail: [
            { label: '모집단', value: `${ct.pop} → 신영 제외 ${ct.popEx} → 완료 ${ct.fin}` },
            { label: '계약종료일(AZ) 기준 준수', value: `${ct.ok} / ${ct.fin} = ${f1(ct.rate)}%` },
            { label: '예외 (납기 변경 발생 건)', value: `${ct.exception}건 → KPI 1.9로 판정` },
            { label: '구축기간(AD) 기준 동일 모집단', value: `${ct.baseKeep} / ${ct.fin} = ${f1(ct.baseRate)}%` },
            { label: '※ 계약일자 정합성', value: '영업 계약변경 이력 미연동 — 오입력 가능' },
          ]
        };
      }
    },
    {
      id: '1.9', pillar: 1, star: true, name: '구축기간 준수율 ★핵심',
      def: '최초 구축완료예정일(기본 구축기간) 기준 납기 준수율. 납기 변경(연장)을 반영하지 않으므로 ' +
           '실제 구축 일정 이행력을 가장 직접적으로 나타내는 대표 지표이며, 계약기간준수율(1.8)의 예외 건도 본 지표로 판정한다.',
      formula: '기본 구축기간 준수율(%) = 준수건 / 완료건 × 100\n판정 기준일 = 구축완료예정일(AD) 단독  ※ 변경완료예정일(AE) 미적용\n준수 = 조기 + 정시 + 30일이내\n연장 효과(%p) = KPI 1.7 − KPI 1.9',
      source: 'GCMS: 구축완료예정일(AD), 구축완료일(AF)',
      cycle: '주간 / 월간',
      target: '90%+ 유지', targetVal: 90, op: 'gte', unit: '%',
      asIs: '90.4% = 1,452/1,606', state: 'auto',
      note: 'KPI 1.7(94.8%)은 변경완료예정일을 반영한 값이므로 두 지표의 차이가 곧 납기 연장 효과다. ' +
            '계약일자와 달리 구축완료예정일은 구축자가 직접 관리하는 필드라 데이터 신뢰도가 높다.',
      calc: D => {
        const keep = D.meta.deliveryBaseKeep, mo = D.meta.deliveryBaseJudged;
        const v = pct(keep, mo);
        const b = D.meta.deliveryBase || {};
        const bp = D.meta.deliveryRate;
        return {
          v, disp: f1(v) + '%',
          sub: `준수 ${keep.toLocaleString()} / 모수 ${mo.toLocaleString()}건`,
          detail: [
            { label: '조기 · 정시 · 30일내', value: `${b['조기']} · ${b['정시']} · ${b['30일내']} = ${keep.toLocaleString()}` },
            { label: '1M · 2M · 3M 초과', value: `${b['1M초과']} · ${b['2M초과']} · ${b['3M초과']} = ${(mo - keep).toLocaleString()}` },
            { label: 'KPI 1.7 (변경 반영)', value: `${f1(bp)}%` },
            { label: '납기 연장 효과', value: `${f1(bp - v)}%p · 준수 전환 ${D.meta.deliveryExtended}건` },
          ]
        };
      }
    },

    /* ═══════════ Pillar 2 ═══════════ */
    {
      id: '2.1', pillar: 2, name: '건당 평균 완료금액',
      def: '완료 처리된 프로젝트 1건당 평균 매출 금액. 고단가 프로젝트 완료 집중 여부를 측정.',
      formula: '건당 완료금액(백만원) = 누적완료금액 / 누적완료건수\nGap = 건당 수주금액 − 건당 완료금액  (Gap > 0: 고단가 지연)',
      source: 'GCMS: 총수주액(O열), 진행상태(M열)',
      cycle: '월간',
      target: '건당 완료금액 ≥ 건당 수주금액 × 0.95', targetVal: 27.2, op: 'gte', unit: '백만원',
      asIs: '25.3백만 (수주 28.6M 대비)', state: 'auto',
      note: '고단가인 구축형·전모듈 프로젝트 완료 지연이 Gap 원인. 집중 PM 배정 필요.',
      calc: D => {
        const fin = D.rows.filter(p => p.status === '완료');
        const doneAmt = fin.reduce((a, p) => a + (p.orderAmt || 0), 0) / 1e6;
        const totAmt = D.rows.reduce((a, p) => a + (p.orderAmt || 0), 0) / 1e6;
        const v = fin.length ? doneAmt / fin.length : null;
        const per = totAmt / D.stat.total;
        return {
          v, disp: f1(v) + '백만',
          sub: `완료금액 ${f0(doneAmt)}백만 ÷ ${fin.length.toLocaleString()}건`,
          detail: [
            { label: '건당 수주금액', value: `${f1(per)}백만` },
            { label: 'Gap', value: `${f1(per - v)}백만 (${f1((per - v) / per * 100)}%)` },
          ]
        };
      }
    },
    {
      id: '2.2', pillar: 2, star: true, name: '구축 Gross Margin (GM%)',
      def: '구축 사업 매출총이익률. EQT BMS 핵심 수익성 지표.',
      formula: 'GM% = (구축매출 − 직접원가) / 구축매출 × 100\n직접원가 = 인건비(투입MD × 원가율) + 외주비 + 자재비 + 직접출장비',
      source: 'ERP(옴니이솔): 매출·직접원가 / HR: 직급별 원가율 / GCMS: 투입MD',
      cycle: '월간 / 프로젝트·구축방식별',
      target: '25%+ (전체), FoEX단독 30%+', targetVal: 25, op: 'gte', unit: '%',
      asIs: '측정 필요 (EQT Median 23%)', state: 'pending',
      note: '매출(GCMS 수주액)·투입MD는 보유. 직급별 원가율(HR) 연동 시 즉시 자동 산출 가능.',
      calc: D => ({
        v: null, disp: '연동 필요',
        sub: `분자 일부 산출 가능: 완료매출 ${f0(D.rows.filter(p => p.status === '완료').reduce((a, p) => a + p.orderAmt, 0) / 1e6)}백만`,
        detail: [{ label: '미연동 항목', value: 'HR 직급별 원가율 · ERP 외주/자재/출장비' }]
      })
    },
    {
      id: '2.3', pillar: 2, name: '비용 대비 처리 효율 (CTD)',
      def: '완료 프로젝트 1건당 평균 직접원가. 표준화·FoEX 확대 효과를 비용 측면에서 측정.',
      formula: 'CTD = 분기 누적 직접원가 / 분기 완료 건수',
      source: 'ERP: 직접원가 / GCMS: 완료건 마스터',
      cycle: '분기 / 구축방식·서버유형별',
      target: 'YoY −5% 이상. FoEX단독 CTD가 방문구축 대비 25% 이하', unit: '원/건',
      asIs: '측정 필요', state: 'pending',
      note: '분모(구축방식별 완료건수)는 산출 완료. ERP 직접원가 연동이 선결 과제.',
      calc: D => ({
        v: null, disp: '연동 필요', sub: '분모 산출 가능',
        detail: D.byMethod.map(x => ({ label: x.key, value: `완료 ${x.done}건` }))
      })
    },
    {
      id: '2.4', pillar: 2, name: '매출 실현율 (Realization Rate)',
      def: '투입된 유상 공수(MD) 중 실제 청구된 비율. 무상 추가 작업으로 인한 수익 누수 측정.',
      formula: 'RR% = 청구가능 인일수(Billed MD) / 투입 유상 인일수(Billable MD) × 100',
      source: 'ERP: 청구서 / GCMS: 투입공수(AJ열)',
      cycle: '월간 / 프로젝트별',
      target: '90%+', targetVal: 90, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'pending',
      note: '분모(투입 유상 MD)는 보유. ERP 청구서 연동 필요. 화면정의서 [투입정보] <공수구분>·<선발행여부> 필드 확립 선결.',
      calc: D => ({
        v: null, disp: '연동 필요',
        sub: `분모 산출 가능: 현진행 투입 ${f0(D.meta.md?.used)} MD`, detail: []
      })
    },
    {
      id: '2.5', pillar: 2, name: '모듈 구성별 수익 Mix',
      def: '관리모듈·전모듈·전방모듈·UC모듈 등 모듈 구성별 매출 비중과 GM%.',
      formula: '모듈 Mix(%) = 해당 모듈 구성 완료금액 / 전체 완료금액 × 100',
      source: 'GCMS: 모듈구분(J열), 총수주액(O열)',
      cycle: '분기',
      target: '관리모듈 단독 비중 65% 이하, 전모듈 비중 25%+', unit: '%',
      asIs: '전모듈 19.9% 비중', state: 'auto',
      note: 'GM%는 ERP 원가 연동 후 산출 가능. 현재는 매출 Mix만 산출.',
      calc: D => {
        const g = D.byModule.filter(x => x.total >= 5);
        const tot = g.reduce((a, x) => a + x.amount, 0);
        const full = g.find(x => x.key === '전모듈');
        return {
          v: full ? pct(full.amount, tot) : null,
          disp: full ? f1(pct(full.amount, tot)) + '%' : '—',
          sub: `전모듈 매출 비중 (모듈 ${g.length}종)`,
          detail: g.slice(0, 8).map(x => ({
            label: x.key, value: `${f1(pct(x.amount, tot))}% · ${x.total}건 · 건당 ${f1(x.amount / x.total / 1e6)}백만`
          }))
        };
      }
    },

    /* ═══════════ Pillar 3 ═══════════ */
    {
      id: '3.1', pillar: 3, star: true, name: 'FoEX 방식 전환율 (FAR)',
      def: 'EQT SPAR의 PKG 버전. 방문구축 대비 FoEX 방식 적용 비율. 표준화·확장성의 핵심 가치 동인.',
      formula: 'FAR(%) = FoEX 방식 접수건 / 전체 접수건 × 100\nFoEX 방식 = FoEX(단독) + FoEX(1:N) + FoEX(1:N)+방문',
      source: 'GCMS: 구축구분(Y열)',
      cycle: '월간 / 신규접수·처리별',
      target: '전체 FAR 50%+. FoEX단독 비중 20%+', targetVal: 50, op: 'gte', unit: '%',
      asIs: '41.4% (EQT Median 60%)', state: 'auto',
      note: '★ FoEX 1:N만 부하 절감(미투입률 16.3% = 방문구축의 1/4.3). FoEX(단독)은 67.1%로 방문구축과 사실상 동일 — 26.01 지원중단의 정량 근거.',
      calc: D => {
        const foex = D.rows.filter(p => p.isFoEX).length;
        const pure = D.rows.filter(p => p.isPureFoEX).length;
        const v = pct(foex, D.stat.total);
        return {
          v, disp: f1(v) + '%',
          sub: `FoEX ${foex.toLocaleString()}건 / 전체 ${D.stat.total.toLocaleString()}건`,
          detail: [
            { label: '순수 FoEX (방문 없음)', value: `${f1(pct(pure, D.stat.total))}% (${pure.toLocaleString()}건)` },
            ...D.byMethod.map(x => ({ label: x.key, value: `${f1(pct(x.total, D.stat.total))}% (${x.total.toLocaleString()}건)` })),
          ]
        };
      }
    },
    {
      id: '3.2', pillar: 3, name: '업세일(Upsell) 전환율',
      def: 'BizboxA/iCUBE → Amaranth10 전환(업세일) 비중. PKG사업본부 성장의 주요 엔진.',
      formula: '업세일 전환율(%) = 업세일 접수건 / 전체 접수건 × 100',
      source: 'GCMS: 업셀구분(AP열)',
      cycle: '월간 / 누적 분기',
      target: '업세일 비중 80%+ 유지. 신규 15~20% 전략 확보', targetVal: 80, op: 'gte', unit: '%',
      asIs: '85.5%', state: 'auto',
      calc: D => {
        const g = D.byUpsell;
        const up = g.find(x => x.key === '업세일');
        const v = up ? pct(up.total, D.stat.total) : null;
        return {
          v, disp: f1(v) + '%',
          sub: up ? `업세일 ${up.total.toLocaleString()}건 / 전체 ${D.stat.total.toLocaleString()}건` : '',
          detail: g.map(x => ({
            label: x.key, value: `${f1(pct(x.total, D.stat.total))}% (${x.total.toLocaleString()}건) · 건당 ${f1(x.amount / x.total / 1e6)}백만`
          }))
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
      note: '화면정의서 [투입정보] 탭 <회의록>·<교육확인서> 증적 필드가 게이트 산출물 원천. 체크리스트 메뉴 신설 필요.',
      calc: () => NA
    },
    {
      id: '3.4', pillar: 3, name: '산업팩 / Quick-Start 채택률',
      def: '사전 구성된 A10 산업군별 구축 가이드(Quick-Start 패키지)로 시작한 프로젝트 비율.',
      formula: 'QS% = Quick-Start 패키지 시작 프로젝트 수 / 신규 시작 프로젝트 수 × 100',
      source: 'NSM10: 패키지 코드 / GCMS: 구축 착수 템플릿',
      cycle: '월간',
      target: '신규 프로젝트 50%+', targetVal: 50, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'pending',
      note: 'ERPBG_SCM구축본부 OmniEsol 구축가이드 산업군별 팩 카탈로그 코드 신설 필요.',
      calc: () => NA
    },

    /* ═══════════ Pillar 4 ═══════════ */
    {
      id: '4.1', pillar: 4, star: true, name: '컨설턴트 Billable Utilization (BU%)',
      def: '유상 청구 가능한 시간(MD)의 비중. PKG 구축 인력의 핵심 가동성과 지표.',
      formula: 'BU% = 유상투입 MD / (총가동 MD − 휴가 − 법정휴일 − 표준교육) × 100',
      source: 'GCMS(HR): MD실적등록 (Billable 플래그 구분 입력 필요)',
      cycle: '월간 / 본부·팀·개인 단위',
      target: '개인 70%+, 팀 평균 75%+. 상한 85%', targetVal: 75, op: 'gte', unit: '%',
      asIs: '측정 필요 (EQT Median 75%)', state: 'pending',
      note: '즉시 실행 3순위 과제 — GCMS MD실적등록 Billable 구분 필드 추가. 분자는 담당자별 원본으로 산출 가능.',
      calc: D => {
        if (!D.assignees.length) return NA;
        const used = D.assignees.reduce((a, x) => a + x.mdUsed, 0);
        return {
          v: null, disp: '연동 필요',
          sub: `분자 산출 가능: 투입 ${f0(used)} MD / 담당자 ${D.assignees.length}명`,
          detail: [
            { label: '1인 평균 투입', value: `${f1(used / D.assignees.length)} MD` },
            { label: '미연동 항목', value: 'HR 가동MD·휴가·법정휴일·표준교육' },
          ]
        };
      }
    },
    {
      id: '4.2', pillar: 4, name: 'PM당 동시 관리 프로젝트 수',
      def: 'PM 1인이 동시에 책임지는 활성 프로젝트 수. 과부하 모니터링 및 인력 배분 효율 지표.',
      formula: '동시 관리수 = 진행중 프로젝트 수 / PM 수 (활성 PM 기준)',
      source: 'GCMS: PM(L열), 진행상태(M열)',
      cycle: '월간 스냅샷 / PM별·팀별',
      target: '방문구축 PM 10건 이하', targetVal: 10, op: 'lte', unit: '건',
      asIs: 'PM당 8건', state: 'auto',
      note: '⚠ PM ≠ 구축자. 조직집계 합산 금지 (검증체크리스트 ③).',
      calc: D => {
        const act = D.active;
        const load = new Map();
        act.forEach(p => load.set(p.pm, (load.get(p.pm) || 0) + 1));
        const v = load.size ? act.length / load.size : null;
        const over = [...load.entries()].filter(([, c]) => c > 10).sort((a, b) => b[1] - a[1]);
        return {
          v, disp: f1(v) + '건',
          sub: `현진행 ${act.length.toLocaleString()}건 / 활성 PM ${load.size}명`,
          detail: [
            { label: '10건 초과 PM (과부하)', value: `${over.length}명` },
            ...over.slice(0, 5).map(([n, c]) => ({ label: n, value: `${c}건` })),
          ]
        };
      }
    },
    {
      id: '4.3', pillar: 4, name: '월평균 완료 처리 건수 (생산성)',
      def: '컨설턴트 1인당 월간 완료 처리 건수. 구축방식별 개인 생산성 벤치마크.',
      formula: '인당 완료 건수 = 팀 월 완료건수 / 팀 FTE (투입인력 수)',
      source: 'GCMS: 월 완료건 / 담당자별 원본: 구축인력',
      cycle: '월간',
      target: '방문구축 8건+, FoEX단독 15건+, 전체 평균 10건+', targetVal: 10, op: 'gte', unit: '건/월',
      asIs: '인당 8.7건/월', state: 'proxy',
      note: 'HR FTE 원천 미연동 → 담당자별 원본의 <구축 참여 인원수>를 FTE 대체값으로 사용.',
      calc: D => {
        const ms = D.monthly.filter(m => m.completed > 0).slice(-6);
        const perMonth = avg(ms.map(m => m.completed));
        const fte = D.assignees.length || D.meta.headcount || 1;
        const v = perMonth / fte;
        return {
          v, disp: f1(v) + '건',
          sub: `월평균 완료 ${f1(perMonth)}건 / FTE ${fte}명`,
          detail: ms.map(m => ({ label: m.ym, value: `완료 ${m.completed}건` }))
        };
      }
    },
    {
      id: '4.4', pillar: 4, name: '센터·지역별 인력 효율',
      def: '센터(수도권·중부호남·부산영남)별 처리 효율. 인력 불균형 및 FoEX 확대 필요 지역 진단.',
      formula: '센터 처리 비율(%) = 센터 완료건 / 센터 접수건 × 100\n지역 부담 지수 = 지역 접수 비중(%) / 지역 인력 비중(%)',
      source: 'GCMS: 구축부서(K열) → 센터 매핑 (a10-org-center-mapping)',
      cycle: '분기',
      target: '센터 간 완료율 편차 5%p 이내', targetVal: 5, op: 'lte', unit: '%p',
      asIs: '수도권 60.3% / 중부호남 55.0%', state: 'auto',
      note: '⚠ 센터명 단독 표기 금지 — 지역 병기 필수. Y열 아닌 K열(구축부서) 기준 매핑.',
      calc: D => {
        const g = D.byCenter.filter(x => x.key !== '미매핑');
        if (g.length < 2) return NA;
        const max = Math.max(...g.map(x => x.doneRate)), min = Math.min(...g.map(x => x.doneRate));
        return {
          v: max - min, disp: f1(max - min) + '%p',
          sub: `센터 ${g.length}개 완료율 편차`,
          detail: g.map(x => ({
            label: x.key, value: `${f1(x.doneRate)}% (${x.done}/${x.total}) · 비중 ${f1(pct(x.total, D.stat.total))}%`
          }))
        };
      }
    },
    {
      id: '4.5', pillar: 4, star: true, name: '월가용 CAPA',
      def: '가용 구축인력이 월간 소화 가능한 총 공수(m/d). 구축지연(M) 산출의 분모.',
      formula: '월가용 CAPA = 가용인원 × 계수 22.0\n계수 22.0 = 22워크데이 × 80%(순수구축) × 1.25(효율)',
      source: '스킬 a10-capa-buildperf ❷ (인력변동 시 월 단위 갱신)',
      cycle: '월간',
      target: '가용 82명 기준 1,804 m/d', targetVal: 1804, op: 'gte', unit: 'm/d',
      asIs: '1,804 m/d (82명 × 22.0)', state: 'auto',
      note: "🔴 '가용 94명' 사용 금지 — 행정수치이며 실질 가용은 82명 (검증체크리스트 ⑤).",
      calc: D => {
        const v = D.meta.capa;
        return {
          v, disp: f0(v) + ' m/d',
          sub: `가용 ${D.meta.headcount}명 × 계수 ${D.meta.capaCoef}`,
          detail: [
            { label: '계수 구성', value: '22워크데이 × 80% × 1.25 = 22.0' },
            { label: '소화율', value: `${f1(pct(D.meta.md?.converted, D.meta.md?.contract))}% (투입환산 ÷ 계약공수)` },
          ]
        };
      }
    },

    {
      id: '4.6', pillar: 4, star: true, name: 'WBS 준수율 ★핵심',
      def: 'WBS(모듈별 배정)에 계획된 개별 예상공수 대비 실제 순공수 투입 비율. ' +
           '배정 계획이 실제로 이행되었는지를 나타내는 대표 지표로, 구축기간 준수율과 함께 핵심 관리 대상이다.',
      formula: 'WBS 준수율(%) = 순공수 / 개별 예상공수 × 100\n' +
               '순공수 = 개별 투입공수 + 추가진행 + 마이그레이션 + 아웃바운드\n' +
               '※ 배정은 프로젝트 × 모듈 전량 집계 (중복 아님)',
      source: '담당자별 상세: 개별 예상/투입/미투입공수 · 추가·마이그·아웃바운드 (WBS 배정 원천)',
      cycle: '주간 / 담당자·모듈별',
      target: '80%+ 유지', targetVal: 80, op: 'gte', unit: '%',
      asIs: '77.7% (미해결 과제 #5 — WBS 순공수 기준)', state: 'auto',
      note: '⚠ PM ≠ 구축자 — 조직집계에 합산 금지 (검증체크리스트 ③). ' +
            '담당자별 원본과 GCMS의 기준일이 다르면 별첨 화면에 병기된다.',
      calc: D => {
        const w = D.wbs;
        if (!w || !w.all.n) return NA;
        const a = w.all;
        return {
          v: a.rate, disp: f1(a.rate) + '%',
          sub: `순공수 ${f0(a.net)} / 예상 ${f0(a.plan)} MD · 배정 ${a.n.toLocaleString()}행`,
          detail: [
            { label: '본투입 기준', value: `${f0(a.used)} / ${f0(a.plan)} = ${f1(a.usedRate)}%` },
            { label: '추가 · 마이그 · 아웃', value: `${f0(a.add)} · ${f0(a.mig)} · ${f0(a.out)} MD` },
            { label: '현진행 배정', value: `${w.active.n.toLocaleString()}행 · ${f1(w.active.rate)}% (담당 ${w.activePeople}명)` },
            { label: '완료 배정', value: `${w.done.n.toLocaleString()}행 · ${f1(w.done.rate)}%` },
            { label: '배정 소진 완료', value: `${a.fulfilled.toLocaleString()} / ${a.n.toLocaleString()}행 = ${f1(pct(a.fulfilled, a.n))}%` },
            { label: '구축 인력 · 대상 프로젝트', value: `${w.people}명 · ${w.projects.toLocaleString()}건` },
          ]
        };
      }
    },

    /* ═══════════ Pillar 5 ═══════════ */
    {
      id: '5.1', pillar: 5, star: true, name: 'Time to Value (TTV — 개통 소요기간)',
      def: '계약(수주) → 구축완료까지의 평균 소요 기간. A10 빠른 가치 실현의 핵심 지표.',
      formula: 'TTV(일) = AVG(구축완료일 − 수주일)  [완료 프로젝트]\n※ 구축방식별·서버유형별 분리 산출 필수',
      source: 'GCMS: 수주일(N열), 구축완료일(AF열)',
      cycle: '월간 / 구축방식·서버유형별',
      target: 'SaaS 60일 이내, 구축형 90일 이내, FoEX단독 40일 이내', targetVal: 60, op: 'lte', unit: '일',
      asIs: 'SaaS 45일 / 구축형 75일 (EQT Median 60일)', state: 'auto',
      note: '수주일 기준 산출. 개통확인서 발행일이 별도 관리되면 정합 산출로 대체 가능.',
      calc: D => {
        const fin = D.rows.filter(p => p.status === '완료' && p.ttv !== null && p.ttv >= 0);
        if (!fin.length) return NA;
        const v = avg(fin.map(p => p.ttv));
        const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
        return {
          v, disp: f0(v) + '일',
          sub: `완료 ${fin.length.toLocaleString()}건 평균 (중앙값 ${med(fin.map(p => p.ttv))}일)`,
          detail: [
            ...D.CODE.SERVER.map(s => ({
              label: s, value: `${f0(avg(fin.filter(p => p.server === s).map(p => p.ttv)))}일`
            })),
            ...D.CODE.METHOD.map(m => ({
              label: m, value: `${f0(avg(fin.filter(p => p.method === m).map(p => p.ttv)))}일`
            })),
          ]
        };
      }
    },
    {
      id: '5.2', pillar: 5, name: 'CSAT (개통 후 만족도)',
      def: '프로젝트 완료(개통) 직후 고객 만족도 (5점 척도). 구축 품질과 서비스 수준의 직접 측정.',
      formula: 'CSAT = AVG(고객 응답 점수, 5점 척도)\n※ 응답률 70%+ 이상에서만 유효 집계',
      source: 'VOC: 완료 설문 (현재 수기 → 시스템화 필요)',
      cycle: '프로젝트별 (완료 후 7일 이내)',
      target: '4.2/5.0 이상 (단기), 4.4/5.0 (1년)', targetVal: 4.2, op: 'gte', unit: '/5.0',
      asIs: '미집계 (EQT Median 4.0)', state: 'pending',
      note: 'VOC 설문 시스템화가 선결 과제. Phase 3 로드맵.',
      calc: () => NA
    },
    {
      id: '5.3', pillar: 5, name: 'ARR 갱신 준비도 (Renewal-Ready)',
      def: '개통 후 6개월 시점 A10 SaaS 고객의 갱신 의향 종합 점수.',
      formula: 'Renewal-Ready = 0.3×Adoption + 0.3×CSAT정규화 + 0.2×무장애일수 + 0.2×VoC응답성',
      source: 'A10 사용로그 / VOC / ITSM',
      cycle: '개통 후 6개월 시점',
      target: '70점+. 위험 고객(60점 이하) 즉시 CS 개입', targetVal: 70, op: 'gte', unit: '점',
      asIs: '미집계', state: 'pending',
      note: '3개 원천 동시 연동 필요. Phase 3 로드맵.',
      calc: () => NA
    },
    {
      id: '5.4', pillar: 5, name: 'A10 SaaS AI Attach Rate',
      def: '최근 30일 내 A10 AI 기능을 1회 이상 사용한 고객 비율.',
      formula: 'AI Attach Rate(%) = 30일 내 AI 이벤트 발생 고객수 / 전체 라이브 고객수 × 100',
      source: 'A10 사용로그 → GCMS 연동 (Phase 1)',
      cycle: '월간',
      target: '1년차 30%+, 2년차 50%+', targetVal: 30, op: 'gte', unit: '%',
      asIs: '미집계', state: 'pending',
      note: 'ONE AI 도입여부 필드가 분모 원천. A10 텔레메트리 연동 필요.',
      calc: () => NA
    },

    /* ═══════════ Pillar 6 ═══════════ */
    {
      id: '6.1', pillar: 6, name: '전년 이월 부담률',
      def: '연초 접수 잔여건 중 전년도에서 넘어온 이월 비중. 연간 처리 과부하 구조의 선행 지표.',
      formula: '이월 부담률(%) = 전년 이월건 / 연초 전체 잔여건 × 100\n연초 전체 잔여건 = 전년이월 + 당해연도 1월 신규접수',
      source: 'GCMS: 구축접수일(Z열) 연도',
      cycle: '연 1회 (1월 첫째 주)',
      target: '이월 부담률 60% 이하', targetVal: 60, op: 'lte', unit: '%',
      asIs: '81.3% (2026년 1월 — 과부하)', state: 'auto',
      note: '연말 잔여건 사전 협의·완료 강화로 구조 개선 필요. 연말 이월 50건 이하 목표.',
      calc: D => {
        const carry = D.meta.carry || 0;
        const janNew = D.rows.filter(p => p.recvYM === `${D.asOf.slice(0, 4)}-01`).length;
        const v = pct(carry, carry + janNew);
        return {
          v, disp: f1(v) + '%',
          sub: `이월 ${carry.toLocaleString()}건 / 1월 신규 ${janNew.toLocaleString()}건`,
          detail: Object.entries(D.meta.carryByYear || {}).map(([y, c]) => ({ label: `${y}년 접수`, value: `${c.toLocaleString()}건` }))
        };
      }
    },
    {
      id: '6.2', pillar: 6, name: 'Go-live 후 30일 안정성',
      def: '개통 후 첫 30일 내 Critical 장애(Sev1) 발생 건수. 구축 품질의 최종 검증 지표.',
      formula: 'Stability = COUNT(Sev1 incident, 개통일 ~ 개통일+30일)',
      source: 'ITSM: Incident 로그 (시스템화 필요)',
      cycle: '프로젝트별',
      target: 'Sev1 0건, Sev2 3건 이내', targetVal: 0, op: 'lte', unit: '건',
      asIs: '미집계', state: 'pending',
      note: 'ITSM Incident 로그 시스템화가 선결 과제. Phase 3 로드맵.',
      calc: () => NA
    },
    {
      id: '6.3', pillar: 6, star: true, name: '지연 프로젝트 비율 (RAG Red%)',
      def: '구축 기간 내 정상 처리가 어렵거나 60일 이상 미완료로 경고 상태인 프로젝트 비율.',
      formula: 'Red% = 지연(Red) 프로젝트 수 / 전체 진행 프로젝트 수 × 100\nRed: 약정 완료일 초과 또는 60일 이상 진행 / Amber: D-14 이내·게이트 지연',
      source: 'GCMS: 진행상태(M열)',
      cycle: '주간 스냅샷',
      target: 'Red% 8% 이하 (단기), 5% 이하 (연말)', targetVal: 8, op: 'lte', unit: '%',
      asIs: '11.2% (EQT Median 5%)', state: 'auto',
      note: '지연 구축진행 현황 80건 → 40건 축소 목표.',
      calc: D => {
        const act = D.active;
        const red = act.filter(p => p.status === '지연').length;
        const amber = D.rows.filter(p => p.status === '보류').length;
        const v = pct(red, act.length);
        return {
          v, disp: f1(v) + '%',
          sub: `Red ${red}건 / 현진행 ${act.length.toLocaleString()}건`,
          detail: [
            { label: 'Red (지연)', value: `${red}건 · ${f1(v)}%` },
            { label: 'Amber (보류)', value: `${amber}건` },
            { label: 'Green (정상 진행)', value: `${act.length - red}건` },
          ]
        };
      }
    },
    {
      id: '6.4', pillar: 6, name: 'H/W 조달 대기 리스크 지수',
      def: 'On-prem 구축형에서 H/W 납품 대기로 착수 지연된 건수. 구축형 완료율 저하의 핵심 원인.',
      formula: 'H/W 대기율(%) = H/W 대기 건 / 전체 구축형 진행 건 × 100',
      source: 'GCMS: 제품구분(G열) + 착수 지연사유 코드 (신설 필요)',
      cycle: '주간',
      target: 'H/W 대기율 10% 이하, 평균 대기일 14일 이하', targetVal: 10, op: 'lte', unit: '%',
      asIs: '추정 20%+ (평균 대기 18일)', state: 'proxy',
      note: '착수 지연사유 코드 미보유 → 구축형 현진행 중 투입 0MD 건을 착수대기로 추정. 화면정의서 [구축정보] <지연사유> 코드 신설 필요.',
      calc: D => {
        const onp = D.active.filter(p => p.server === '구축형');
        const zero = onp.filter(p => (p.mdUsed || 0) === 0).length;
        const v = pct(zero, onp.length);
        return {
          v, disp: f1(v) + '%',
          sub: `구축형 현진행 ${onp.length}건 중 미착수 ${zero}건`,
          detail: [{ label: '※ 추정 기준', value: '투입공수 0MD = 착수 대기 간주' }]
        };
      }
    },
    {
      id: '6.5', pillar: 6, star: true, name: '구축지연 (M) — 계약공수 기준',
      def: '최종 미투입공수를 월가용 CAPA로 나눈 값. 현 인력으로 재공을 소화하는 데 필요한 개월 수.',
      formula: '구축지연(M) = 최종 미투입공수 ÷ 월가용 CAPA\n최종 미투입 = 유상미투입 + 무상미투입1차 × 30%\n계약공수 = 투입환산 + 미투입1차   ★항등식',
      source: 'GCMS: 구축구분(Y) · 표준공수(AH) · 예상공수(AI) · 투입공수(AJ)',
      cycle: '주간',
      target: '2.0M 이하', targetVal: 2.0, op: 'lte', unit: 'M',
      asIs: '2.20M (260726 확정)', state: 'auto',
      note: '🔴 v69 값 3,747 / 2.08M 인용 금지 (부분갱신 상태). 🔴 미투입공수 단순 AI−AJ 사용 금지 — 무상공수 누락. 🔴 AK(진행률%) 컬럼 사용 금지.',
      calc: D => {
        const m = D.meta.md || {};
        const v = D.meta.delayM;
        return {
          v, disp: f2(v) + 'M',
          sub: `최종미투입 ${f1(m.finalUn)} ÷ CAPA ${f0(D.meta.capa)}`,
          detail: [
            { label: '계약공수', value: `${f1(m.contract)} m/d` },
            { label: '= 투입환산 + 미투입1차', value: `${f1(m.converted)} + ${f1(m.un1)}` },
            { label: '미투입1차 = 유상 + 무상', value: `${f1(m.paidUn)} + ${f1(m.freeUn1)}` },
            { label: '최종미투입 (무상×30%)', value: `${f1(m.paidUn)} + ${f1(m.freeUn1 * 0.3)} = ${f1(m.finalUn)}` },
            { label: '미투입률', value: `${f1(pct(m.finalUn, m.contract))}%` },
          ]
        };
      }
    },

    /* ═══════════ Pillar 7 ═══════════ */
    {
      id: '7.1', pillar: 7, name: 'PM·컨설턴트 AI 도구 활용률 (DAU%)',
      def: 'Claude/Copilot 등 AI 도구를 일일 활성 사용하는 PM·컨설턴트 비율.',
      formula: 'AI DAU% = AI 도구 일일 활성 인원 / 전체 구축 인력 × 100',
      source: 'HR: AI 도구 사용현황 로그 (IT인프라 협력)',
      cycle: '주간',
      target: 'DAU/WAU 70%+ (Green) / 40~70% (Amber) / 40% 미만 (Red)', targetVal: 70, op: 'gte', unit: '%',
      asIs: '미집계', state: 'pending',
      note: '분모(전체 구축 인력)는 산출 가능. AI 도구 사용 로그는 IT인프라 협력 필요.',
      calc: D => ({
        v: null, disp: '연동 필요',
        sub: `분모 산출 가능: 구축인력 ${D.assignees.length || D.meta.headcount}명`, detail: []
      })
    },
    {
      id: '7.2', pillar: 7, star: true, name: 'AI 기인 공수 절감률',
      def: '표준 공수 대비 AI 도구 활용 시 실제 투입 공수 감소율. AI 생산성 향상의 정량 증명.',
      formula: 'AI 공수 절감률(%) = (표준공수 − 실투입공수) / 표준공수 × 100',
      source: 'GCMS: 표준공수(AH열) · 투입공수(AJ열)',
      cycle: '프로젝트별 → 분기 평균',
      target: '15%+ (1년차), 20%+ (2년차)', targetVal: 15, op: 'gte', unit: '%',
      asIs: '측정 필요', state: 'proxy',
      note: 'AI 활용 프로젝트 플래그 미보유 → 완료 프로젝트 전체 기준 산출. AI 활용 여부 코드 추가 시 정밀 산출 가능.',
      calc: D => {
        const fin = D.rows.filter(p => p.status === '완료' && p.mdStd > 0 && p.mdUsed > 0);
        if (!fin.length) return NA;
        const std = fin.reduce((a, p) => a + p.mdStd, 0);
        const used = fin.reduce((a, p) => a + p.mdUsed, 0);
        const v = (std - used) / std * 100;
        return {
          v, disp: f1(v) + '%',
          sub: `표준 ${f0(std)}MD → 투입 ${f0(used)}MD (완료 ${fin.length.toLocaleString()}건)`,
          detail: [{ label: '절감 공수', value: `${f0(std - used)} MD` }]
        };
      }
    },
    {
      id: '7.3', pillar: 7, name: 'Embedded AI ARR 비중',
      def: 'iCUBE→A10 전환 업세일 시 AI 기능 포함 요금 차이 비중. AI 가치의 재무적 가시화.',
      formula: 'Embedded AI ARR = Σ(A10 월요금 − iCUBE 환산 월요금) × 12  [EMB_AI 코드 건]',
      source: 'NSM10/AMS: 계약유형 코드(EMB_AI)',
      cycle: '분기',
      target: '전체 ARR 대비 10%+', targetVal: 10, op: 'gte', unit: '%',
      asIs: '미집계', state: 'pending',
      note: 'NSM10 EMB_AI 계약유형 코드 신설 + 전환 전후 요금 이력 관리 필요.',
      calc: () => NA
    },
  ];

  /* Executive Dashboard — 가이드라인 §2 6대 KPI + 주간보고 4대 KPI */
  /* Executive 6대 카드 — 구축기간 준수율·WBS 준수율을 최우선 배치 */
  const EXEC = ['1.9', '4.6', '1.1', '6.5', '1.7', '1.6'];

  function judge(k, v) {
    if (v === null || v === undefined || !isFinite(v) || k.targetVal === undefined)
      return { cls: 'idle', txt: '측정 대기' };
    const t = k.targetVal;
    const ok = k.op === 'lte' ? v <= t : v >= t;
    if (ok) return { cls: 'ok', txt: '달성' };
    const ratio = k.op === 'lte' ? (v === 0 ? 1 : t / v) : v / t;
    return ratio >= 0.8 ? { cls: 'warn', txt: '주의' } : { cls: 'risk', txt: '미달' };
  }

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

  const summary = c => {
    const all = [...c.values()];
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
