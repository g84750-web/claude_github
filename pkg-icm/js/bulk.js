/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 프로젝트 일괄등록 (GCMS 엑셀 업로드)

   원본 : 2026년 솔루션구축센터_구축총괄실적현황(통합)_PKG사업본부_YYMMDD.xlsx
   시트 : 3번째 시트 「GCMS A10(통합)구축진행현황」
   산식 : etl_gcms.py 와 동일 — 작업지침 v2 §1-3 계약공수 기준 공수 산정

   ※ Python 없이 브라우저에서 데이터를 갱신하기 위한 경로.
     서버 배포본에서도 동작하며 항등식 검증을 통과해야 적용된다.
   ══════════════════════════════════════════════════════════════════ */
const BULK = (() => {

  const SHEET = 'GCMS A10(통합)구축진행현황';
  const SHEET_INDEX = 2;                       // 3번째 시트 (0-based)

  /* 부록 A. GCMS 컬럼 레퍼런스 (0-based) */
  const C = {
    no: 0, code: 1, customer: 2, bizno: 3, product: 6, pjtType: 7, module: 9,
    dept: 10, pm: 11, status: 12, orderDate: 13, orderAmt: 14, license: 15, eduFee: 16,
    form: 19, revFlag: 22, evidence: 23, method: 24, recv: 25, install: 26, start: 27,
    due: 29, dueChg: 30, done: 31, mdStd: 33, mdPlan: 34, mdUsed: 35,
    upsell: 41, region: 44, ucPack: 45, ctrStart: 50, ctrEnd: 51,
  };

  /* 부록 B. 센터 매핑 */
  const CENTER = {
    '솔루션구축1Unit': '1센터(서울/수도권)', '솔루션구축2Unit': '1센터(서울/수도권)',
    '솔루션구축3Unit': '1센터(서울/수도권)', '솔루션구축4Unit': '2센터(중부/호남권)',
    '솔루션구축5Unit': '3센터(부산/영남권)',
  };

  const M_1N = 'FoEX교육(1:N)', M_MIX = 'FoEX교육(1:N)+방문';
  const FOEX_FAMILY = [M_1N, M_MIX];
  const FREE_COEF = 0.30, CAPA_COEF = 22.0;
  const ACTIVE = ['진행', '지연'];
  const KEEP = ['조기', '정시', '30일내'];

  const S = v => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim();
  const N = v => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  };

  /** 엑셀 날짜 → ISO. 직렬값(1900 date system) · 문자열 모두 수용 */
  function xdate(v) {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).trim();
    if (/^\d+(\.\d+)?$/.test(s)) {                       // 직렬값
      const n = parseFloat(s);
      if (n < 20000 || n > 80000) return null;           // 1954~2119 범위 밖은 날짜 아님
      const ms = Math.round((n - 25569) * 86400000);     // 25569 = 1970-01-01 직렬값
      const d = new Date(ms);
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }
    const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return null;
  }

  const dayDiff = (a, b) => (a && b)
    ? Math.round((new Date(b) - new Date(a)) / 86400000) : null;

  const bucket = d => d === null ? null
    : d < 0 ? '조기' : d === 0 ? '정시' : d <= 30 ? '30일내'
      : d <= 60 ? '1M초과' : d <= 90 ? '2M초과' : '3M초과';

  /* ── 행 변환 — etl_gcms.py load() 와 동일 산식 ─────────────── */
  function transform(grid, asOf) {
    const today = new Date(asOf);
    const rows = [];
    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r) continue;
      const code = S(r[C.code]);
      if (!code || code === '프로젝트 코드') continue;      // 유효행 판정

      const unit = S(r[C.dept]).replace('본사(', '').replace(')', '');
      const status = S(r[C.status]), method = S(r[C.method]);
      const mdStd = N(r[C.mdStd]), mdPlan = N(r[C.mdPlan]), mdUsed = N(r[C.mdUsed]);
      const start = xdate(r[C.start]);
      const due = xdate(r[C.due]), dueChg = xdate(r[C.dueChg]);
      const bp = dueChg || due;                             // BP = AE 1순위 → AD 2순위
      const done = xdate(r[C.done]);
      const product = S(r[C.product]);

      const rec = {
        no: N(r[C.no]) || rows.length + 1,
        code, customer: S(r[C.customer]), bizno: S(r[C.bizno]),
        product, server: product.includes('SaaS') ? 'SaaS' : '구축형',
        pjtType: S(r[C.pjtType]), module: S(r[C.module]),
        dept: S(r[C.dept]), unit, center: CENTER[unit] || '미매핑',
        pm: S(r[C.pm]), status, method,
        evidence: S(r[C.evidence]), form: S(r[C.form]), revFlag: S(r[C.revFlag]),
        upsell: S(r[C.upsell]), region: S(r[C.region]),
        regionGrp: S(r[C.region]).split('/')[0] || '미지정',
        ucPack: S(r[C.ucPack]),
        orderAmt: N(r[C.orderAmt]), license: N(r[C.license]), eduFee: N(r[C.eduFee]),
        orderDate: xdate(r[C.orderDate]), recvDate: xdate(r[C.recv]),
        startDate: start, installDate: xdate(r[C.install]),
        dueDate: due, dueChgDate: dueChg, bpDate: bp, doneDate: done,
        ctrStart: xdate(r[C.ctrStart]), ctrEnd: xdate(r[C.ctrEnd]),
        mdStd, mdPlan, mdUsed,
        mdContract: 0, mdPaidUn: 0, mdFreeUn1: 0, mdFinalUn: 0,
        remainRate: null, spRule: null,
      };

      // ── 납기 판정 ──
      rec.dlvDelta = (status === '완료') ? dayDiff(bp, done) : null;
      rec.dlvBucket = bucket(rec.dlvDelta);
      rec.dlvBaseDelta = (status === '완료') ? dayDiff(due, done) : null;
      rec.dlvBaseBucket = bucket(rec.dlvBaseDelta);
      rec.dlvExtended = !!(KEEP.includes(rec.dlvBucket) && !KEEP.includes(rec.dlvBaseBucket));

      // ── 계약공수 기준 공수 산정 (현진행 건만) ──
      if (ACTIVE.includes(status)) {
        if (rec.pjtType === '추가' && rec.module === '기타' && mdStd === 0 && mdPlan === 0) {
          rec.spRule = '공수0';                              // 특수규칙 ③
        } else {
          const contract = FOEX_FAMILY.includes(method) ? mdStd : mdPlan;
          rec.mdContract = contract;

          let remain;
          if (start && bp && new Date(bp) > new Date(start)) {
            if (today > new Date(bp)) {
              remain = 0.05;                                 // 특수규칙 ② 경과 → 잔여율 5%
              if (FOEX_FAMILY.includes(method)) rec.spRule = '경과5%';
            } else {
              // 상한 1.0만 적용 — 착수 전(음수)은 하한 클램프하지 않는다
              const prog = Math.min(1, dayDiff(start, asOf) / dayDiff(start, bp));
              remain = 1 - prog;
            }
          } else remain = 1;
          rec.remainRate = Math.round(remain * 1e6) / 1e6;

          if (method === M_1N) rec.mdFreeUn1 = contract * remain;
          else if (method === M_MIX) {
            rec.mdPaidUn = Math.max(0, mdPlan - mdUsed);
            rec.mdFreeUn1 = Math.max(0, mdStd - mdPlan) * remain;
          } else rec.mdPaidUn = Math.max(0, mdPlan - mdUsed);

          rec.mdFinalUn = rec.mdPaidUn + rec.mdFreeUn1 * FREE_COEF;
        }
      }
      rows.push(rec);
    }
    return rows;
  }

  /* ── 집계 · 항등식 검증 — etl_gcms.py verify() 와 동일 ─────── */
  function verify(rows, asOf, headcount = 82) {
    const cnt = k => rows.filter(p => p.status === k).length;
    const status = {};
    ['완료', '진행', '지연', '보류', '반품'].forEach(s => status[s] = cnt(s));
    const total = rows.length, done = status['완료'];
    const act = rows.filter(p => ACTIVE.includes(p.status));

    const year = asOf.slice(0, 4);
    const carryByYear = {};
    rows.forEach(p => {
      const y = (p.recvDate || '').slice(0, 4);
      if (y) carryByYear[y] = (carryByYear[y] || 0) + 1;
    });
    const carry = Object.entries(carryByYear).filter(([y]) => y < year)
      .reduce((a, [, c]) => a + c, 0);
    const nw = carryByYear[year] || 0;

    const dlv = {}, dlvB = {};
    ['조기', '정시', '30일내', '1M초과', '2M초과', '3M초과'].forEach(b => {
      dlv[b] = rows.filter(p => p.dlvBucket === b).length;
      dlvB[b] = rows.filter(p => p.dlvBaseBucket === b).length;
    });
    const keep = dlv['조기'] + dlv['정시'] + dlv['30일내'];
    const keepB = dlvB['조기'] + dlvB['정시'] + dlvB['30일내'];
    const judgedB = Object.values(dlvB).reduce((a, b) => a + b, 0);

    const methodAgg = {};
    act.forEach(p => {
      const m = p.method || '미분류';
      const a = methodAgg[m] || (methodAgg[m] = { cnt: 0, contract: 0, plan: 0, used: 0, paid: 0, free: 0, final: 0 });
      a.cnt++;
      a.contract += p.mdContract; a.plan += p.mdPlan;
      a.used += (p.method === M_1N ? 0 : p.mdUsed);          // 1:N 투입은 산정 제외
      a.paid += p.mdPaidUn; a.free += p.mdFreeUn1; a.final += p.mdFinalUn;
    });
    const T = k => Object.values(methodAgg).reduce((a, x) => a + x[k], 0);
    const contract = T('contract'), paidUn = T('paid'), freeUn1 = T('free');
    const un1 = paidUn + freeUn1, converted = contract - un1, finalUn = T('final');
    const capa = headcount * CAPA_COEF;

    const pop = rows.filter(p => p.pjtType === '신규' && p.product === 'Amaranth10'
      && p.ctrStart && p.ctrEnd && p.code !== 'PAC240528003');
    const cfin = pop.filter(p => p.status === '완료');
    const cok = cfin.filter(p => p.doneDate && p.doneDate <= p.ctrEnd).length;

    const sp = {};
    rows.forEach(p => { if (p.spRule) sp[p.spRule] = (sp[p.spRule] || 0) + 1; });

    const round1 = v => Math.round(v * 10) / 10;
    return {
      asOf, headcount, capaCoef: CAPA_COEF, capa,
      total, status, done, doneRate: Math.round(done / total * 1e4) / 100,
      active: act.length, carry, new: nw, carryByYear,
      delivery: dlv, deliveryKeep: keep,
      deliveryRate: done ? Math.round(keep / done * 1e3) / 10 : null,
      deliveryBase: dlvB, deliveryBaseKeep: keepB, deliveryBaseJudged: judgedB,
      deliveryBaseRate: judgedB ? Math.round(keepB / judgedB * 1e3) / 10 : null,
      deliveryExtended: rows.filter(p => p.dlvExtended).length,
      methodAgg: Object.fromEntries(Object.entries(methodAgg).map(([k, v]) =>
        [k, Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, round1(vv)]))])),
      md: {
        contract: round1(contract), plan: round1(T('plan')), used: round1(T('used')),
        paidUn: round1(paidUn), freeUn1: round1(freeUn1),
        un1: round1(un1), converted: round1(converted), finalUn: round1(finalUn),
      },
      delayM: capa ? Math.round(finalUn / capa * 100) / 100 : null,
      spRule: sp,
      contractTerm: {
        pop: pop.length + 1, popEx: pop.length, fin: cfin.length, ok: cok,
        over: cfin.length - cok,
        rate: cfin.length ? Math.round(cok / cfin.length * 1e3) / 10 : null,
        exception: cfin.filter(p => p.dueChgDate).length,
        baseKeep: cfin.filter(p => KEEP.includes(p.dlvBaseBucket)).length,
        baseRate: cfin.length
          ? Math.round(cfin.filter(p => KEEP.includes(p.dlvBaseBucket)).length / cfin.length * 1e3) / 10 : null,
      },
      orderAmtM: Math.round(rows.reduce((a, p) => a + p.orderAmt, 0) / 1e6),
      identity: {
        statusSum: Object.values(status).reduce((a, b) => a + b, 0) === total,
        carrySum: carry + nw === total,
        deliverySum: keep + dlv['1M초과'] + dlv['2M초과'] + dlv['3M초과'] === done,
        mdIdentity: Math.abs(contract - (converted + un1)) < 0.5,
      },
    };
  }

  /** 항등식 검증 항목 리스트 (화면 표시용) */
  function checks(meta) {
    const m = meta.md, id = meta.identity, st = meta.status, dlv = meta.delivery;
    const f1 = v => (v === null || !isFinite(v)) ? '—' : v.toFixed(1);
    return [
      { ok: id.statusSum, label: '상태별 합계 = 총접수',
        expr: `${['완료', '진행', '지연', '보류', '반품'].map(s => st[s] || 0).join(' + ')} = ${meta.total.toLocaleString()}` },
      { ok: id.carrySum, label: '이월 + 신규 = 총접수',
        expr: `${meta.carry.toLocaleString()} + ${meta.new.toLocaleString()} = ${meta.total.toLocaleString()}` },
      { ok: true, label: '완료율',
        expr: `${meta.done.toLocaleString()} ÷ ${meta.total.toLocaleString()} = ${meta.doneRate}%` },
      { ok: id.deliverySum, label: '납기준수건 = 조기 + 정시 + 30일내',
        expr: `${dlv['조기']} + ${dlv['정시']} + ${dlv['30일내']} = ${meta.deliveryKeep} / ${meta.done.toLocaleString()} → ${meta.deliveryRate}%` },
      { ok: id.mdIdentity, label: '★ 계약공수 = 투입환산 + 미투입1차',
        expr: `${f1(m.contract)} = ${f1(m.converted)} + ${f1(m.un1)}` },
      { ok: Math.abs(m.un1 - (m.paidUn + m.freeUn1)) < 0.5, label: '미투입1차 = 유상 + 무상',
        expr: `${f1(m.un1)} = ${f1(m.paidUn)} + ${f1(m.freeUn1)}` },
      { ok: Math.abs(m.finalUn - (m.paidUn + m.freeUn1 * FREE_COEF)) < 0.5, label: '최종미투입 = 유상 + 무상×30%',
        expr: `${f1(m.finalUn)} = ${f1(m.paidUn)} + ${f1(m.freeUn1 * FREE_COEF)}` },
      { ok: true, label: '구축지연 = 최종미투입 ÷ 월가용 CAPA',
        expr: `${f1(m.finalUn)} ÷ ${meta.capa.toLocaleString()} = ${meta.delayM}M` },
    ];
  }

  /** 업로드 → 파싱 → 변환 → 검증 (전 과정) */
  async function parse(arrayBuffer, asOf, sheetName) {
    const r = await INGEST.parseXlsx(arrayBuffer, sheetName || SHEET);
    // 지정 시트를 못 찾으면 3번째 시트로 폴백
    let grid = r.grid, used = r.sheet;
    if (!sheetName && r.sheets && !r.sheets.includes(SHEET) && r.sheets[SHEET_INDEX]) {
      const r2 = await INGEST.parseXlsx(arrayBuffer, r.sheets[SHEET_INDEX]);
      grid = r2.grid; used = r2.sheet;
    }
    const rows = transform(grid, asOf);
    if (!rows.length) throw new Error('유효한 프로젝트 행이 없습니다. 시트 선택을 확인하세요.');
    return { rows, meta: verify(rows, asOf), sheets: r.sheets, sheet: used, gridRows: grid.length };
  }

  /** 파일명에서 기준일(YYMMDD / YYYYMMDD) 추출 */
  function asOfFromName(name) {
    const m = String(name).match(/(\d{8})(?!.*\d{8})/) || String(name).match(/(\d{6})(?!.*\d{6})/);
    if (!m) return null;
    const s = m[1];
    return s.length === 8
      ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`
      : `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4)}`;
  }

  return { SHEET, parse, transform, verify, checks, asOfFromName, C, CENTER };
})();
