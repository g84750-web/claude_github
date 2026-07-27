/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 데이터 계층
   원천 : GCMS A10(통합)구축진행현황 (etl_gcms.py 산출물)
   산식 : PKG 주간보고 작업지침 v2 §1-3 계약공수 기준 공수 산정 (확정 정책)
   ══════════════════════════════════════════════════════════════════ */
const DATA = (() => {

  const CODE = {
    STATUS: ['진행', '완료', '지연', '보류', '반품'],
    METHOD: ['방문구축', 'FoEX교육(1:N)', 'FoEX교육(1:N)+방문', 'FoEX교육(단독)'],
    SERVER: ['SaaS', '구축형'],
    DLV: ['조기', '정시', '30일내', '1M초과', '2M초과', '3M초과'],
    CENTER: ['1센터(서울/수도권)', '2센터(중부/호남권)', '3센터(부산/영남권)'],
  };
  const ACTIVE = ['진행', '지연'];              // 현진행 = 진행 + 지연
  const FOEX_FAMILY = ['FoEX교육(1:N)', 'FoEX교육(1:N)+방문'];
  const FREE_COEF = 0.30;

  const day = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 86400000) : null;

  /* ── 그룹 집계 ───────────────────────────────────────────────── */
  function groupBy(rows, keyFn) {
    const m = new Map();
    rows.forEach(p => {
      const k = keyFn(p) || '미지정';
      if (!m.has(k)) m.set(k, {
        key: k, total: 0, done: 0, active: 0, delayed: 0, held: 0, returned: 0,
        mdContract: 0, mdPlan: 0, mdUsed: 0, mdPaidUn: 0, mdFreeUn1: 0, mdFinalUn: 0,
        amount: 0, doneAmount: 0, dlvKeep: 0, dlvJudged: 0
      });
      const s = m.get(k);
      s.total++;
      if (p.status === '완료') { s.done++; s.doneAmount += p.orderAmt || 0; }
      if (p.status === '지연') s.delayed++;
      if (p.status === '보류') s.held++;
      if (p.status === '반품') s.returned++;
      if (p.isActive) s.active++;
      s.amount += p.orderAmt || 0;
      s.mdContract += p.mdContract || 0;
      s.mdPlan += p.mdPlan || 0;
      s.mdUsed += p.mdUsed || 0;
      s.mdPaidUn += p.mdPaidUn || 0;
      s.mdFreeUn1 += p.mdFreeUn1 || 0;
      s.mdFinalUn += p.mdFinalUn || 0;
      if (p.dlvBucket) {
        s.dlvJudged++;
        if (['조기', '정시', '30일내'].includes(p.dlvBucket)) s.dlvKeep++;
      }
    });
    return [...m.values()].map(s => ({
      ...s,
      doneRate: s.total > 0 ? s.done / s.total * 100 : 0,
      dlvRate: s.dlvJudged > 0 ? s.dlvKeep / s.dlvJudged * 100 : null,
      unRate: s.mdContract > 0 ? s.mdFinalUn / s.mdContract * 100 : null,
      avgAmount: s.done > 0 ? s.doneAmount / s.done / 1e6 : null,
    })).sort((a, b) => b.total - a.total);
  }

  /* ── 담당자(구축자) 집계 — 화면정의서 slide21 ────────────────── */
  function buildAssignees(arows, projByCode) {
    if (!arows || !arows.length) return [];
    const m = new Map();
    arows.forEach(a => {
      if (!m.has(a.person)) m.set(a.person, {
        name: a.person, rows: 0, projects: new Set(), active: 0, done: 0,
        mdPlan: 0, mdUsed: 0, mdUn: 0, mdAdd: 0, mdMig: 0, mdOut: 0,
        modules: new Map(), units: new Set(), lastDate: ''
      });
      const s = m.get(a.person);
      s.rows++;
      s.projects.add(a.code);
      if (ACTIVE.includes(a.status)) s.active++;
      if (a.status === '완료') s.done++;
      s.mdPlan += a.mdPlan || 0;
      s.mdUsed += a.mdUsed || 0;
      s.mdUn += a.mdUn || 0;
      s.mdAdd += a.mdAdd || 0;
      s.mdMig += a.mdMig || 0;
      s.mdOut += a.mdOut || 0;
      if (a.unit) s.units.add(a.unit);
      if (a.module) s.modules.set(a.module, (s.modules.get(a.module) || 0) + 1);
      if (a.lastDate && a.lastDate > s.lastDate) s.lastDate = a.lastDate;
    });
    return [...m.values()].map(s => ({
      ...s,
      projectCnt: s.projects.size,
      mdTotal: s.mdUsed + s.mdAdd + s.mdMig + s.mdOut,
      topModules: [...s.modules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      unitList: [...s.units].join(', '),
    })).sort((a, b) => b.rows - a.rows);
  }

  /* ── PM 집계 ─────────────────────────────────────────────────── */
  function buildPMs(rows) {
    const g = groupBy(rows, p => p.pm);
    return g.map(s => ({ ...s, name: s.key }));
  }

  /* ── 월별 시계열 ─────────────────────────────────────────────── */
  function buildMonthly(rows, asOf) {
    const m = new Map();
    const touch = ym => {
      if (!m.has(ym)) m.set(ym, { ym, received: 0, completed: 0, returned: 0 });
      return m.get(ym);
    };
    rows.forEach(p => {
      if (p.recvYM) touch(p.recvYM).received++;
      if (p.status === '완료' && p.doneYM) touch(p.doneYM).completed++;
      if (p.status === '반품' && p.doneYM) touch(p.doneYM).returned++;
    });
    const bound = (asOf || '').slice(0, 7);
    const list = [...m.values()].filter(x => !bound || x.ym <= bound)
      .sort((a, b) => a.ym.localeCompare(b.ym));
    let cr = 0, cc = 0, cx = 0;
    list.forEach(r => {
      cr += r.received; cc += r.completed; cx += r.returned;
      r.wip = cr - cc - cx;
    });
    return list;
  }

  /* ── 데이터셋 빌드 ───────────────────────────────────────────── */
  function build(payload) {
    // 신형식 {meta, rows, assignees} / 구형식 [ ... ] 모두 수용
    const isNew = payload && !Array.isArray(payload) && payload.rows;
    const meta = isNew ? payload.meta : {};
    const src = isNew ? payload.rows : payload;
    const asOf = meta.asOf || '';

    const rows = src.map(r => ({
      ...r,
      isActive: ACTIVE.includes(r.status),
      isFoEX: (r.method || '').startsWith('FoEX'),
      isFoEXFamily: FOEX_FAMILY.includes(r.method),
      isPureFoEX: r.method === 'FoEX교육(단독)' || r.method === 'FoEX교육(1:N)',
      recvYM: (r.recvDate || '').slice(0, 7),
      recvYear: (r.recvDate || '').slice(0, 4),
      doneYM: (r.doneDate || '').slice(0, 7),
      // TTV(개통 소요기간) = 구축접수일 → 구축완료일
      //   ※ 수주일 기준으로 구축접수가 이루어지지 않으므로 수주일을 기산점으로 쓰지 않는다.
      //     수주일 기산은 영업 리드타임이 섞여 구축 소요기간이 과대 계상된다.
      leadTime: day(r.recvDate, r.doneDate),
      salesLead: day(r.orderDate, r.recvDate),   // 참고: 수주 → 구축접수 (영업 리드타임)
      mdRemain: (r.mdPlan || 0) - (r.mdUsed || 0),
      progress: r.mdPlan > 0 ? Math.min(100, (r.mdUsed || 0) / r.mdPlan * 100) : 0,
    }));

    const byCode = new Map(rows.map(p => [p.code, p]));
    const active = rows.filter(p => p.isActive);

    // 프로젝트별 배정 인덱스 — 화면정의서 [배정정보]·[투입정보] 탭 원천
    const assignByCode = new Map();
    (payload.assignees || []).forEach(a => {
      if (!assignByCode.has(a.code)) assignByCode.set(a.code, []);
      assignByCode.get(a.code).push(a);
    });

    const dates = rows.map(p => p.recvDate).filter(Boolean).sort();

    return {
      meta, asOf, rows, active, CODE, ACTIVE, FREE_COEF, groupBy, byCode, assignByCode,
      firstRecv: dates[0] || '', lastRecv: dates[dates.length - 1] || '',
      rawAssignees: payload.assignees || [],
      assignees: buildAssignees(payload.assignees, byCode),
      // WBS(배정) 집계 — 화면정의서 [배정등록]·[투입실적등록] 기준
      wbs: (() => {
        const ar = payload.assignees || [];
        const agg = sel => {
          const S = k => sel.reduce((a, x) => a + (x[k] || 0), 0);
          const plan = S('mdPlan'), used = S('mdUsed');
          const net = used + S('mdAdd') + S('mdMig') + S('mdOut');
          return {
            n: sel.length, plan, used, net, un: S('mdUn'),
            add: S('mdAdd'), mig: S('mdMig'), out: S('mdOut'),
            rate: plan > 0 ? net / plan * 100 : null,          // 순공수 기준
            usedRate: plan > 0 ? used / plan * 100 : null,      // 본투입 기준
            fulfilled: sel.filter(x => (x.mdUn || 0) <= 0).length,
          };
        };
        const act = ar.filter(r => ACTIVE.includes(r.status));
        const fin = ar.filter(r => r.status === '완료');
        return {
          all: agg(ar), active: agg(act), done: agg(fin),
          people: new Set(ar.map(r => r.person)).size,
          activePeople: new Set(act.map(r => r.person)).size,
          projects: new Set(ar.map(r => r.code)).size,
        };
      })(),
      assigneeMeta: meta.assigneeMeta || null,
      // 구축인력풀 (CAPA 인력마스터)
      people: payload.people || [],
      capaMeta: meta.capaMeta || null,
      pms: buildPMs(rows),
      monthly: buildMonthly(rows, asOf),
      byMethod: groupBy(rows, p => p.method),
      byUnit: groupBy(rows, p => p.unit),
      byCenter: groupBy(rows, p => p.center),
      byServer: groupBy(rows, p => p.server),
      byPjtType: groupBy(rows, p => p.pjtType),
      byUpsell: groupBy(rows, p => p.upsell),
      byModule: groupBy(rows, p => p.module),
      byRegion: groupBy(rows, p => p.regionGrp),
      activeByMethod: groupBy(active, p => p.method),
      stat: {
        total: rows.length,
        done: rows.filter(p => p.status === '완료').length,
        active: active.length,
        capa: meta.capa || 0,
        headcount: meta.headcount || 0,
      },
    };
  }

  return { build, groupBy, CODE, ACTIVE, FREE_COEF };
})();
