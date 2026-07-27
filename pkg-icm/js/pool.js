/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 구축인력풀 편집 계층

   ①가용판정규칙을 브라우저에서 재현하여, 인력 추가·수정·상태 변경 시
   가용 판정과 CAPA 집계를 즉시 재계산한다.
   (etl_gcms.py judge_person() / load_capa() 의 JS 포트)

   저장 : localStorage — 원본은 건드리지 않고 변경분(추가·수정·삭제)만 보관
   ══════════════════════════════════════════════════════════════════ */
const POOL = (() => {

  const EXCLUDE_KINDS = ['인턴'];                 // 규칙 ⑲ 집계 제외 그룹
  const GRADES = ['유닛장', '부장', '차장', '과장', '대리', '사원', '인턴'];
  const KINDS = ['정규구축', '전환배치', '인턴'];
  const CENTERS = ['1센터', '2센터', '3센터'];
  const REGION_OF = { '1센터': '서울/수도권', '2센터': '중부/호남', '3센터': '부산/대구' };
  const STATUSES = ['가용', '평가중', '비가용', '구축제외'];
  const CAPA_COEF = 22.0;

  const S = v => (v === null || v === undefined) ? '' : String(v).trim();
  const addMonths = (iso, m) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + Math.round(m * 30.44));
    return d;
  };

  /* ── ①가용판정규칙 — 우선순위 판정 ─────────────────────────── */
  function judge(p, asOf, evalMonths = 1) {
    if (p.statusOverride) return p.statusOverride;      // 수동 지정이 최우선
    if (!p.isBuild) return '구축제외';                    // ① 구축직무=N
    if (EXCLUDE_KINDS.includes(S(p.kind))) return '구축제외';
    if (S(p.unavailReason)) return '비가용';              // ② 비가용사유 보유
    if (S(p.kind) === '전환배치') {                       // ③ 평가중
      if (S(p.evalDone) === '평가중') return '평가중';
      if (p.placeDate && new Date(asOf) < addMonths(p.placeDate, evalMonths)) return '평가중';
    }
    return '가용';                                       // ④ 그 외
  }

  /* ── 집계 — capaMeta 와 동일 형태 ───────────────────────────── */
  function aggregate(people, opts = {}) {
    const asOf = opts.asOf, evalMonths = opts.evalMonths ?? 1;
    const coef = opts.capaCoef ?? CAPA_COEF;
    const list = people.map(p => ({ ...p, status: judge(p, asOf, evalMonths) }));

    const cnt = {};
    STATUSES.forEach(s => cnt[s] = list.filter(p => p.status === s).length);
    const centers = [...new Set(list.map(p => p.center).filter(Boolean))].sort();

    const byCenter = centers.map(c => {
      const sub = list.filter(p => p.center === c);
      const sc = k => sub.filter(p => p.status === k).length;
      return {
        center: c, region: (sub[0] && sub[0].region) || REGION_OF[c] || '',
        total: sub.length, excluded: sc('구축제외'), unavailable: sc('비가용'),
        evaluating: sc('평가중'), available: sc('가용'),
        rate: sub.length ? Math.round(sc('가용') / sub.length * 1000) / 10 : 0,
      };
    });

    const byGrade = GRADES.filter(g => list.some(p => p.grade === g)).map(g => {
      const sub = list.filter(p => p.grade === g);
      return {
        grade: g, total: sub.length,
        available: sub.filter(p => p.status === '가용').length,
        byCenter: Object.fromEntries(centers.map(c =>
          [c, sub.filter(p => p.center === c && p.status === '가용').length])),
      };
    });

    const reasons = {};
    list.forEach(p => { if (S(p.unavailReason)) reasons[p.unavailReason] = (reasons[p.unavailReason] || 0) + 1; });

    return {
      asOf, evalMonths, capaCoef: coef,
      total: list.length, status: cnt, available: cnt['가용'],
      capa: Math.round(cnt['가용'] * coef),
      byCenter, byGrade, centers, reasons,
      edited: list.filter(p => p._added || p._edited || p.statusOverride).length,
      list,
    };
  }

  /* ── 저장소 — 변경분만 보관 ─────────────────────────────────── */
  const KEY = 'pkg-icm.pool.v1';
  let mem = null;
  const empty = () => ({ added: [], edits: {}, removed: [] });

  function load() {
    if (mem) return mem;
    try { mem = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { mem = empty(); }
    return mem;
  }
  function save(st) {
    mem = st;
    try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch { return false; }
  }
  function reset() { mem = empty(); try { localStorage.removeItem(KEY); } catch { } }

  /** 원본 + 변경분 → 최종 인력 목록 */
  function merge(base) {
    const st = load();
    const out = [];
    base.forEach(p => {
      if (st.removed.includes(p.name)) return;
      const e = st.edits[p.name];
      out.push(e ? { ...p, ...e, _edited: true } : { ...p });
    });
    st.added.forEach(p => {
      if (st.removed.includes(p.name)) return;
      out.push({ ...p, _added: true });
    });
    return out;
  }

  /* ── 변경 조작 ──────────────────────────────────────────────── */
  function upsert(person, isNew) {
    const st = load();
    if (isNew) {
      const i = st.added.findIndex(p => p.name === person.name);
      if (i >= 0) st.added[i] = person; else st.added.push(person);
    } else {
      const i = st.added.findIndex(p => p.name === person.name);
      if (i >= 0) st.added[i] = person;              // 추가된 인력의 수정
      else st.edits[person.name] = person;           // 원본 인력의 수정분
    }
    st.removed = st.removed.filter(n => n !== person.name);
    return save(st);
  }
  function setStatus(name, status) {
    const st = load();
    const i = st.added.findIndex(p => p.name === name);
    if (i >= 0) st.added[i].statusOverride = status || undefined;
    else st.edits[name] = { ...(st.edits[name] || {}), statusOverride: status || undefined };
    if (!status && st.edits[name]) delete st.edits[name].statusOverride;
    return save(st);
  }
  function remove(name) {
    const st = load();
    st.added = st.added.filter(p => p.name !== name);
    delete st.edits[name];
    if (!st.removed.includes(name)) st.removed.push(name);
    return save(st);
  }
  function restore(name) {
    const st = load();
    st.removed = st.removed.filter(n => n !== name);
    delete st.edits[name];
    return save(st);
  }
  const changeCount = () => {
    const st = load();
    return st.added.length + Object.keys(st.edits).length + st.removed.length;
  };

  /** 신규 인력 기본값 */
  const blank = () => ({
    name: '', grade: '사원', kind: '정규구축', center: '1센터', region: '서울/수도권',
    module: '', career: 0, joinDate: null, placeDate: null,
    isBuild: true, unavailReason: '', availFrom: null, evalDone: '',
    statusOverride: undefined,
  });

  return {
    judge, aggregate, merge, upsert, setStatus, remove, restore, reset,
    load, save, changeCount, blank,
    GRADES, KINDS, CENTERS, REGION_OF, STATUSES, CAPA_COEF,
  };
})();
