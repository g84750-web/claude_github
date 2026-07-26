/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 앱 셸 / 라우터
   ══════════════════════════════════════════════════════════════════ */
const APP = (() => {

  const TABS = [
    { id: 'exec',    label: '📊 Executive',      render: (D, K) => VIEWS.renderExec(D, K) },
    { id: 'book',    label: '📐 KPI Definition Book', render: (D, K) => VIEWS.renderBook(D, K) },
    { id: 'project', label: '📋 PROJECT 등록',    render: D => VIEWS.renderProjectShell(D), once: true },
    { id: 'status',  label: '📈 접수·완료 현황',  render: D => VIEWS.renderStatus(D), once: true },
    { id: 'capa',    label: '👥 공수현황(개인)',  render: D => VIEWS.renderCapa(D), once: true },
    { id: 'bench',   label: '🎯 EQT Benchmark',   render: (D, K) => VIEWS.renderBench(D, K), once: true },
  ];

  const S = { D: null, K: null, drawn: new Set(), current: 'exec' };

  /* ── 탭 전환 ─────────────────────────────────────────────────── */
  function go(id) {
    const t = TABS.find(x => x.id === id);
    if (!t) return;
    S.current = id;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + id));
    if (!t.once || !S.drawn.has(id)) {
      t.render(S.D, S.K);
      S.drawn.add(id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── 데이터 로드 ─────────────────────────────────────────────── */
  async function loadRaw() {
    // standalone 빌드 시 데이터가 HTML에 내장됨
    if (window.__GCMS_DATA__) return window.__GCMS_DATA__;
    const res = await fetch('data/gcms_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status} — data/gcms_data.json`);
    return res.json();
  }

  /* ── 부팅 ────────────────────────────────────────────────────── */
  async function boot() {
    const nav = document.getElementById('nav');
    nav.innerHTML = TABS.map((t, i) =>
      `<button class="nav-btn ${i === 0 ? 'active' : ''}" data-tab="${t.id}" onclick="APP.go('${t.id}')">${t.label}</button>`
    ).join('');

    try {
      const raw = await loadRaw();
      S.D = DATA.build(raw);
      S.K = KPI.computeAll(S.D);

      const s = KPI.summary(S.K);
      document.getElementById('meta').innerHTML = `
        <span class="chip live">● GCMS 연동</span>
        <span class="chip">${S.D.meta.count.toLocaleString()}건</span>
        <span class="chip">KPI ${s.total}개 (산출 ${s.auto + s.proxy})</span>
        <span class="chip">${S.D.meta.lastReceipt} 기준</span>`;

      document.getElementById('foot-info').textContent =
        `총 ${S.D.meta.count.toLocaleString()}개 프로젝트 · 구축인력 ${S.D.assignees.length}명 · ` +
        `데이터 기간 ${S.D.meta.firstReceipt} ~ ${S.D.meta.lastReceipt}`;

      go('exec');
    } catch (e) {
      document.getElementById('boot').innerHTML = `
        <div class="err">
          <b>데이터를 불러오지 못했습니다</b>
          ${escapeHtml(e.message)}<br><br>
          브라우저에서 파일을 직접 열면(<code>file://</code>) 보안 정책으로 JSON을 읽을 수 없습니다.<br>
          아래 중 <b>하나</b>를 사용하세요.<br><br>
          <b>① 웹서버 없이 실행</b> — <code>index_standalone.html</code> 파일을 더블클릭<br>
          <b>② 웹서버로 실행</b> — 이 폴더에서 <code>python -m http.server 8080</code> 실행 후
          <code>http://localhost:8080</code> 접속
        </div>`;
      console.error(e);
    }
  }

  const escapeHtml = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  document.addEventListener('DOMContentLoaded', boot);

  return {
    go,
    get D() { return S.D; },
    get K() { return S.K; },
  };
})();
