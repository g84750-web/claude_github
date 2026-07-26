/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 화면 렌더러
   화면 근거: NSM 개발 화면정의서 V2.0 + ERP 관리지표 가이드라인 v1.0
   ══════════════════════════════════════════════════════════════════ */
const VIEWS = (() => {

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(1);
  const f0 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : Math.round(v).toLocaleString();
  const nz = (v, alt = '—') => (v === null || v === undefined || v === '') ? alt : v;
  const PACC = n => `--pbg:var(--p${n}-bg);--pacc:var(--p${n}-acc);--pmid:var(--p${n}-mid)`;
  const ST_LABEL = { auto: '자동산출', proxy: '대체산출', pending: '연동 필요' };

  /* ════════════════════════════════════════════════════════════
     1. Executive Dashboard — 가이드라인 §2 6대 핵심 KPI
     ════════════════════════════════════════════════════════════ */
  function renderExec(D, K) {
    const cards = KPI.EXEC.map((id, i) => {
      const k = K.get(id); if (!k) return '';
      const acc = `var(--p${k.pillar}-acc)`;
      const r = k.result;
      const prog = (k.targetVal !== undefined && r.v !== null && isFinite(r.v))
        ? Math.max(0, Math.min(100, k.op === 'lte'
            ? (r.v <= 0 ? 100 : Math.min(100, k.targetVal / r.v * 100))
            : r.v / k.targetVal * 100))
        : 0;
      return `<div class="exec-card" style="--acc:${acc}">
        <div class="k-name">${esc(k.name)}</div>
        <div class="k-val">${r.v !== null && isFinite(r.v) ? esc(r.disp) : `<span style="font-size:.95rem;color:var(--tx-m)">${esc(r.disp)}</span>`}</div>
        <div class="k-meta">${esc(r.sub || k.def.slice(0, 34))}</div>
        <div class="bar"><i style="width:${prog}%"></i></div>
        <div class="k-target">
          <span>목표 ${k.op === 'lte' ? '≤' : '≥'} ${k.targetVal ?? '—'}${k.unit || ''}</span>
          <span class="judge ${k.judge.cls}">${k.judge.txt}</span>
        </div>
      </div>`;
    }).join('');

    const s = KPI.summary(K);
    const act = D.rows.filter(p => p.isActive).length;
    const done = D.rows.filter(p => p.status === '완료').length;

    $('v-exec').innerHTML = `
      <div class="sec-head">
        <h2>Executive Dashboard</h2>
        <span class="sub">사업본부장·PM총괄 단일 화면 — 관리지표 가이드라인 v1.0 §2 6대 핵심 KPI</span>
      </div>
      <div class="exec-grid">${cards}</div>

      <div class="g3">
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">KPI 산출 커버리지</h2></div>
          ${bar2('자동 산출 (GCMS 현행)', s.auto, s.total, 'var(--ok)')}
          ${bar2('대체 산출 (원천 일부 부재)', s.proxy, s.total, 'var(--warn)')}
          ${bar2('연동 필요 (Phase 1~3)', s.pending, s.total, 'var(--idle)')}
          <div style="margin-top:.8rem;padding-top:.7rem;border-top:1px dashed var(--bd-light);font-size:.74rem;color:var(--tx-s)">
            총 <b style="color:var(--tx-h)">${s.total}개</b> KPI 중
            <b style="color:var(--ok)">${s.auto + s.proxy}개</b> 현행 데이터로 산출 중
          </div>
        </div>
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">구축 진행 현황</h2></div>
          ${D.groupBy(D.rows, p => p.status).map(g =>
            bar2(g.key, g.total, D.rows.length, statusColor(g.key))).join('')}
        </div>
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">핵심 요약</h2></div>
          <div class="fld-grid" style="grid-template-columns:1fr 1fr">
            ${fld('총 접수', D.rows.length.toLocaleString() + '건')}
            ${fld('완료', done.toLocaleString() + '건')}
            ${fld('진행 중', act.toLocaleString() + '건')}
            ${fld('구축 인력', D.assignees.length + '명')}
            ${fld('활성 PM', new Set(D.rows.filter(p => p.isActive).map(p => p.pm)).size + '명')}
            ${fld('데이터 기간', `${D.meta.firstReceipt} ~ ${D.meta.lastReceipt}`)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="sec-head">
          <h2 style="font-size:.9rem">월별 접수 · 완료 · 재공(WIP) 추이</h2>
          <span class="sub">KPI 1.3 재공 처리 속도 산출 기반 · 접수 마지막 월까지 표시</span>
        </div>
        ${monthlyChart(D.monthly.filter(m => m.ym <= D.meta.lastReceipt.slice(0, 7)).slice(-14))}
      </div>`;
  }

  const statusColor = s => ({ '완료': 'var(--ok)', '진행': 'var(--info)', '지연': 'var(--risk)', '보류': 'var(--warn)', '반품': '#A855F7' }[s] || 'var(--idle)');

  function bar2(label, n, d, color) {
    const p = d > 0 ? n / d * 100 : 0;
    return `<div class="rank">
      <div class="rh"><span class="n">${esc(label)}</span><span class="s">${n.toLocaleString()}건 · ${f1(p)}%</span></div>
      <div class="bar"><i style="width:${p}%;background:${color}"></i></div>
    </div>`;
  }
  const fld = (l, v, na) => `<div class="fld"><div class="l">${esc(l)}</div><div class="v ${na ? 'na' : ''}">${esc(v)}</div></div>`;

  function monthlyChart(ms) {
    if (!ms.length) return '<p style="color:var(--tx-m)">데이터 없음</p>';
    const max = Math.max(...ms.map(m => Math.max(m.received, m.completed))) || 1;
    return `<div class="chart">${ms.map(m => `
      <div class="col" title="${m.ym} · 접수 ${m.received}건 / 완료 ${m.completed}건 / 재공(WIP) ${m.wip}건">
        <div class="v">${m.received}</div>
        <div class="bars">
          <div class="b" style="height:${(m.received / max * 100).toFixed(1)}%"></div>
          <div class="b done" style="height:${(m.completed / max * 100).toFixed(1)}%"></div>
        </div>
        <div class="l">${m.ym.slice(2)}</div>
      </div>`).join('')}</div>
      <div class="chart-legend">
        <span><i style="background:#3B4FC8"></i>접수</span>
        <span><i style="background:#16A34A"></i>완료</span>
        <span style="color:var(--tx-m);font-weight:500">※ 막대에 마우스를 올리면 재공(WIP) 잔여건이 표시됩니다</span>
      </div>`;
  }

  /* ════════════════════════════════════════════════════════════
     2. KPI Definition Book — 7 Pillar 전체
     ════════════════════════════════════════════════════════════ */
  function renderBook(D, K) {
    const s = KPI.summary(K);
    const pillars = KPI.PILLARS.map(P => {
      const items = KPI.LIST.filter(k => k.pillar === P.no).map(k => kpiCard(K.get(k.id))).join('');
      const cnt = KPI.LIST.filter(k => k.pillar === P.no).length;
      return `<div class="pillar" style="${PACC(P.no)}">
        <div class="pillar-head">
          <div class="no">${P.no}</div>
          <h3>${esc(P.ko)}</h3>
          <span class="en">${esc(P.name)}</span>
          <span class="spacer"></span>
          <span class="chip" style="background:var(--pacc);color:#fff;border:none">KPI ${cnt}개</span>
          <div class="desc">${esc(P.desc)}</div>
        </div>
        <div class="pillar-body">${items}</div>
      </div>`;
    }).join('');

    $('v-book').innerHTML = `
      <div class="sec-head">
        <h2>KPI Definition Book</h2>
        <span class="sub">PKG사업본부 A10 구축업무 ERP 관리지표 가이드라인 v1.0 — 7 Pillar ${s.total}개 KPI</span>
        <span class="spacer"></span>
        <span class="st auto">자동산출 ${s.auto}</span>
        <span class="st proxy">대체산출 ${s.proxy}</span>
        <span class="st pending">연동필요 ${s.pending}</span>
      </div>
      <div class="card" style="margin-bottom:1.2rem;background:#F8FAFF;border-color:#C7D2FE">
        <div style="font-size:.78rem;line-height:1.85;color:var(--tx-b)">
          <b style="color:var(--tx-h)">5대 공식 표준화 원칙</b> —
          ① 모든 비율 KPI는 분자·분모·기간을 명시 &nbsp;·&nbsp;
          ② SSOT 단일 원천 (GCMS &gt; NSM10 &gt; ERP) &nbsp;·&nbsp;
          ③ Snapshot vs Period 시점 기준 통일 &nbsp;·&nbsp;
          ④ 구축방식·서버유형별 보정 &nbsp;·&nbsp;
          ⑤ EQT Top-quartile 절대 기준 적용
        </div>
      </div>
      ${pillars}`;
  }

  function kpiCard(k) {
    if (!k) return '';
    const r = k.result;
    const detail = (r.detail && r.detail.length)
      ? `<div style="margin-top:.55rem;padding-top:.5rem;border-top:1px dashed var(--bd-light)">
           ${r.detail.map(d => `<div class="kpi-row"><span class="lb">${esc(d.label)}</span><span class="vl">${esc(d.value)}</span></div>`).join('')}
         </div>` : '';
    return `<div class="kpi">
      <div class="kpi-top">
        <span class="kpi-id">${esc(k.id)}</span>
        <span class="kpi-name">${esc(k.name)} ${k.star ? '<span class="kpi-star">★</span>' : ''}</span>
        <span class="st ${k.state}">${ST_LABEL[k.state]}</span>
      </div>
      <div style="font-size:.73rem;color:var(--tx-s);line-height:1.6">${esc(k.def)}</div>
      <div class="kpi-formula">${esc(k.formula)}</div>
      <div class="kpi-row"><span class="lb">데이터 원천</span><span class="vl">${esc(k.source)}</span></div>
      <div class="kpi-row"><span class="lb">측정 주기</span><span class="vl">${esc(k.cycle)}</span></div>
      <div class="kpi-row"><span class="lb">관리 기준</span><span class="vl">${esc(k.target)}</span></div>
      <div class="kpi-row"><span class="lb">As-Is (가이드라인)</span><span class="vl">${esc(k.asIs || '—')}</span></div>
      ${detail}
      <div class="kpi-result">
        <div>
          <div style="font-size:.65rem;color:var(--tx-m);font-weight:800">GCMS 현행 산출값</div>
          <div class="now ${r.v === null || !isFinite(r.v) ? 'na' : ''}">${esc(r.disp)}</div>
          ${r.sub ? `<div style="font-size:.68rem;color:var(--tx-m);margin-top:.15rem">${esc(r.sub)}</div>` : ''}
        </div>
        <span class="judge ${k.judge.cls}">${k.judge.txt}</span>
      </div>
      ${k.note ? `<div class="kpi-note">${esc(k.note)}</div>` : ''}
    </div>`;
  }

  /* ════════════════════════════════════════════════════════════
     3. PROJECT 등록 — 화면정의서 slide6~14 마스터/디테일
     ════════════════════════════════════════════════════════════ */
  const PJ = { page: 1, size: 40, filtered: [], sel: null, tab: 'basic' };

  function renderProjectShell(D) {
    const opt = (arr, all = '전체') => `<option value="">${all}</option>` + arr.map(v => `<option>${esc(v)}</option>`).join('');
    $('v-project').innerHTML = `
      <div class="sec-head">
        <h2>PROJECT 등록</h2>
        <span class="sub">NSM 화면정의서 V2.0 — 헤더/디테일 구조 (기본·구축·공수·빌링·배정·투입·서버·특이사항)</span>
      </div>
      <div class="filters">
        <div class="f-grid">
          <div class="fg"><label>검색 (고객사·프로젝트코드·PM)</label><input class="ctl" id="pj-q" placeholder="검색어 입력"></div>
          <div class="fg"><label>구축상태</label><select class="ctl" id="pj-st">${opt(D.CODE.STATUS)}</select></div>
          <div class="fg"><label>구축부서</label><select class="ctl" id="pj-dept">${opt([...new Set(D.rows.map(p => p.unit))].sort())}</select></div>
          <div class="fg"><label>구축구분</label><select class="ctl" id="pj-mt">${opt([...new Set(D.rows.map(p => p.method))].sort())}</select></div>
          <div class="fg"><label>제품구분</label><select class="ctl" id="pj-pt">${opt([...new Set(D.rows.map(p => p.productType))].sort())}</select></div>
          <div class="fg"><label>구축접수일 FROM</label><input class="ctl" id="pj-f" type="date"></div>
          <div class="fg"><label>구축접수일 TO</label><input class="ctl" id="pj-t" type="date"></div>
        </div>
        <div class="f-info" id="pj-info"></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="md-master tbl-wrap" style="border:none;border-radius:0">
          <table>
            <thead><tr>
              <th>프로젝트코드</th><th>거래처명</th><th>PM</th><th>구축부서</th><th>진행상태</th>
              <th>구축구분</th><th>제품형태</th><th class="num">계약공수</th><th class="num">투입(유)</th>
              <th class="num">진행률</th><th>접수일</th><th>완료예정일</th>
            </tr></thead>
            <tbody id="pj-body"></tbody>
          </table>
        </div>
        <div class="pager" id="pj-pager"></div>
      </div>
      <div class="card" id="pj-detail" style="margin-top:1rem"></div>`;

    ['pj-q', 'pj-st', 'pj-dept', 'pj-mt', 'pj-pt', 'pj-f', 'pj-t'].forEach(id => {
      const el = $(id);
      el.addEventListener('input', () => { PJ.page = 1; applyPJ(D); });
      el.addEventListener('change', () => { PJ.page = 1; applyPJ(D); });
    });
    applyPJ(D);
  }

  function applyPJ(D) {
    const q = $('pj-q').value.trim().toLowerCase();
    const st = $('pj-st').value, dept = $('pj-dept').value, mt = $('pj-mt').value, pt = $('pj-pt').value;
    const from = $('pj-f').value, to = $('pj-t').value;
    PJ.filtered = D.rows.filter(p => {
      if (q && !(p.projectCode?.toLowerCase().includes(q) || p.customer?.toLowerCase().includes(q) || p.pm?.toLowerCase().includes(q))) return false;
      if (st && p.status !== st) return false;
      if (dept && p.unit !== dept) return false;
      if (mt && p.method !== mt) return false;
      if (pt && p.productType !== pt) return false;
      if (from && p.receiptDate < from) return false;
      if (to && p.receiptDate > to) return false;
      return true;
    });
    drawPJ(D);
  }

  function drawPJ(D) {
    const tot = PJ.filtered.length, pages = Math.max(1, Math.ceil(tot / PJ.size));
    PJ.page = Math.min(PJ.page, pages);
    const rows = PJ.filtered.slice((PJ.page - 1) * PJ.size, PJ.page * PJ.size);
    const sumC = PJ.filtered.reduce((a, p) => a + p.mdContract, 0);
    const sumI = PJ.filtered.reduce((a, p) => a + p.mdInPaid, 0);

    $('pj-info').innerHTML = `
      <span>검색결과 <b style="color:var(--tx-h)">${tot.toLocaleString()}</b>건</span>
      <span>계약공수 <b style="color:var(--tx-h)">${f0(sumC)}</b> MD</span>
      <span>투입공수(유) <b style="color:var(--tx-h)">${f0(sumI)}</b> MD</span>
      <span>잔여 <b style="color:var(--warn)">${f0(PJ.filtered.reduce((a, p) => a + p.mdRemain, 0))}</b> MD</span>
      <span>${PJ.page} / ${pages} 페이지</span>`;

    $('pj-body').innerHTML = rows.map(p => `
      <tr onclick="VIEWS.selectPJ(${p.no})" class="${PJ.sel === p.no ? 'sel' : ''}" style="cursor:pointer">
        <td class="mono strong">${esc(p.projectCode)}</td>
        <td>${esc(p.customer)}</td>
        <td>${esc(p.pm)}</td>
        <td style="color:var(--tx-s)">${esc(p.unit)}</td>
        <td><span class="bdg ${esc(p.status)}">${esc(p.status)}</span></td>
        <td style="font-size:.72rem;color:var(--tx-s)">${esc(p.method)}</td>
        <td style="font-size:.72rem">${esc(p.serverType)}</td>
        <td class="num">${p.mdContract}</td>
        <td class="num">${p.mdInPaid}</td>
        <td class="num strong" style="color:${p.progress >= 100 ? 'var(--ok)' : 'var(--info)'}">${f1(p.progress)}%</td>
        <td class="mono" style="font-size:.7rem">${esc(p.receiptDate)}</td>
        <td class="mono" style="font-size:.7rem">${esc(p.dueDate)}</td>
      </tr>`).join('') || `<tr><td colspan="12" style="text-align:center;padding:2rem;color:var(--tx-m)">검색 결과가 없습니다.</td></tr>`;

    $('pj-pager').innerHTML = pager(pages, PJ.page, 'VIEWS.goPJ');
    if (PJ.sel === null && rows.length) selectPJ(rows[0].no);
    else if (PJ.sel !== null) drawDetail(D);
  }

  function pager(pages, cur, fn) {
    if (pages <= 1) return '';
    const b = [`<button class="pg" onclick="${fn}(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>◀</button>`];
    const s = Math.max(1, cur - 2), e = Math.min(pages, cur + 2);
    if (s > 1) b.push(`<button class="pg" onclick="${fn}(1)">1</button>`, s > 2 ? '<span style="color:var(--tx-m)">…</span>' : '');
    for (let i = s; i <= e; i++) b.push(`<button class="pg ${i === cur ? 'active' : ''}" onclick="${fn}(${i})">${i}</button>`);
    if (e < pages) b.push(e < pages - 1 ? '<span style="color:var(--tx-m)">…</span>' : '', `<button class="pg" onclick="${fn}(${pages})">${pages}</button>`);
    b.push(`<button class="pg" onclick="${fn}(${cur + 1})" ${cur === pages ? 'disabled' : ''}>▶</button>`);
    return b.join('');
  }

  function selectPJ(no) { PJ.sel = no; drawPJ(APP.D); }
  function goPJ(p) { PJ.page = p; drawPJ(APP.D); }
  function goTab(t) { PJ.tab = t; drawDetail(APP.D); }

  /* 디테일 — 화면정의서 9개 탭 */
  const DTABS = [
    ['basic', '기본정보'], ['build', '구축정보'], ['md', '공수정보'], ['assign', '배정정보'],
    ['input', '투입정보'], ['billing', '빌링정보'], ['order', '주문정보'], ['server', '서버정보'], ['memo', '특이사항']
  ];

  function drawDetail(D) {
    const p = D.rows.find(x => x.no === PJ.sel);
    const box = $('pj-detail'); if (!box) return;
    if (!p) { box.innerHTML = '<p style="color:var(--tx-m)">프로젝트를 선택하세요.</p>'; return; }

    box.innerHTML = `
      <div class="sec-head">
        <h2 style="font-size:.92rem">${esc(p.projectCode)}</h2>
        <span class="bdg ${esc(p.status)}">${esc(p.status)}</span>
        <span class="sub">${esc(p.customer)}</span>
      </div>
      <div class="detail-tabs">
        ${DTABS.map(([k, n]) => `<button class="dt-btn ${PJ.tab === k ? 'active' : ''}" onclick="VIEWS.goTab('${k}')">${n}</button>`).join('')}
      </div>
      <div>${detailPane(p, PJ.tab)}</div>`;
  }

  function detailPane(p, tab) {
    const P = {
      /* slide6 — 기본정보 */
      basic: () => `<div class="fld-grid">
        ${fld('프로젝트코드', p.projectCode)}${fld('거래처명', p.customer)}
        ${fld('PM', p.pm)}${fld('구축부서', p.dept)}
        ${fld('제품구분', p.productType)}${fld('프로젝트구분', p.pjtType)}
        ${fld('구축접수일', p.receiptDate)}${fld('구축상태', p.status)}
        ${fld('사업자등록번호', 'NSM10 연동 필요', true)}${fld('수주일', 'NSM10 연동 필요', true)}
        ${fld('수주그룹번호', 'NSM10 연동 필요', true)}${fld('전자결재타입', 'NSM10 연동 필요', true)}
      </div>`,
      /* slide7 — 구축정보 */
      build: () => `<div class="fld-grid">
        ${fld('구축부서', p.dept)}${fld('구축구분', p.method)}
        ${fld('제품형태(서버유형)', p.serverType)}${fld('구축완료예정일', p.dueDate)}
        ${fld('수행기간(대체 산출)', p.days !== null ? p.days + '일' : '—')}
        ${fld('구축지역', 'GCMS 코드 신설 필요', true)}${fld('설치완료일', 'GCMS 연동 필요', true)}
        ${fld('구축시작일', 'GCMS 연동 필요', true)}${fld('오픈완료일(증적)', 'GCMS 연동 필요', true)}
        ${fld('구축완료보고일', 'GCMS 연동 필요', true)}${fld('UC확장팩여부', 'GCMS 연동 필요', true)}
        ${fld('ONE AI 도입여부', 'GCMS 연동 필요', true)}${fld('마이그레이션여부', 'GCMS 연동 필요', true)}
        ${fld('보류처리일 / 해제일', 'GCMS 연동 필요', true)}${fld('업셀구분', 'NSM10 연동 필요', true)}
      </div>
      <div class="notimpl" style="margin-top:.9rem">
        <b>KPI 연계</b> — 이 탭의 &lt;구축지역&gt;·&lt;구축시작일&gt;·&lt;구축완료보고일&gt;·&lt;보류기간&gt; 필드는
        KPI 4.4(지역별 인력 효율)·5.1(TTV)·1.3(재공 처리 속도) 정합 산출의 원천입니다. 현재 대체값으로 근사 산출 중입니다.
      </div>`,
      /* slide8 — 공수정보 */
      md: () => `
        <div class="md-cards">
          ${mdc('c1', '계약공수', p.mdContract)}${mdc('c5', '예상공수(유)', p.mdPlanPaid)}
          ${mdc('c4', '예상공수(무)', p.mdPlanFree)}${mdc('c2', '투입공수(유)', p.mdInPaid)}
          ${mdc('c3', '잔여공수', p.mdRemain)}
        </div>
        <div class="fld-grid">
          ${fld('진행률', f1(p.progress) + '%')}
          ${fld('수행기간', p.days !== null ? p.days + '일' : '—')}
          ${fld('투입공수(무)', 'GCMS 공수구분 필드 필요', true)}
          ${fld('투입공수(기타)', 'GCMS 공수구분 필드 필요', true)}
        </div>
        <div class="notimpl" style="margin-top:.9rem">
          <b>화면정의서 계산식 적용</b>
          <div class="sch">예상공수(무) = 계약공수 − 예상공수(유)  →  ${p.mdContract} − ${p.mdPlanPaid} = ${p.mdPlanFree} MD
잔여공수     = 예상공수(유) − 투입공수(유)  →  ${p.mdPlanPaid} − ${p.mdInPaid} = ${p.mdRemain} MD
수행기간     = 일수[구축시작일~구축완료보고일] − 일수[보류처리일~보류해제일]
               ※ 원천 미보유 → 접수일~완료예정일 대체 산출</div>
        </div>`,
      /* slide11 — 배정정보 */
      assign: () => p.assignees.length ? `
        <div class="tbl-wrap"><table>
          <thead><tr><th>담당자</th><th>모듈</th><th class="num">배정 모듈수</th></tr></thead>
          <tbody>${p.assignees.map(a => `<tr>
            <td class="strong">${esc(a.name)}</td>
            <td style="color:var(--tx-s)">${esc(a.modules.join(', ') || '—')}</td>
            <td class="num">${a.modules.length}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="notimpl" style="margin-top:.9rem">
          <b>연동 필요 필드</b> — 화면정의서 [배정정보] 탭 기준
          <div class="sch">모듈 · 담당자 · 계약공수 · 예상공수(유/무) · 투입공수(유/무/기타) · 잔여공수 · 최근투입일자 · 상태 · 완료일자
적용 테이블: [배정등록] [담당자등록] [투입실적등록] [관리요소등록] [모듈별 기본공수등록]
※ 현재 GCMS는 담당자·모듈만 보유 → 담당자별 공수 배분 필드 신설 필요</div>
        </div>` : '<p style="color:var(--tx-m)">배정 정보가 없습니다.</p>',
      /* slide13 — 투입정보 */
      input: () => notimpl('투입정보', '[투입실적등록]',
        `투입일자 · 모듈 · 담당자 · 투입공수 · 공수구분(유/무/기타) · 선발행여부 · 회의록 · 교육확인서 · 비고
필수값: 투입일자 · 담당자 · 투입공수 · 방문구축 · 선발행여부
※ 교육확인서는 투입 건 다중 선택 등록 지원
KPI 연계: 2.4 매출 실현율(RR%) · 4.1 BU% · 3.3 방법론 준수율(MC%)`),
      /* slide9 — 빌링정보 */
      billing: () => notimpl('빌링정보', '[PROJECT등록] [투입실적등록] [빌링정보]',
        `총수주액 · 라이선스 · 라이선스발행액 · 라이선스미발행액 · 교육비 · 교육비발행액 · 교육비미발행액
계약공수 · 투입공수(유) · 잔여공수
계산식: 잔여공수 = 예상공수(유) − 투입공수(유)
버튼: 재경부서 처리내역 반영 → 라이선스발행액 · 교육비발행액 업데이트
KPI 연계: 1.2 금액 완료율 · 2.1 건당 평균 완료금액 · 2.2 GM%`),
      /* slide12 — 주문정보 */
      order: () => notimpl('주문정보', '[주문정보] [거래처등록]',
        `영업부서 주문승인건 조회·선택 → 주문정보 탭 저장
→ 빌링정보 탭 저장 · 기본정보 탭에 거래처코드/거래처명/사업자번호/수주일 저장
→ 제품구분 & 구축접수일에 따라 프로젝트코드 자동 생성
   Amaranth10 SaaS : PAS + 년도2 + 월2 + 일련번호3
   Amaranth10      : PAC + 년도2 + 월2 + 일련번호3
※ [수주적용] 재클릭 시 기 적용 항목은 참조창에서 제외`),
      /* slide14 — 서버정보 */
      server: () => notimpl('서버정보', '[서버등록]',
        `관리자명 · 서버위치 · 휴대전화 · 그룹코드 · e-mail · 도메인 · 접속정보`),
      /* slide10 — 특이사항 */
      memo: () => notimpl('특이사항', '[프로젝트 특이사항]',
        `일자 · 비고
디테일 CRUD: 추가 / 삭제 / 저장 기능키 제공`),
    };
    return (P[tab] || P.basic)();
  }

  const mdc = (c, l, v) => `<div class="md-card ${c}"><div class="l">${esc(l)}</div><div class="v">${f0(v)}</div></div>`;
  const notimpl = (name, tables, schema) => `<div class="notimpl">
    <b>${esc(name)} — 원천 연동 필요</b><br>
    GCMS 현행 데이터에 해당 필드가 없어 스키마만 정의되어 있습니다.
    NSM10 화면정의서 기준 적용 테이블: <b>${esc(tables)}</b>
    <div class="sch">${esc(schema)}</div>
  </div>`;

  /* ════════════════════════════════════════════════════════════
     4. 접수완료진행현황 — 화면정의서 slide5 대시보드
     ════════════════════════════════════════════════════════════ */
  function renderStatus(D) {
    const views = [
      ['구축구분', D.byMethod], ['구축부서', D.byUnit],
      ['제품형태(서버유형)', D.byServer], ['프로젝트구분', D.byPjtType]
    ];
    $('v-status').innerHTML = `
      <div class="sec-head">
        <h2>접수 · 완료 · 진행 현황</h2>
        <span class="sub">화면정의서 V2.0 대시보드 — 조회구분별 집계 (제품구분/구축구분/구축지역/업세일/모듈/프로젝트구분)</span>
      </div>
      <div class="g2">
        ${views.map(([title, g]) => `
          <div class="card">
            <div class="sec-head"><h2 style="font-size:.9rem">${esc(title)}별 집계</h2></div>
            <div class="tbl-wrap"><table>
              <thead><tr>
                <th>${esc(title)}</th><th class="num">접수</th><th class="num">완료</th>
                <th class="num">진행</th><th class="num">지연</th><th class="num">완료율</th>
                <th class="num">계약MD</th><th class="num">투입MD</th><th class="num">생산성</th>
              </tr></thead>
              <tbody>${g.map(x => `<tr>
                <td class="strong">${esc(x.key)}</td>
                <td class="num">${x.total.toLocaleString()}</td>
                <td class="num" style="color:var(--ok);font-weight:700">${x.done}</td>
                <td class="num" style="color:var(--info)">${x.active}</td>
                <td class="num" style="color:${x.delayed ? 'var(--risk)' : 'var(--tx-m)'};font-weight:${x.delayed ? 700 : 400}">${x.delayed}</td>
                <td class="num strong">${f1(x.doneRate)}%</td>
                <td class="num">${f0(x.mdContract)}</td>
                <td class="num">${f0(x.mdInPaid)}</td>
                <td class="num" style="color:${prodColor(x.productivity)};font-weight:700">${x.productivity ? f0(x.productivity) + '%' : '—'}</td>
              </tr>`).join('')}
              <tr style="background:#F7F9FC;font-weight:800">
                <td>합계</td>
                <td class="num">${g.reduce((a, x) => a + x.total, 0).toLocaleString()}</td>
                <td class="num">${g.reduce((a, x) => a + x.done, 0)}</td>
                <td class="num">${g.reduce((a, x) => a + x.active, 0)}</td>
                <td class="num">${g.reduce((a, x) => a + x.delayed, 0)}</td>
                <td class="num">${f1(g.reduce((a, x) => a + x.done, 0) / g.reduce((a, x) => a + x.total, 0) * 100)}%</td>
                <td class="num">${f0(g.reduce((a, x) => a + x.mdContract, 0))}</td>
                <td class="num">${f0(g.reduce((a, x) => a + x.mdInPaid, 0))}</td>
                <td class="num">—</td>
              </tr></tbody>
            </table></div>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="sec-head"><h2 style="font-size:.9rem">PM별 실적 현황 (상위 25)</h2>
          <span class="sub">KPI 4.2 PM당 동시 관리 프로젝트 수 연계</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>PM</th><th>소속</th><th class="num">담당</th><th class="num">완료</th><th class="num">진행</th>
            <th class="num">지연</th><th class="num">완료율</th><th class="num">계약MD</th><th class="num">투입MD</th><th class="num">생산성</th></tr></thead>
          <tbody>${D.pms.slice(0, 25).map(s => `<tr>
            <td class="strong">${esc(s.name)}</td>
            <td style="color:var(--tx-s);font-size:.71rem">${esc(s.unitList)}</td>
            <td class="num">${s.total}</td>
            <td class="num" style="color:var(--ok)">${s.done}</td>
            <td class="num" style="color:${s.active > 10 ? 'var(--warn)' : 'var(--info)'};font-weight:${s.active > 10 ? 800 : 400}">${s.active}</td>
            <td class="num" style="color:${s.delayed ? 'var(--risk)' : 'var(--tx-m)'}">${s.delayed}</td>
            <td class="num strong">${f1(s.doneRate)}%</td>
            <td class="num">${f0(s.mdContract)}</td>
            <td class="num">${f0(s.mdInPaid)}</td>
            <td class="num" style="color:${prodColor(s.productivity)};font-weight:700">${s.productivity ? f0(s.productivity) + '%' : '—'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div style="margin-top:.6rem;font-size:.7rem;color:var(--tx-m)">
          ※ 진행 건수 <b>10건 초과</b> PM은 관리 기준(방문구축 PM 10건 이하) 초과로 주황 표시됩니다.
        </div>
      </div>`;
  }
  const prodColor = v => v === null ? 'var(--tx-m)' : v >= 130 ? 'var(--ok)' : v >= 100 ? 'var(--info)' : 'var(--risk)';

  /* ════════════════════════════════════════════════════════════
     5. 공수현황(개인) — 화면정의서 slide21
     ════════════════════════════════════════════════════════════ */
  const CP = { page: 1, size: 30, list: [] };

  function renderCapa(D) {
    $('v-capa').innerHTML = `
      <div class="sec-head">
        <h2>공수현황 (개인)</h2>
        <span class="sub">화면정의서 V2.0 slide21 — 담당자별 배정·투입·잔여공수 집계 / KPI 4.1 BU% 원천</span>
      </div>
      <div class="filters">
        <div class="f-grid">
          <div class="fg"><label>담당자명 검색</label><input class="ctl" id="cp-q" placeholder="이름 입력"></div>
          <div class="fg"><label>구축부서</label><select class="ctl" id="cp-unit"><option value="">전체</option>${[...new Set(D.rows.map(p => p.unit))].sort().map(u => `<option>${esc(u)}</option>`).join('')}</select></div>
          <div class="fg"><label>정렬</label><select class="ctl" id="cp-sort">
            <option value="projects">담당 건수순</option><option value="mdInPaid">투입공수순</option>
            <option value="mdRemain">잔여공수순</option><option value="productivity">생산성순</option>
            <option value="active">진행 건수순</option></select></div>
        </div>
        <div class="f-info" id="cp-info"></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="tbl-wrap" style="border:none">
          <table>
            <thead><tr>
              <th>담당자</th><th class="num">담당</th><th class="num">진행</th><th class="num">완료</th><th class="num">지연</th>
              <th class="num">계약MD</th><th class="num">예상(유)</th><th class="num">투입(유)</th><th class="num">잔여</th>
              <th class="num">생산성</th><th>주요 담당모듈</th><th>소속</th>
            </tr></thead>
            <tbody id="cp-body"></tbody>
          </table>
        </div>
        <div class="pager" id="cp-pager"></div>
      </div>`;
    ['cp-q', 'cp-unit', 'cp-sort'].forEach(id => {
      $(id).addEventListener('input', () => { CP.page = 1; applyCP(D); });
      $(id).addEventListener('change', () => { CP.page = 1; applyCP(D); });
    });
    applyCP(D);
  }

  function applyCP(D) {
    const q = $('cp-q').value.trim().toLowerCase();
    const unit = $('cp-unit').value;
    const sort = $('cp-sort').value;
    CP.list = D.assignees
      .filter(a => (!q || a.name.toLowerCase().includes(q)) && (!unit || a.unitList.includes(unit)))
      .slice()
      .sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
    drawCP();
  }

  function drawCP() {
    const tot = CP.list.length, pages = Math.max(1, Math.ceil(tot / CP.size));
    CP.page = Math.min(CP.page, pages);
    const rows = CP.list.slice((CP.page - 1) * CP.size, CP.page * CP.size);
    $('cp-info').innerHTML = `
      <span>구축 인력 <b style="color:var(--tx-h)">${tot}</b>명</span>
      <span>총 투입 <b style="color:var(--tx-h)">${f0(CP.list.reduce((a, x) => a + x.mdInPaid, 0))}</b> MD</span>
      <span>1인 평균 <b style="color:var(--tx-h)">${f1(CP.list.reduce((a, x) => a + x.mdInPaid, 0) / (tot || 1))}</b> MD</span>
      <span>${CP.page} / ${pages} 페이지</span>`;
    $('cp-body').innerHTML = rows.map(a => `<tr>
      <td class="strong">${esc(a.name)}</td>
      <td class="num">${a.projects}</td>
      <td class="num" style="color:var(--info)">${a.active}</td>
      <td class="num" style="color:var(--ok)">${a.done}</td>
      <td class="num" style="color:${a.delayed ? 'var(--risk)' : 'var(--tx-m)'}">${a.delayed}</td>
      <td class="num">${f0(a.mdContract)}</td>
      <td class="num">${f0(a.mdPlanPaid)}</td>
      <td class="num" style="color:var(--ok);font-weight:700">${f0(a.mdInPaid)}</td>
      <td class="num" style="color:var(--warn)">${f0(a.mdRemain)}</td>
      <td class="num" style="color:${prodColor(a.productivity)};font-weight:800">${a.productivity ? f0(a.productivity) + '%' : '—'}</td>
      <td style="font-size:.7rem;color:var(--tx-s)">${esc(a.topModules.map(([m, c]) => `${m}(${c})`).join(', '))}</td>
      <td style="font-size:.68rem;color:var(--tx-m)">${esc(a.unitList)}</td>
    </tr>`).join('') || `<tr><td colspan="12" style="text-align:center;padding:2rem;color:var(--tx-m)">검색 결과가 없습니다.</td></tr>`;
    $('cp-pager').innerHTML = pager(pages, CP.page, 'VIEWS.goCP');
  }
  function goCP(p) { CP.page = p; drawCP(); }

  /* ════════════════════════════════════════════════════════════
     6. EQT BMS Benchmark — 가이드라인 §3 / §5 로드맵
     ════════════════════════════════════════════════════════════ */
  const BENCH = [
    ['구축 완료율(건수)', '완료(B)/접수(A)×100', '1.1', '58.4%', '—', '90%+', '연말 741건 재공 해소'],
    ['구축 GM%', '(매출−직접원가)/매출×100', '2.2', '측정 필요', '23%', '25%+', 'ERP 원가 연동 필수'],
    ['재공 처리 속도', '당월완료/전월잔여×100', '1.3', '31.2%', '—', '35%+', 'FoEX 확대가 핵심 레버'],
    ['FoEX Adoption (FAR)', 'FoEX방식건/전체건×100', '3.1', '41.4%', '60%', '50%+', '방문구축→FoEX 전환'],
    ['TTV (SaaS)', 'AVG(개통일−계약일)', '5.1', '측정 필요', '60일', '60일 이내', 'NSM10-GCMS 연동 필요'],
    ['Billable Utilization', '유상MD/가용MD×100', '4.1', '측정 필요', '75%', '75%+', 'GCMS MD구분 입력 필수'],
    ['RAG Red%', 'Red건/전체진행건×100', '6.3', '11.2%', '5%', '8% 이하', '재공 지연건 집중 처리'],
    ['CSAT (개통 후)', 'AVG(고객응답, 5점)', '5.2', '미집계', '4.0', '4.2+', 'VOC 설문 시스템화 필요'],
    ['AI Attach Rate', 'AI활성고객/라이브고객×100', '5.4', '미집계', '—', '30%+', 'A10 로그 연동 Phase 1'],
    ['PM AI DAU%', 'AI도구활성PM/전체PM×100', '7.1', '미집계', '—', '70%+', 'IT인프라 협력 필요'],
    ['H/W 대기율', 'H/W대기건/구축형진행건×100', '6.4', '추정 20%+', '—', '10% 이하', '더존구매팀↔DELL 협의'],
    ['반품률', '반품(C)/접수(A)×100', '1.6', '0.44%', '—', '0.5% 이내', '현재 양호 수준 유지'],
  ];

  const ROADMAP = [
    ['0~30일 (즉시)', 'KPI v1.0 확정 + Master Data 매핑', '구축완료율 · 재공처리속도 · 반품률 · RAG Red%',
      'GCMS-NSM10 프로젝트ID/고객ID 키 통일. As-Is 수동 산출 시범 운영.'],
    ['31~90일 (Phase 1)', 'GCMS AI KPI 항목 개발 + GCMS→NSM10 자동집계', '완료율 + 금액 + TTV + 방식별완료율 + FoEX FAR',
      'GCMS MD실적등록 Billable 구분 필드 추가. NSM10 구축진척 자동 집계 메뉴 신설.'],
    ['91~180일 (Phase 2)', 'NSM10 AI KPI 대시보드 가동 + GM% 자동 산출', 'Pillar 1·2·3·4 전체',
      'ERP 원가 연동으로 GM% 자동 산출. NSM10 AI KPI 대시보드 가동.'],
    ['181~360일 (Phase 3)', 'A10 사용로그 연동 + EQT BMS 보고 정렬', 'Pillar 5·6·7 추가 (전체)',
      'A10 AI Attach Rate·Adoption 자동 집계. CSAT·NPS VOC 시스템화. EQT 분기 보고 자동화.'],
  ];

  function renderBench(D, K) {
    $('v-bench').innerHTML = `
      <div class="sec-head">
        <h2>EQT BMS Benchmark & 로드맵</h2>
        <span class="sub">관리지표 가이드라인 v1.0 §3 벤치마크 매핑 · §5 산출 공식 정착 로드맵</span>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">PKG ↔ EQT 관리 기준 매핑</h2></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>KPI</th><th>압축 공식</th><th class="ctr">가이드 As-Is</th><th class="ctr">EQT Median</th>
            <th class="ctr">2026 목표</th><th class="ctr">GCMS 현행 산출</th><th class="ctr">판정</th><th>비고</th></tr></thead>
          <tbody>${BENCH.map(([n, f, id, asis, med, tgt, memo]) => {
            const k = K.get(id);
            const now = k ? k.result.disp : '—';
            const j = k ? k.judge : { cls: 'idle', txt: '—' };
            return `<tr>
              <td class="strong">${esc(n)}</td>
              <td class="mono" style="font-size:.68rem;color:var(--info)">${esc(f)}</td>
              <td class="ctr" style="color:var(--tx-s)">${esc(asis)}</td>
              <td class="ctr" style="color:var(--tx-s)">${esc(med)}</td>
              <td class="ctr strong">${esc(tgt)}</td>
              <td class="ctr strong" style="color:${j.cls === 'ok' ? 'var(--ok)' : j.cls === 'risk' ? 'var(--risk)' : 'var(--tx-m)'}">${esc(now)}</td>
              <td class="ctr"><span class="judge ${j.cls}">${j.txt}</span></td>
              <td style="font-size:.7rem;color:var(--tx-s)">${esc(memo)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">산출 공식 정착 로드맵 (90 · 180 · 360일)</h2></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>기간</th><th>주요 산출물</th><th>우선 KPI</th><th>실행 과제</th></tr></thead>
          <tbody>${ROADMAP.map(([a, b, c, d]) => `<tr>
            <td class="strong" style="white-space:nowrap">${esc(a)}</td>
            <td>${esc(b)}</td><td style="color:var(--tx-s)">${esc(c)}</td>
            <td style="font-size:.72rem;color:var(--tx-s)">${esc(d)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="g2">
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">데이터 거버넌스 5원칙</h2></div>
          <div style="font-size:.76rem;line-height:1.9;color:var(--tx-b)">
            <b>① SSOT 단일 원천</b> — GCMS &gt; NSM10 &gt; ERP 순 우선순위. 동일 KPI 중복 산출 금지.<br>
            <b>② Master Data 일치성</b> — 프로젝트 ID·고객 ID를 4개 시스템에서 동일 키로 운영.<br>
            <b>③ 기간 정의 통일</b> — 월별 집계 기준일 매월 말일 23:59. 전년이월 별도 코드 분리.<br>
            <b>④ 변경 이력 관리</b> — 공식·목표값 변경 시 Change Log 등록. 분기 단위 변경만 허용.<br>
            <b>⑤ 감사 추적</b> — 모든 KPI 산출 결과는 GCMS 원천까지 Drill-down 가능하도록 설계.
          </div>
        </div>
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">즉시 실행 3대 Quick Win</h2></div>
          <div style="font-size:.76rem;line-height:1.85;color:var(--tx-b)">
            <div style="padding:.6rem .75rem;background:var(--ok-bg);border-radius:8px;margin-bottom:.5rem">
              <b>1순위 — Master Data 매핑 워크숍</b><br>
              <span style="color:var(--tx-s);font-size:.73rem">GCMS·NSM10·ERP·HR 간 프로젝트 ID/고객 ID 통일. 모든 KPI 자동 산출의 공통 기반.</span>
            </div>
            <div style="padding:.6rem .75rem;background:var(--info-bg);border-radius:8px;margin-bottom:.5rem">
              <b>2순위 — 4대 핵심 KPI 수동 산출 시범 (30일)</b><br>
              <span style="color:var(--tx-s);font-size:.73rem">구축완료율·재공처리속도·FoEX FAR·RAG Red% — 본 시스템에서 이미 자동 산출 중.</span>
            </div>
            <div style="padding:.6rem .75rem;background:var(--warn-bg);border-radius:8px">
              <b>3순위 — GCMS MD실적등록 Billable 구분 필드 추가</b><br>
              <span style="color:var(--tx-s);font-size:.73rem">BU%·건당 완료금액·CTD 산출의 핵심 원천. 프로젝트 코드 vs 공통(IDLE) 정확 입력 체계.</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  return {
    renderExec, renderBook, renderProjectShell, renderStatus, renderCapa, renderBench,
    selectPJ, goPJ, goTab, goCP
  };
})();
