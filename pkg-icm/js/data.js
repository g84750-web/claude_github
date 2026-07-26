/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 데이터 정규화 계층
   원천: GCMS (Google Sheets 기반 구축진척관리시스템)
   매핑 기준: NSM 개발 화면정의서 V2.0 (PROJECT등록 필드 체계)
   ══════════════════════════════════════════════════════════════════ */
const DATA = (() => {

  /* ── 화면정의서 기준 코드 정의 ──────────────────────────────── */
  const CODE = {
    // 구축상태 (진행상태)
    STATUS: ['진행', '완료', '지연', '보류', '반품'],
    // 구축구분 (구축방식) — KPI 1.4 / 3.1 FAR 산출 기준
    METHOD: ['방문구축', 'FoEX교육(단독)', 'FoEX교육(1:N)', 'FoEX교육(1:N)+방문'],
    // 제품형태 → 서버유형 (KPI 1.5 SaaS vs 구축형 Gap 산출 기준)
    SERVER: ['SaaS', '구축형'],
    // 프로젝트구분
    PJT_TYPE: ['신규', '추가'],
  };

  /* 진행 종결 상태 — 화면정의서 slide5: "진행부분은 진행상태가 <완료,반품>이 아닌 것 적용" */
  const CLOSED = ['완료', '반품'];

  /* ── 단일 레코드 정규화 ─────────────────────────────────────── */
  function normalizeRow(r) {
    const unit = (r.department || '').replace('본사(', '').replace(')', '') || '미지정';
    const isSaaS = (r.product_type || '').includes('SaaS');
    const method = r.construction_type || '미분류';

    // 화면정의서 slide8 공수정보 필드 매핑
    //   계약공수      ← standard_hours (모듈별 표준공수 합)
    //   예상공수(유)  ← expected_hours
    //   예상공수(무)  = 계약공수 − 예상공수(유)      [slide8 계산식]
    //   투입공수(유)  ← invested_hours
    //   잔여공수      = 예상공수(유) − 투입공수(유)  [slide9 계산식]
    const mdContract = num(r.standard_hours);
    const mdPlanPaid = num(r.expected_hours);
    const mdPlanFree = Math.max(0, mdContract - mdPlanPaid);
    const mdInPaid = num(r.invested_hours);
    const mdRemain = mdPlanPaid - mdInPaid;

    // 수행기간 — slide8: 일수[구축시작일 ~ 구축완료보고일]
    //   ※ GCMS 미보유 필드(구축시작일/완료보고일/보류기간) → 접수일~완료예정일 대체 산출
    const days = dayDiff(r.receipt_date, r.expected_completion);

    return {
      no: r.no,
      projectCode: r.project_code,          // 프로젝트코드 (PAS/PAC + YYMM + 일련 3자리)
      customer: r.customer,                 // 거래처명
      dept: r.department,                   // 구축부서
      unit,                                 // Unit 축약
      pm: r.pm,                             // PM
      status: r.status,                     // 구축상태
      method,                               // 구축구분(구축방식)
      receiptDate: r.receipt_date,          // 구축접수일
      dueDate: r.expected_completion,       // 구축완료예정일
      productType: r.product_type,          // 제품구분
      serverType: isSaaS ? 'SaaS' : '구축형', // 서버유형 (파생)
      pjtType: r.project_type,              // 프로젝트구분(신규/추가)
      constructorsRaw: r.constructors || '',
      assignees: parseAssignees(r.constructors),  // 배정정보 (담당자·모듈)

      // 공수정보
      mdContract, mdPlanPaid, mdPlanFree, mdInPaid, mdRemain,
      progress: num(r.progress_rate),
      days,

      // 파생 플래그
      isFoEX: method.startsWith('FoEX'),
      isPureFoEX: method === 'FoEX교육(단독)' || method === 'FoEX교육(1:N)',
      isClosed: CLOSED.includes(r.status),
      isActive: !CLOSED.includes(r.status),   // 진행 중 (지연·보류 포함)
      receiptYM: (r.receipt_date || '').slice(0, 7),
      receiptYear: (r.receipt_date || '').slice(0, 4),
      dueYM: (r.expected_completion || '').slice(0, 7),
    };
  }

  /* ── 배정정보 파싱: "김규태(UC,인사)/이정화(회계)" ───────────── */
  function parseAssignees(str) {
    if (!str) return [];
    return String(str).split('/').map(p => {
      const m = p.trim().match(/^(.+?)\((.+)\)$/);
      if (!m) return p.trim() ? { name: p.trim(), modules: [] } : null;
      return {
        name: m[1].trim(),
        modules: m[2].split(',').map(x => x.trim()).filter(Boolean)
      };
    }).filter(Boolean);
  }

  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (parseFloat(v) || 0);

  function dayDiff(a, b) {
    if (!a || !b) return null;
    const d1 = new Date(a), d2 = new Date(b);
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
  }

  /* ── 담당자(구축자) 집계 — 화면정의서 slide21 공수현황(개인) ── */
  function buildAssigneeStats(rows) {
    const map = new Map();
    rows.forEach(p => {
      p.assignees.forEach(a => {
        if (!map.has(a.name)) {
          map.set(a.name, {
            name: a.name, projects: 0, active: 0, done: 0, delayed: 0,
            mdContract: 0, mdPlanPaid: 0, mdInPaid: 0,
            modules: new Map(), units: new Set(), lastDate: ''
          });
        }
        const s = map.get(a.name);
        s.projects++;
        if (p.status === '완료') s.done++;
        if (p.status === '지연') s.delayed++;
        if (p.isActive) s.active++;
        s.mdContract += p.mdContract;
        s.mdPlanPaid += p.mdPlanPaid;
        s.mdInPaid += p.mdInPaid;
        s.units.add(p.unit);
        if (p.receiptDate > s.lastDate) s.lastDate = p.receiptDate;
        a.modules.forEach(m => s.modules.set(m, (s.modules.get(m) || 0) + 1));
      });
    });
    return [...map.values()].map(s => ({
      ...s,
      mdRemain: s.mdPlanPaid - s.mdInPaid,
      // 생산성 = 계약(표준)공수 / 투입공수 × 100
      productivity: s.mdInPaid > 0 ? (s.mdContract / s.mdInPaid * 100) : null,
      topModules: [...s.modules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      unitList: [...s.units].join(', ')
    })).sort((a, b) => b.projects - a.projects);
  }

  /* ── PM 집계 ─────────────────────────────────────────────────── */
  function buildPMStats(rows) {
    const map = new Map();
    rows.forEach(p => {
      if (!map.has(p.pm)) map.set(p.pm, {
        name: p.pm, total: 0, done: 0, active: 0, delayed: 0, held: 0,
        mdContract: 0, mdInPaid: 0, units: new Set()
      });
      const s = map.get(p.pm);
      s.total++;
      if (p.status === '완료') s.done++;
      if (p.status === '지연') s.delayed++;
      if (p.status === '보류') s.held++;
      if (p.isActive) s.active++;
      s.mdContract += p.mdContract;
      s.mdInPaid += p.mdInPaid;
      s.units.add(p.unit);
    });
    return [...map.values()].map(s => ({
      ...s,
      doneRate: s.total > 0 ? s.done / s.total * 100 : 0,
      productivity: s.mdInPaid > 0 ? s.mdContract / s.mdInPaid * 100 : null,
      unitList: [...s.units].join(', ')
    })).sort((a, b) => b.total - a.total);
  }

  /* ── 월별 시계열 — KPI 1.3 재공 처리 속도 산출용 ─────────────── */
  function buildMonthly(rows) {
    const m = new Map();
    const touch = ym => {
      if (!m.has(ym)) m.set(ym, { ym, received: 0, completed: 0, returned: 0, amountless: 0 });
      return m.get(ym);
    };
    rows.forEach(p => {
      if (p.receiptYM) touch(p.receiptYM).received++;
      // 완료 시점 원천(구축완료보고일) 미보유 → 완료예정일을 완료 시점 대체값으로 사용
      if (p.status === '완료' && p.dueYM) touch(p.dueYM).completed++;
      if (p.status === '반품' && p.dueYM) touch(p.dueYM).returned++;
    });
    const list = [...m.values()].sort((a, b) => a.ym.localeCompare(b.ym));
    // 재공(WIP) 잔여 누적 = 누적접수 − 누적완료 − 누적반품
    let cr = 0, cc = 0, cx = 0;
    list.forEach(r => {
      cr += r.received; cc += r.completed; cx += r.returned;
      r.cumReceived = cr; r.cumCompleted = cc; r.cumReturned = cx;
      r.wip = cr - cc - cx;
    });
    return list;
  }

  /* ── 그룹 집계 헬퍼 ──────────────────────────────────────────── */
  function groupBy(rows, keyFn) {
    const m = new Map();
    rows.forEach(p => {
      const k = keyFn(p);
      if (!m.has(k)) m.set(k, {
        key: k, total: 0, done: 0, active: 0, delayed: 0, held: 0, returned: 0,
        mdContract: 0, mdPlanPaid: 0, mdInPaid: 0
      });
      const s = m.get(k);
      s.total++;
      if (p.status === '완료') s.done++;
      if (p.status === '지연') s.delayed++;
      if (p.status === '보류') s.held++;
      if (p.status === '반품') s.returned++;
      if (p.isActive) s.active++;
      s.mdContract += p.mdContract;
      s.mdPlanPaid += p.mdPlanPaid;
      s.mdInPaid += p.mdInPaid;
    });
    return [...m.values()].map(s => ({
      ...s,
      doneRate: s.total > 0 ? s.done / s.total * 100 : 0,
      productivity: s.mdInPaid > 0 ? s.mdContract / s.mdInPaid * 100 : null
    })).sort((a, b) => b.total - a.total);
  }

  /* ── 데이터셋 빌드 ───────────────────────────────────────────── */
  function build(raw) {
    const rows = raw.map(normalizeRow);
    return {
      rows,
      CODE,
      assignees: buildAssigneeStats(rows),
      pms: buildPMStats(rows),
      monthly: buildMonthly(rows),
      byMethod: groupBy(rows, p => p.method),
      byUnit: groupBy(rows, p => p.unit),
      byServer: groupBy(rows, p => p.serverType),
      byPjtType: groupBy(rows, p => p.pjtType),
      groupBy,
      meta: {
        count: rows.length,
        firstReceipt: rows.reduce((a, p) => (!a || (p.receiptDate && p.receiptDate < a)) ? p.receiptDate : a, ''),
        lastReceipt: rows.reduce((a, p) => (p.receiptDate > a ? p.receiptDate : a), ''),
      }
    };
  }

  return { build, normalizeRow, parseAssignees, groupBy, CODE };
})();
