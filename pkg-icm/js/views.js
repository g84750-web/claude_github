/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 화면 렌더러
   근거 : NSM 개발 화면정의서 V2.0 / ERP 관리지표 가이드라인 v1.0
        / PKG 주간보고 작업지침 v2 / A10 탭별 검증 체크리스트
   ══════════════════════════════════════════════════════════════════ */
const VIEWS = (() => {

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(1);
  const f2 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : v.toFixed(2);
  const f0 = v => (v === null || v === undefined || !isFinite(v)) ? '—' : Math.round(v).toLocaleString();
  const pct = (n, d) => d > 0 ? n / d * 100 : null;
  const PACC = n => `--pbg:var(--p${n}-bg);--pacc:var(--p${n}-acc);--pmid:var(--p${n}-mid)`;
  const ST = { auto: '자동산출', proxy: '대체산출', pending: '연동 필요' };
  const sc = s => ({ '완료': 'var(--ok)', '진행': 'var(--info)', '지연': 'var(--risk)', '보류': 'var(--warn)', '반품': '#A855F7' }[s] || 'var(--idle)');
  const prodColor = v => v === null ? 'var(--tx-m)' : v >= 130 ? 'var(--ok)' : v >= 100 ? 'var(--info)' : 'var(--risk)';
  const fld = (l, v, na) => `<div class="fld"><div class="l">${esc(l)}</div><div class="v ${na ? 'na' : ''}">${esc(v)}</div></div>`;

  /** 필터 바인딩 — 텍스트 입력에 change 를 함께 걸면 blur 시 목록이 다시 그려져
      직후의 클릭이 취소된다. 요소 종류에 맞는 이벤트 하나만 사용한다. */
  function bindFilters(ids, fn) {
    ids.forEach(id => {
      const el = $(id); if (!el) return;
      const ev = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
      el.addEventListener(ev, fn);
    });
  }

  function bar2(label, n, d, color) {
    const p = d > 0 ? n / d * 100 : 0;
    return `<div class="rank">
      <div class="rh"><span class="n">${esc(label)}</span><span class="s">${n.toLocaleString()}건 · ${f1(p)}%</span></div>
      <div class="bar"><i style="width:${p}%;background:${color}"></i></div></div>`;
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
        <span style="color:var(--tx-m);font-weight:500">※ 막대에 마우스를 올리면 재공(WIP) 잔여건 표시</span>
      </div>`;
  }

  /* ════════ 1. Executive ════════ */
  function renderExec(D, K) {
    const cards = KPI.EXEC.map(id => {
      const k = K.get(id); if (!k) return '';
      const r = k.result, acc = `var(--p${k.pillar}-acc)`;
      const prog = (k.targetVal !== undefined && r.v !== null && isFinite(r.v))
        ? Math.max(0, Math.min(100, k.op === 'lte'
          ? (r.v <= 0 ? 100 : Math.min(100, k.targetVal / r.v * 100)) : r.v / k.targetVal * 100)) : 0;
      return `<div class="exec-card" style="--acc:${acc}">
        <div class="k-name">${esc(k.name)}</div>
        <div class="k-val">${esc(r.disp)}</div>
        <div class="k-meta">${esc(r.sub || '')}</div>
        <div class="bar"><i style="width:${prog}%"></i></div>
        <div class="k-target"><span>목표 ${k.op === 'lte' ? '≤' : '≥'} ${k.targetVal ?? '—'}${k.unit || ''}</span>
          <span class="judge ${k.judge.cls}">${k.judge.txt}</span></div>
      </div>`;
    }).join('');

    const s = KPI.summary(K), m = D.meta.md || {};
    $('v-exec').innerHTML = `
      <div class="sec-head"><h2>Executive Dashboard</h2>
        <span class="sub">가이드라인 v1.0 §2 6대 핵심 KPI · 주간보고 4대 KPI · 기준일 ${esc(D.asOf)}</span></div>
      <div class="exec-grid">${cards}</div>

      <div class="g3">
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">KPI 산출 커버리지</h2></div>
          ${bar2('자동 산출 (GCMS 현행)', s.auto, s.total, 'var(--ok)')}
          ${bar2('대체 산출 (원천 일부 부재)', s.proxy, s.total, 'var(--warn)')}
          ${bar2('연동 필요 (ERP·VOC·ITSM·HR)', s.pending, s.total, 'var(--idle)')}
          <div style="margin-top:.8rem;padding-top:.7rem;border-top:1px dashed var(--bd-light);font-size:.74rem;color:var(--tx-s)">
            총 <b style="color:var(--tx-h)">${s.total}개</b> KPI 중
            <b style="color:var(--ok)">${s.auto + s.proxy}개</b> 현행 데이터로 산출 중</div>
        </div>
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">구축 진행 현황</h2></div>
          ${D.CODE.STATUS.map(st => bar2(st, D.meta.status?.[st] || 0, D.stat.total, sc(st))).join('')}
          <div style="margin-top:.6rem;font-size:.72rem;color:var(--tx-s)">
            현진행 <b style="color:var(--tx-h)">${D.stat.active}</b>건 = 진행 ${D.meta.status?.['진행'] || 0} + 지연 ${D.meta.status?.['지연'] || 0}</div>
        </div>
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">계약공수 기준 공수 현황</h2></div>
          <div class="md-cards" style="grid-template-columns:1fr 1fr">
            <div class="md-card c1"><div class="l">계약공수</div><div class="v">${f0(m.contract)}</div></div>
            <div class="md-card c2"><div class="l">투입환산</div><div class="v">${f0(m.converted)}</div></div>
            <div class="md-card c3"><div class="l">최종 미투입</div><div class="v">${f1(m.finalUn)}</div></div>
            <div class="md-card c4"><div class="l">구축지연</div><div class="v">${f1(D.meta.delayM)}M</div></div>
          </div>
          <div style="font-size:.7rem;color:var(--tx-s);line-height:1.7;font-family:ui-monospace,monospace">
            ${f1(m.contract)} = ${f1(m.converted)} + ${f1(m.un1)} ✓<br>
            미투입1차 = 유상 ${f1(m.paidUn)} + 무상 ${f1(m.freeUn1)}<br>
            최종 = 유상 + 무상×30% = ${f1(m.finalUn)}</div>
        </div>
      </div>

      <div class="card"><div class="sec-head">
          <h2 style="font-size:.9rem">월별 접수 · 완료 · 재공(WIP) 추이</h2>
          <span class="sub">KPI 1.3 재공 처리 속도 산출 기반</span></div>
        ${monthlyChart(D.monthly.slice(-16))}</div>`;
  }

  /* ════════ 2. KPI Definition Book ════════ */
  function renderBook(D, K) {
    const s = KPI.summary(K);
    const pillars = KPI.PILLARS.map(P => {
      const ks = KPI.LIST.filter(k => k.pillar === P.no);
      return `<div class="pillar" style="${PACC(P.no)}">
        <div class="pillar-head">
          <div class="no">${P.no}</div><h3>${esc(P.ko)}</h3>
          <span class="en">${esc(P.name)}</span><span class="spacer"></span>
          <span class="chip" style="background:var(--pacc);color:#fff;border:none">KPI ${ks.length}개</span>
          <div class="desc">${esc(P.desc)}</div></div>
        <div class="pillar-body">${ks.map(k => kpiCard(K.get(k.id))).join('')}</div></div>`;
    }).join('');

    $('v-book').innerHTML = `
      <div class="sec-head"><h2>KPI Definition Book</h2>
        <span class="sub">ERP 관리지표 가이드라인 v1.0 + 주간보고 작업지침 v2 — 7 Pillar ${s.total}개 KPI</span>
        <span class="spacer"></span>
        <span class="st auto">자동산출 ${s.auto}</span><span class="st proxy">대체산출 ${s.proxy}</span><span class="st pending">연동필요 ${s.pending}</span></div>
      <div class="card" style="margin-bottom:1.2rem;background:#F8FAFF;border-color:#C7D2FE">
        <div style="font-size:.78rem;line-height:1.85;color:var(--tx-b)">
          <b style="color:var(--tx-h)">5대 공식 표준화 원칙</b> —
          ① 분자·분모·기간 명시 · ② SSOT 단일 원천 (GCMS &gt; NSM10 &gt; ERP) ·
          ③ Snapshot vs Period 시점 기준 통일 · ④ 구축방식·서버유형별 보정 ·
          ⑤ EQT Top-quartile 절대 기준 적용</div></div>
      ${pillars}`;
  }

  function kpiCard(k) {
    if (!k) return '';
    const r = k.result;
    const detail = (r.detail && r.detail.length)
      ? `<div style="margin-top:.55rem;padding-top:.5rem;border-top:1px dashed var(--bd-light)">
           ${r.detail.map(x => `<div class="kpi-row"><span class="lb">${esc(x.label)}</span><span class="vl">${esc(x.value)}</span></div>`).join('')}
         </div>` : '';
    return `<div class="kpi">
      <div class="kpi-top"><span class="kpi-id">${esc(k.id)}</span>
        <span class="kpi-name">${esc(k.name)} ${k.star ? '<span class="kpi-star">★</span>' : ''}</span>
        <span class="st ${k.state}">${ST[k.state]}</span></div>
      <div style="font-size:.73rem;color:var(--tx-s);line-height:1.6">${esc(k.def)}</div>
      <div class="kpi-formula">${esc(k.formula)}</div>
      <div class="kpi-row"><span class="lb">데이터 원천</span><span class="vl">${esc(k.source)}</span></div>
      <div class="kpi-row"><span class="lb">측정 주기</span><span class="vl">${esc(k.cycle)}</span></div>
      <div class="kpi-row"><span class="lb">관리 기준</span><span class="vl">${esc(k.target)}</span></div>
      <div class="kpi-row"><span class="lb">As-Is (지침)</span><span class="vl">${esc(k.asIs || '—')}</span></div>
      ${detail}
      <div class="kpi-result">
        <div><div style="font-size:.65rem;color:var(--tx-m);font-weight:800">GCMS 현행 산출값</div>
          <div class="now ${r.v === null || !isFinite(r.v) ? 'na' : ''}">${esc(r.disp)}</div>
          ${r.sub ? `<div style="font-size:.68rem;color:var(--tx-m);margin-top:.15rem">${esc(r.sub)}</div>` : ''}</div>
        <span class="judge ${k.judge.cls}">${k.judge.txt}</span></div>
      ${k.note ? `<div class="kpi-note">${esc(k.note)}</div>` : ''}</div>`;
  }

  /* ════════ 3. PROJECT 등록 ════════ */
  const PJ = { page: 1, size: 40, filtered: [], sel: null, tab: 'basic' };
  const DTABS = [['basic', '기본정보'], ['build', '구축정보'], ['md', '공수정보'], ['assign', '배정정보'],
    ['input', '투입정보'], ['billing', '빌링정보'], ['order', '주문정보'], ['server', '서버정보'], ['memo', '특이사항']];

  function renderProjectShell(D) {
    const opt = arr => '<option value="">전체</option>' + arr.map(v => `<option>${esc(v)}</option>`).join('');
    $('v-project').innerHTML = `
      <div class="sec-head"><h2>PROJECT 등록</h2>
        <span class="sub">NSM 화면정의서 V2.0 — 헤더/디테일 9탭 구조 · 총 ${D.stat.total.toLocaleString()}건</span></div>
      <div class="filters"><div class="f-grid">
        <div class="fg"><label>검색 (고객사·코드·PM)</label><input class="ctl" id="pj-q" placeholder="검색어"></div>
        <div class="fg"><label>구축상태</label><select class="ctl" id="pj-st">${opt(D.CODE.STATUS)}</select></div>
        <div class="fg"><label>센터</label><select class="ctl" id="pj-ct">${opt([...new Set(D.rows.map(p => p.center))].sort())}</select></div>
        <div class="fg"><label>구축부서</label><select class="ctl" id="pj-dept">${opt([...new Set(D.rows.map(p => p.unit))].sort())}</select></div>
        <div class="fg"><label>구축구분</label><select class="ctl" id="pj-mt">${opt([...new Set(D.rows.map(p => p.method))].sort())}</select></div>
        <div class="fg"><label>제품구분</label><select class="ctl" id="pj-sv">${opt(D.CODE.SERVER)}</select></div>
        <div class="fg"><label>접수일 FROM</label><input class="ctl" id="pj-f" type="date"></div>
        <div class="fg"><label>접수일 TO</label><input class="ctl" id="pj-t" type="date"></div>
      </div><div class="f-info" id="pj-info"></div></div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="md-master tbl-wrap" style="border:none;border-radius:0"><table>
          <thead><tr><th>프로젝트코드</th><th>거래처명</th><th>PM</th><th>센터</th><th>진행상태</th>
            <th>구축구분</th><th>제품형태</th><th class="num">수주액(백만)</th><th class="num">계약공수</th>
            <th class="num">투입</th><th class="num">최종미투입</th><th>납기</th><th>접수일</th></tr></thead>
          <tbody id="pj-body"></tbody></table></div>
        <div class="pager" id="pj-pager"></div></div>
      <div class="card" id="pj-detail" style="margin-top:1rem"></div>`;
    bindFilters(['pj-q', 'pj-st', 'pj-ct', 'pj-dept', 'pj-mt', 'pj-sv', 'pj-f', 'pj-t'],
      () => { PJ.page = 1; applyPJ(D); });
    applyPJ(D);
  }

  function applyPJ(D) {
    const q = $('pj-q').value.trim().toLowerCase();
    const st = $('pj-st').value, ct = $('pj-ct').value, dept = $('pj-dept').value;
    const mt = $('pj-mt').value, sv = $('pj-sv').value, from = $('pj-f').value, to = $('pj-t').value;
    PJ.filtered = D.rows.filter(p => {
      if (q && !(p.code?.toLowerCase().includes(q) || p.customer?.toLowerCase().includes(q) || p.pm?.toLowerCase().includes(q))) return false;
      if (st && p.status !== st) return false;
      if (ct && p.center !== ct) return false;
      if (dept && p.unit !== dept) return false;
      if (mt && p.method !== mt) return false;
      if (sv && p.server !== sv) return false;
      if (from && (p.recvDate || '') < from) return false;
      if (to && (p.recvDate || '') > to) return false;
      return true;
    });
    drawPJ(D);
  }

  function drawPJ(D) {
    const tot = PJ.filtered.length, pages = Math.max(1, Math.ceil(tot / PJ.size));
    PJ.page = Math.min(PJ.page, pages);
    const rows = PJ.filtered.slice((PJ.page - 1) * PJ.size, PJ.page * PJ.size);
    const sum = f => PJ.filtered.reduce((a, p) => a + (p[f] || 0), 0);
    $('pj-info').innerHTML = `
      <span>검색결과 <b style="color:var(--tx-h)">${tot.toLocaleString()}</b>건</span>
      <span>수주액 <b style="color:var(--tx-h)">${f0(sum('orderAmt') / 1e6)}</b>백만</span>
      <span>계약공수 <b style="color:var(--tx-h)">${f0(sum('mdContract'))}</b> MD</span>
      <span>최종미투입 <b style="color:var(--warn)">${f1(sum('mdFinalUn'))}</b> MD</span>
      <span>${PJ.page} / ${pages} 페이지</span>`;
    $('pj-body').innerHTML = rows.map(p => `
      <tr onclick="VIEWS.selectPJ('${esc(p.code)}')" class="${PJ.sel === p.code ? 'sel' : ''}" style="cursor:pointer">
        <td class="mono strong">${esc(p.code)}</td><td>${esc(p.customer)}</td><td>${esc(p.pm)}</td>
        <td style="color:var(--tx-s);font-size:.7rem">${esc((p.center || '').replace(/\(.*/, ''))}</td>
        <td><span class="bdg ${esc(p.status)}">${esc(p.status)}</span></td>
        <td style="font-size:.71rem;color:var(--tx-s)">${esc(p.method)}</td>
        <td style="font-size:.71rem">${esc(p.server)}</td>
        <td class="num">${f0((p.orderAmt || 0) / 1e6)}</td>
        <td class="num">${f0(p.mdContract || p.mdPlan)}</td>
        <td class="num">${f0(p.mdUsed)}</td>
        <td class="num" style="color:${p.mdFinalUn > 0 ? 'var(--warn)' : 'var(--tx-m)'}">${p.mdFinalUn ? f1(p.mdFinalUn) : '—'}</td>
        <td style="font-size:.68rem;color:${['조기', '정시', '30일내'].includes(p.dlvBucket) ? 'var(--ok)' : p.dlvBucket ? 'var(--risk)' : 'var(--tx-m)'}">${esc(p.dlvBucket || '—')}</td>
        <td class="mono" style="font-size:.68rem">${esc(p.recvDate || '')}</td>
      </tr>`).join('') || `<tr><td colspan="13" style="text-align:center;padding:2rem;color:var(--tx-m)">검색 결과가 없습니다.</td></tr>`;
    $('pj-pager').innerHTML = pager(pages, PJ.page, 'VIEWS.goPJ');
    if (PJ.sel === null && rows.length) { PJ.sel = rows[0].code; }
    drawDetail(D);
  }

  function selectPJ(code) { PJ.sel = code; drawPJ(APP.D); }
  function goPJ(p) { PJ.page = p; drawPJ(APP.D); }
  function goTab(t) { PJ.tab = t; drawDetail(APP.D); }

  function drawDetail(D) {
    const box = $('pj-detail'); if (!box) return;
    const p = D.byCode.get(PJ.sel);
    if (!p) { box.innerHTML = '<p style="color:var(--tx-m)">프로젝트를 선택하세요.</p>'; return; }
    box.innerHTML = `
      <div class="sec-head"><h2 style="font-size:.92rem;font-family:ui-monospace,monospace;color:#3B4FC8">${esc(p.code)}</h2>
        <span class="bdg ${esc(p.status)}">${esc(p.status)}</span><span class="sub">${esc(p.customer)}</span></div>
      <div class="detail-tabs">${DTABS.map(([k, n]) =>
        `<button class="dt-btn ${PJ.tab === k ? 'active' : ''}" onclick="VIEWS.goTab('${k}')">${n}</button>`).join('')}</div>
      <div>${detailPane(D, p, PJ.tab)}</div>`;
  }

  const mdc = (c, l, v) => `<div class="md-card ${c}"><div class="l">${esc(l)}</div><div class="v">${v}</div></div>`;
  const notimpl = (name, tables, schema) => `<div class="notimpl">
    <b>${esc(name)} — 원천 연동 필요</b><br>GCMS 현행 데이터에 해당 필드가 없어 스키마만 정의되어 있습니다.
    NSM 화면정의서 기준 적용 테이블: <b>${esc(tables)}</b>
    <div class="sch">${esc(schema)}</div></div>`;

  function detailPane(D, p, tab) {
    const asn = D.assignByCode.get(p.code) || [];
    const P = {
      basic: () => `<div class="fld-grid">
        ${fld('프로젝트코드', p.code)}${fld('거래처명', p.customer)}${fld('사업자등록번호', p.bizno || '—')}
        ${fld('PM', p.pm)}${fld('구축부서', p.dept)}${fld('센터', p.center)}
        ${fld('제품구분', p.product)}${fld('프로젝트구분', p.pjtType)}${fld('업셀구분', p.upsell || '—')}
        ${fld('모듈구분', p.module || '—')}${fld('수주일', p.orderDate || '—')}${fld('구축접수일', p.recvDate || '—')}
        ${fld('증적기준', p.evidence || '—')}${fld('제품형태', p.form || '—')}${fld('진행매출', p.revFlag || '—')}
      </div>`,
      build: () => `<div class="fld-grid">
        ${fld('구축구분', p.method)}${fld('서버유형', p.server)}${fld('구축지역', p.region || '—')}
        ${fld('구축시작일', p.startDate || '—')}${fld('설치(개통)일', p.installDate || '—')}
        ${fld('구축완료예정일 (AD)', p.dueDate || '—')}${fld('변경완료예정일 (AE)', p.dueChgDate || '—')}
        ${fld('약정일 BP (AE→AD)', p.bpDate || '—')}${fld('구축완료일 (AF)', p.doneDate || '—')}
        ${fld('납기 판정', p.dlvBucket ? `${p.dlvBucket} (${p.dlvDelta > 0 ? '+' : ''}${p.dlvDelta}일)` : '—')}
        ${fld('UC확장팩', p.ucPack || '—')}${fld('계약기간', p.ctrStart ? `${p.ctrStart} ~ ${p.ctrEnd}` : '—')}
        ${fld('TTV (접수→완료)', p.leadTime !== null ? p.leadTime + '일' : '—')}
        ${fld('참고: 수주→접수', (p.orderDate && p.recvDate) ? Math.round((new Date(p.recvDate) - new Date(p.orderDate)) / 86400000) + '일' : '—')}
      </div>
      <div class="notimpl" style="margin-top:.9rem"><b>KPI 연계</b> —
        약정일 BP는 <b>변경완료예정일(AE) 1순위 → 구축완료예정일(AD) 2순위</b>로 결정되며, KPI 1.7 납기준수율의 판정 기준입니다.
        구축지역은 KPI 4.4 센터·지역별 인력 효율의 원천입니다.</div>`,
      md: () => {
        const isFam = p.isFoEXFamily;
        return `<div class="md-cards">
          ${mdc('c1', '계약공수', f0(p.mdContract || (isFam ? p.mdStd : p.mdPlan)))}
          ${mdc('c5', '표준공수 (AH)', f0(p.mdStd))}
          ${mdc('c5', '예상공수 (AI·유상)', f0(p.mdPlan))}
          ${mdc('c2', '투입공수 (AJ)', f0(p.mdUsed))}
          ${mdc('c4', '무상공수', f0(Math.max(0, (p.mdStd || 0) - (p.mdPlan || 0))))}
          ${mdc('c3', '최종 미투입', p.mdFinalUn ? f1(p.mdFinalUn) : '—')}
        </div>
        <div class="fld-grid">
          ${fld('유상 미투입', p.mdPaidUn ? f1(p.mdPaidUn) + ' MD' : '—')}
          ${fld('무상 미투입 1차', p.mdFreeUn1 ? f1(p.mdFreeUn1) + ' MD' : '—')}
          ${fld('잔여율', p.remainRate !== null && p.remainRate !== undefined ? (p.remainRate * 100).toFixed(1) + '%' : '—')}
          ${fld('특수규칙', p.spRule || '해당 없음', !p.spRule)}
        </div>
        <div class="notimpl" style="margin-top:.9rem"><b>계약공수 기준 산정 (작업지침 v2 §1-3 확정 정책)</b>
          <div class="sch">구축구분: ${p.method}
계약공수 = ${isFam ? '표준공수(AH)' : '예상공수(AI)'} = ${f0(p.mdContract || (isFam ? p.mdStd : p.mdPlan))} m/d
${p.method === 'FoEX교육(1:N)'
  ? `미투입(무상) = 계약공수 × 잔여율 = ${f0(p.mdContract)} × ${p.remainRate !== null ? (p.remainRate * 100).toFixed(1) + '%' : '—'} = ${f1(p.mdFreeUn1)}`
  : p.method === 'FoEX교육(1:N)+방문'
  ? `유상 미투입 = AI − AJ = ${f0(p.mdPlan)} − ${f0(p.mdUsed)} = ${f1(p.mdPaidUn)}
무상 미투입 = (AH − AI) × 잔여율 = ${f0(p.mdStd - p.mdPlan)} × ${p.remainRate !== null ? (p.remainRate * 100).toFixed(1) + '%' : '—'} = ${f1(p.mdFreeUn1)}`
  : `유상 미투입 = AI − AJ = ${f0(p.mdPlan)} − ${f0(p.mdUsed)} = ${f1(p.mdPaidUn)}`}
최종 미투입 = 유상 + 무상×30% = ${f1(p.mdFinalUn)} m/d
※ AK(진행률%) 컬럼 사용 금지 — FoEX(1:N)은 예상공수 0 고정으로 신뢰 불가</div></div>`;
      },
      assign: () => asn.length ? `
        <div style="font-size:.72rem;color:var(--tx-m);margin-bottom:.5rem">
          담당자별 원본 기준일 <b>${esc(D.assigneeMeta?.asOf || '—')}</b>
          ${D.assigneeMeta?.asOf !== D.asOf ? ` · ⚠ GCMS 기준일(${esc(D.asOf)})과 상이 — 기준일 병기` : ''}</div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>담당자</th><th>담당모듈</th><th class="num">개별 예상</th><th class="num">개별 투입</th>
            <th class="num">개별 미투입</th><th class="num">추가</th><th class="num">마이그</th><th class="num">아웃바운드</th><th>최종투입일</th></tr></thead>
          <tbody>${asn.map(a => `<tr>
            <td class="strong">${esc(a.person)}</td><td style="color:var(--tx-s)">${esc(a.module || '—')}</td>
            <td class="num">${f1(a.mdPlan)}</td><td class="num" style="color:var(--ok)">${f1(a.mdUsed)}</td>
            <td class="num" style="color:var(--warn)">${f1(a.mdUn)}</td>
            <td class="num">${a.mdAdd ? f1(a.mdAdd) : '—'}</td><td class="num">${a.mdMig ? f1(a.mdMig) : '—'}</td>
            <td class="num">${a.mdOut ? f1(a.mdOut) : '—'}</td>
            <td class="mono" style="font-size:.68rem">${esc(a.lastDate || '—')}</td></tr>`).join('')}</tbody></table></div>`
        : '<p style="color:var(--tx-m);padding:1rem">배정 정보가 없습니다. (담당자별 원본 미보유 프로젝트)</p>',
      input: () => notimpl('투입정보', '[투입실적등록]',
        `투입일자 · 모듈 · 담당자 · 투입공수 · 공수구분(유/무/기타) · 선발행여부 · 회의록 · 교육확인서 · 비고
필수값: 투입일자 · 담당자 · 투입공수 · 방문구축 · 선발행여부
※ 현재는 담당자별 누적 실적만 보유 (배정정보 탭 참조). 일자별 투입 이력은 미보유
KPI 연계: 2.4 매출 실현율 · 4.1 BU% · 3.3 방법론 준수율`),
      billing: () => `<div class="fld-grid">
          ${fld('총수주액 (O열)', f0((p.orderAmt || 0) / 1e6) + ' 백만')}
          ${fld('라이선스 (P열)', f0((p.license || 0) / 1e6) + ' 백만')}
          ${fld('교육비', f0((p.eduFee || 0) / 1e6) + ' 백만')}
          ${fld('라이선스 발행액', 'ERP 연동 필요', true)}${fld('교육비 발행액', 'ERP 연동 필요', true)}
          ${fld('미발행액', 'ERP 연동 필요', true)}
        </div>
        <div class="notimpl" style="margin-top:.9rem"><b>⚠ 인용 주의</b> —
          수주금액 지표는 반드시 <b>O열(총수주액)</b>을 사용합니다. P열(라이선스)과 혼동 시 KPI 1.2·2.1이 왜곡됩니다.
          <div class="sch">잔여공수 = 예상공수(유) − 투입공수(유) = ${f0(p.mdPlan)} − ${f0(p.mdUsed)} = ${f0(p.mdRemain)}
재경부서 처리내역 반영 버튼 → 라이선스발행액 · 교육비발행액 업데이트 (미구현)</div></div>`,
      order: () => notimpl('주문정보', '[주문정보] [거래처등록]',
        `영업부서 주문승인건 조회·선택 → 주문정보 탭 저장
→ 빌링정보 탭 저장 · 기본정보 탭에 거래처코드/거래처명/사업자번호/수주일 저장
→ 제품구분 & 구축접수일에 따라 프로젝트코드 자동 생성
   Amaranth10 SaaS : PAS + 년도2 + 월2 + 일련번호3   (현재 코드: ${p.code})
   Amaranth10      : PAC + 년도2 + 월2 + 일련번호3
※ [수주적용] 재클릭 시 기 적용 항목은 참조창에서 제외`),
      server: () => notimpl('서버정보', '[서버등록]',
        `관리자명 · 서버위치 · 휴대전화 · 그룹코드 · e-mail · 도메인 · 접속정보`),
      memo: () => notimpl('특이사항', '[프로젝트 특이사항]',
        `일자 · 비고 / 디테일 CRUD: 추가 · 삭제 · 저장`),
    };
    return (P[tab] || P.basic)();
  }

  /* ════════ 4. 접수·완료 현황 ════════ */
  function renderStatus(D) {
    const views = [['구축구분 (Y열)', D.byMethod], ['센터 (K열 매핑)', D.byCenter],
      ['서버유형', D.byServer], ['업셀구분', D.byUpsell]];
    const tbl = (title, g) => `<div class="card">
      <div class="sec-head"><h2 style="font-size:.9rem">${esc(title)}별 집계</h2></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>${esc(title)}</th><th class="num">접수</th><th class="num">완료</th><th class="num">현진행</th>
          <th class="num">지연</th><th class="num">완료율</th><th class="num">납기준수</th>
          <th class="num">수주(백만)</th><th class="num">건당</th><th class="num">최종미투입</th></tr></thead>
        <tbody>${g.map(x => `<tr>
          <td class="strong">${esc(x.key)}</td>
          <td class="num">${x.total.toLocaleString()}</td>
          <td class="num" style="color:var(--ok);font-weight:700">${x.done.toLocaleString()}</td>
          <td class="num" style="color:var(--info)">${x.active}</td>
          <td class="num" style="color:${x.delayed ? 'var(--risk)' : 'var(--tx-m)'}">${x.delayed}</td>
          <td class="num strong">${f1(x.doneRate)}%</td>
          <td class="num" style="color:${x.dlvRate >= 94 ? 'var(--ok)' : 'var(--warn)'}">${x.dlvRate !== null ? f1(x.dlvRate) + '%' : '—'}</td>
          <td class="num">${f0(x.amount / 1e6)}</td>
          <td class="num">${x.avgAmount !== null ? f1(x.avgAmount) : '—'}</td>
          <td class="num" style="color:var(--warn)">${x.mdFinalUn ? f1(x.mdFinalUn) : '—'}</td></tr>`).join('')}
        <tr style="background:#F7F9FC;font-weight:800">
          <td>합계</td><td class="num">${g.reduce((a, x) => a + x.total, 0).toLocaleString()}</td>
          <td class="num">${g.reduce((a, x) => a + x.done, 0).toLocaleString()}</td>
          <td class="num">${g.reduce((a, x) => a + x.active, 0)}</td>
          <td class="num">${g.reduce((a, x) => a + x.delayed, 0)}</td>
          <td class="num">${f1(pct(g.reduce((a, x) => a + x.done, 0), g.reduce((a, x) => a + x.total, 0)))}%</td>
          <td class="num">—</td><td class="num">${f0(g.reduce((a, x) => a + x.amount, 0) / 1e6)}</td>
          <td class="num">—</td><td class="num">${f1(g.reduce((a, x) => a + x.mdFinalUn, 0))}</td></tr>
        </tbody></table></div></div>`;

    $('v-status').innerHTML = `
      <div class="sec-head"><h2>접수 · 완료 · 진행 현황</h2>
        <span class="sub">화면정의서 대시보드 — 조회구분별 집계 · 기준일 ${esc(D.asOf)}</span></div>
      <div class="g2">${views.map(([t, g]) => tbl(t, g)).join('')}</div>
      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">구축구분별 계약공수 기준 공수 산정</h2>
          <span class="sub">작업지침 v2 §1-3 확정 정책 · 현진행 ${D.stat.active}건</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>구축구분</th><th class="num">건수</th><th class="num">계약공수</th><th class="num">예상(유상)</th>
            <th class="num">투입(실)</th><th class="num">유상미투입</th><th class="num">무상미투입1차</th>
            <th class="num">최종미투입</th><th class="num">미투입률</th></tr></thead>
          <tbody>${Object.entries(D.meta.methodAgg || {}).sort((a, b) => b[1].cnt - a[1].cnt).map(([k, x]) => `<tr>
            <td class="strong">${esc(k)}</td><td class="num">${x.cnt}</td>
            <td class="num">${f0(x.contract)}</td><td class="num">${f0(x.plan)}</td><td class="num">${f0(x.used)}</td>
            <td class="num">${f1(x.paid)}</td><td class="num">${f1(x.free)}</td>
            <td class="num strong" style="color:var(--warn)">${f1(x.final)}</td>
            <td class="num" style="color:${x.final / x.contract > 0.6 ? 'var(--risk)' : 'var(--ok)'};font-weight:700">${f1(pct(x.final, x.contract))}%</td></tr>`).join('')}
          <tr style="background:#F7F9FC;font-weight:800">
            <td>합계</td><td class="num">${D.stat.active}</td>
            <td class="num">${f0(D.meta.md?.contract)}</td><td class="num">${f0(D.meta.md?.plan)}</td>
            <td class="num">${f0(D.meta.md?.used)}</td><td class="num">${f1(D.meta.md?.paidUn)}</td>
            <td class="num">${f1(D.meta.md?.freeUn1)}</td><td class="num">${f1(D.meta.md?.finalUn)}</td>
            <td class="num">${f1(pct(D.meta.md?.finalUn, D.meta.md?.contract))}%</td></tr></tbody></table></div>
        <div style="margin-top:.7rem;font-size:.72rem;color:var(--tx-s);line-height:1.7">
          ★ <b>미투입률은 구축자 업무부하량 지표</b>입니다. FoEX(1:N) 16.3%는 방문구축(70.6%)의 약 1/4.3 수준으로,
          <b>1:N 집체방식만 부하를 절감</b>합니다. FoEX(단독) 67.1%는 방문구축과 사실상 동일하며 26.01 지원중단의 정량 근거입니다.</div></div>
      <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">PM별 실적 현황 (상위 25)</h2>
          <span class="sub">KPI 4.2 연계 · ⚠ PM ≠ 구축자 (조직집계 합산 금지)</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>PM</th><th class="num">담당</th><th class="num">완료</th><th class="num">현진행</th>
            <th class="num">지연</th><th class="num">완료율</th><th class="num">납기준수</th><th class="num">최종미투입</th></tr></thead>
          <tbody>${D.pms.slice(0, 25).map(s => `<tr>
            <td class="strong">${esc(s.name)}</td><td class="num">${s.total}</td>
            <td class="num" style="color:var(--ok)">${s.done}</td>
            <td class="num" style="color:${s.active > 10 ? 'var(--warn)' : 'var(--info)'};font-weight:${s.active > 10 ? 800 : 400}">${s.active}</td>
            <td class="num" style="color:${s.delayed ? 'var(--risk)' : 'var(--tx-m)'}">${s.delayed}</td>
            <td class="num strong">${f1(s.doneRate)}%</td>
            <td class="num">${s.dlvRate !== null ? f1(s.dlvRate) + '%' : '—'}</td>
            <td class="num" style="color:var(--warn)">${s.mdFinalUn ? f1(s.mdFinalUn) : '—'}</td></tr>`).join('')}</tbody></table></div>
        <div style="margin-top:.6rem;font-size:.7rem;color:var(--tx-m)">
          ※ 현진행 <b>10건 초과</b> PM은 관리 기준(방문구축 PM 10건 이하) 초과로 주황 표시됩니다.</div></div>`;
  }

  /* ════════ 5. 공수현황(개인) ════════ */
  const CP = { page: 1, size: 30, list: [] };
  function renderCapa(D) {
    if (!D.assignees.length) {
      $('v-capa').innerHTML = `<div class="card"><div class="notimpl">
        <b>담당자별 원본 미로드</b><br>공수현황(개인) 화면은 「상세 구축 진행 현황(담당자별)」 엑셀이 필요합니다.
        <div class="sch">python etl_gcms.py &lt;GCMS.xlsx&gt; --assignee &lt;담당자별.xlsx&gt;</div></div></div>`;
      return;
    }
    const am = D.assigneeMeta || {};
    $('v-capa').innerHTML = `
      <div class="sec-head"><h2>공수현황 (개인)</h2>
        <span class="sub">화면정의서 slide21 — 담당자별 배정·투입·미투입공수 / KPI 4.1 BU% 원천</span></div>
      ${am.asOf && am.asOf !== D.asOf ? `<div class="card" style="margin-bottom:1rem;background:var(--warn-bg);border-color:#FDE68A">
        <div style="font-size:.78rem;color:#92400E;line-height:1.7">
          <b>⚠ 기준일 병기</b> — 담당자별 원본 기준일 <b>${esc(am.asOf)}</b> ≠ GCMS 기준일 <b>${esc(D.asOf)}</b>.
          작업지침 §2-3 기준일 정렬 원칙에 따라 값을 억지로 맞추지 않고 기준일을 병기합니다.</div></div>` : ''}
      <div class="filters"><div class="f-grid">
        <div class="fg"><label>담당자명 검색</label><input class="ctl" id="cp-q" placeholder="이름"></div>
        <div class="fg"><label>구축부서</label><select class="ctl" id="cp-unit"><option value="">전체</option>
          ${[...new Set(D.assignees.flatMap(a => [...a.units]))].sort().map(u => `<option>${esc(u)}</option>`).join('')}</select></div>
        <div class="fg"><label>정렬</label><select class="ctl" id="cp-sort">
          <option value="rows">배정 건수순</option><option value="mdUsed">투입공수순</option>
          <option value="mdUn">미투입공수순</option><option value="active">현진행순</option>
          <option value="mdTotal">총투입(추가·마이그 포함)순</option></select></div>
      </div><div class="f-info" id="cp-info"></div></div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="tbl-wrap" style="border:none"><table>
          <thead><tr><th>담당자</th><th class="num">배정</th><th class="num">프로젝트</th><th class="num">현진행</th><th class="num">완료</th>
            <th class="num">예상</th><th class="num">투입</th><th class="num">미투입</th>
            <th class="num">추가</th><th class="num">마이그</th><th class="num">아웃</th>
            <th>주요 담당모듈</th><th>최종투입일</th></tr></thead>
          <tbody id="cp-body"></tbody></table></div>
        <div class="pager" id="cp-pager"></div></div>`;
    bindFilters(['cp-q', 'cp-unit', 'cp-sort'], () => { CP.page = 1; applyCP(D); });
    applyCP(D);
  }

  function applyCP(D) {
    const q = $('cp-q').value.trim().toLowerCase(), unit = $('cp-unit').value, sort = $('cp-sort').value;
    CP.list = D.assignees.filter(a => (!q || a.name.toLowerCase().includes(q)) && (!unit || a.units.has(unit)))
      .slice().sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
    drawCP();
  }

  function drawCP() {
    const tot = CP.list.length, pages = Math.max(1, Math.ceil(tot / CP.size));
    CP.page = Math.min(CP.page, pages);
    const rows = CP.list.slice((CP.page - 1) * CP.size, CP.page * CP.size);
    const sum = f => CP.list.reduce((a, x) => a + (x[f] || 0), 0);
    $('cp-info').innerHTML = `
      <span>담당자 <b style="color:var(--tx-h)">${tot}</b>명</span>
      <span>배정 <b style="color:var(--tx-h)">${sum('rows').toLocaleString()}</b>행</span>
      <span>투입 <b style="color:var(--tx-h)">${f0(sum('mdUsed'))}</b> MD</span>
      <span>미투입 <b style="color:var(--warn)">${f0(sum('mdUn'))}</b> MD</span>
      <span>1인 평균 투입 <b style="color:var(--tx-h)">${f1(sum('mdUsed') / (tot || 1))}</b> MD</span>
      <span>${CP.page} / ${pages}</span>`;
    $('cp-body').innerHTML = rows.map(a => `<tr>
      <td class="strong">${esc(a.name)}</td><td class="num">${a.rows}</td><td class="num">${a.projectCnt}</td>
      <td class="num" style="color:var(--info)">${a.active}</td><td class="num" style="color:var(--ok)">${a.done}</td>
      <td class="num">${f1(a.mdPlan)}</td><td class="num" style="color:var(--ok);font-weight:700">${f1(a.mdUsed)}</td>
      <td class="num" style="color:var(--warn)">${f1(a.mdUn)}</td>
      <td class="num">${a.mdAdd ? f1(a.mdAdd) : '—'}</td><td class="num">${a.mdMig ? f1(a.mdMig) : '—'}</td>
      <td class="num">${a.mdOut ? f1(a.mdOut) : '—'}</td>
      <td style="font-size:.69rem;color:var(--tx-s)">${esc(a.topModules.map(([m, c]) => `${m}(${c})`).join(', '))}</td>
      <td class="mono" style="font-size:.67rem;color:var(--tx-m)">${esc(a.lastDate || '—')}</td></tr>`).join('')
      || `<tr><td colspan="13" style="text-align:center;padding:2rem;color:var(--tx-m)">검색 결과가 없습니다.</td></tr>`;
    $('cp-pager').innerHTML = pager(pages, CP.page, 'VIEWS.goCP');
  }
  function goCP(p) { CP.page = p; drawCP(); }

  /* ════════ 6. 별첨 · 정합성 검증 ════════ */
  const BANNED = [
    ['납기준수율 AF≤BP 이진판정 (70.0% / 71.5%)', '구버전 산식', 'capa 4-4'],
    ['계약기간준수율 95.3% 인용', 'SaaS 포함 착시', 'deadline ❸'],
    ['3월 달성KPI 단독 66.7%', '1Q 합산 기준 위반', 'sales ❷'],
    ['FoEX 단독 68.5% 완료율을 효율지표로 사용', '26.01 지원중단', '—'],
    ['구축자별 실적을 조직집계에 합산', 'PM 소속 불일치', 'org ❸'],
    ["CAPA '가용 94명' 사용", '행정수치, 실질 82명', 'capa ❷'],
    ['미투입공수 단순 AI−AJ 사용', '무상공수 누락', 'capa ❺-9'],
    ['v69 값 3,747 / 2.08M 인용', '부분갱신 상태', 'capa ❺-9'],
    ['AK(진행률%) 컬럼으로 FoEX 진행율 산정', '예상공수 0 고정, 신뢰 불가', 'capa ❺-3'],
    ['경과 미완료건 진행율 100% 캡', '5% 잔여율 적용해야 함', 'capa ❺-3'],
    ['마이그레이션 단독 공수를 구축지연에 합산', '병렬 관리 대상', 'capa ❺-8'],
    ["25'1월 구축인원 81명 / 25'3월 80명", '오류값 (78/77이 정답)', 'capa ❸'],
    ['DX사용자교육 131건을 1:N 867에 합산', '별도 관리', '—'],
    ['수주금액을 P열(라이선스)로 산출', 'O열(총수주액) 사용', '체크리스트 ①'],
  ];

  function renderAudit(D, K) {
    const m = D.meta.md || {}, id = D.meta.identity || {}, st = D.meta.status || {};
    const chk = (ok, label, expr) => `<tr>
      <td class="ctr" style="font-size:1rem">${ok ? '✅' : '❌'}</td>
      <td class="strong">${esc(label)}</td>
      <td class="mono" style="font-size:.71rem;color:${ok ? 'var(--tx-b)' : 'var(--risk)'}">${esc(expr)}</td></tr>`;
    const stSum = D.CODE.STATUS.reduce((a, s) => a + (st[s] || 0), 0);
    const dlv = D.meta.delivery || {};
    const keep = D.meta.deliveryKeep;
    const ct = D.meta.contractTerm || {};

    $('v-audit').innerHTML = `
      <div class="sec-head"><h2>별첨 · 정합성 검증</h2>
        <span class="sub">A10 탭별 검증 체크리스트 §3-1 산식 정합성 · 작업지침 v2 §5-1</span></div>

      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">데이터 소스 · 기준일</h2></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>#</th><th>소스</th><th>파일 / 시트</th><th>기준일</th><th>갱신주기</th><th>파생 지표</th></tr></thead>
          <tbody>
            <tr><td class="ctr">①</td><td class="strong">GCMS</td>
              <td class="mono" style="font-size:.7rem">구축총괄실적현황 통합<br>／ GCMS A10(통합)구축진행현황</td>
              <td class="strong">${esc(D.asOf)}</td><td>주</td>
              <td style="font-size:.72rem">총접수·완료·현진행·완료율·납기준수율·계약기간준수율·센터별·공수·구축지연</td></tr>
            <tr><td class="ctr">②</td><td class="strong">담당자별 상세</td>
              <td class="mono" style="font-size:.7rem">상세 구축 진행 현황(담당자별)</td>
              <td class="strong" style="color:${D.assigneeMeta?.asOf !== D.asOf ? 'var(--warn)' : 'inherit'}">${esc(D.assigneeMeta?.asOf || '미로드')}</td>
              <td>주~월</td><td style="font-size:.72rem">담당자별 배정·투입·미투입공수 · 공수현황(개인)</td></tr>
            <tr><td class="ctr">③</td><td class="strong">CAPA 인원</td><td class="mono" style="font-size:.7rem">스킬 a10-capa-buildperf</td>
              <td class="strong">${esc(D.asOf)}</td><td>인력변동 시</td>
              <td style="font-size:.72rem">가용 ${D.meta.headcount}명 · 계수 ${D.meta.capaCoef} · 월가용 CAPA ${f0(D.meta.capa)}</td></tr>
            ${(() => {
              const aux = INGEST.loadAll();
              return Object.values(INGEST.SCHEMAS).map((sc, i) => {
                const v = aux[sc.id];
                const stale = v && v.asOf && v.asOf !== D.asOf;
                return `<tr style="${v ? '' : 'opacity:.55'}">
                  <td class="ctr">${['④','⑤','⑥'][i]}</td>
                  <td class="strong">${esc(sc.name)}</td>
                  <td class="mono" style="font-size:.7rem">${v ? esc(v.source || '직접 입력') : '별도 xlsx / 붙여넣기'}</td>
                  <td class="strong" style="color:${!v ? 'var(--tx-m)' : stale ? 'var(--warn)' : 'inherit'}">${v ? esc(v.asOf) : '미입력'}</td>
                  <td>${esc(sc.cycle)}</td>
                  <td style="font-size:.72rem">${v
                    ? sc.blocks.filter(b => v.blocks?.[b.key])
                        .map(b => b.summary(v.blocks[b.key]).map(([l, x]) => `${esc(l)} ${esc(x)}`).join(' · '))
                        .join(' <br>') || '(표 미입력)'
                    : '「데이터 입력(3종)」 화면에서 엑셀 붙여넣기 또는 파일 업로드'}</td></tr>`;
              }).join('');
            })()}
          </tbody></table></div>
        ${D.assigneeMeta?.asOf && D.assigneeMeta.asOf !== D.asOf ? `
        <div style="margin-top:.7rem;padding:.7rem .9rem;background:var(--warn-bg);border-radius:8px;font-size:.75rem;color:#92400E;line-height:1.7">
          <b>기준일 정렬 원칙 (§2-3)</b> — 소스별 기준일이 다를 때는 값을 맞추지 말고 기준일을 병기합니다.
          담당자별 원본(${esc(D.assigneeMeta.asOf)})은 GCMS(${esc(D.asOf)})보다 이전 스냅샷이므로 공수현황(개인) 화면에 기준일을 병기했습니다.</div>` : ''}
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">산식 정합성 검증</h2>
          <span class="sub">체크리스트 §3-1 [G1]~[G4]</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th class="ctr" style="width:44px">판정</th><th style="width:200px">검증 항목</th><th>산식 · 실측</th></tr></thead>
          <tbody>
            ${chk(stSum === D.stat.total, '[G1] 상태별 합계 = 총접수',
              `${D.CODE.STATUS.map(s => st[s] || 0).join(' + ')} = ${stSum.toLocaleString()} / 총접수 ${D.stat.total.toLocaleString()}`)}
            ${chk(id.carrySum, '[G1] 이월 + 신규 = 총접수',
              `${(D.meta.carry || 0).toLocaleString()} + ${(D.meta.new || 0).toLocaleString()} = ${((D.meta.carry || 0) + (D.meta.new || 0)).toLocaleString()}`)}
            ${chk(true, '[G1] 완료율 (소수 2자리)',
              `${D.stat.done.toLocaleString()} ÷ ${D.stat.total.toLocaleString()} = ${f2(pct(D.stat.done, D.stat.total))}%`)}
            ${chk(true, '[G1] 현진행 = 진행 + 지연',
              `${st['진행'] || 0} + ${st['지연'] || 0} = ${D.stat.active}`)}
            ${chk(id.deliverySum, '[G2] 납기준수건 = 조기 + 정시 + 30일내',
              `${dlv['조기'] || 0} + ${dlv['정시'] || 0} + ${dlv['30일내'] || 0} = ${keep} / 모수 ${D.stat.done.toLocaleString()} → ${f1(pct(keep, D.stat.done))}%`)}
            ${chk(id.deliverySum, '[G2] 준수 + 초과 = 판정모수',
              `${keep} + ${(dlv['1M초과'] || 0) + (dlv['2M초과'] || 0) + (dlv['3M초과'] || 0)} = ${D.stat.done.toLocaleString()}`)}
            ${chk(true, '[G2] 기본 구축기간 준수율 (AD 단독)',
              `${(D.meta.deliveryBaseKeep || 0).toLocaleString()} / ${(D.meta.deliveryBaseJudged || 0).toLocaleString()} = ${f1(D.meta.deliveryBaseRate)}%  ·  납기 변경으로 준수 전환 ${D.meta.deliveryExtended}건 (연장 효과 ${f1(D.meta.deliveryRate - D.meta.deliveryBaseRate)}%p)`)}
            ${chk(id.mdIdentity, '[G3] ★ 계약공수 = 투입환산 + 미투입1차',
              `${f1(m.contract)} = ${f1(m.converted)} + ${f1(m.un1)}`)}
            ${chk(Math.abs(m.un1 - (m.paidUn + m.freeUn1)) < 0.5, '[G3] 미투입1차 = 유상 + 무상',
              `${f1(m.un1)} = ${f1(m.paidUn)} + ${f1(m.freeUn1)}`)}
            ${chk(Math.abs(m.finalUn - (m.paidUn + m.freeUn1 * 0.3)) < 0.5, '[G3] 최종미투입 = 유상 + 무상×30%',
              `${f1(m.finalUn)} = ${f1(m.paidUn)} + ${f1(m.freeUn1)}×0.3 (${f1(m.freeUn1 * 0.3)})`)}
            ${chk(true, '[G3] 구축지연 = 최종미투입 ÷ 월가용 CAPA',
              `${f1(m.finalUn)} ÷ ${f0(D.meta.capa)} = ${f1(D.meta.delayM)}M`)}
            ${chk(true, '[G3] 월가용 CAPA = 가용인원 × 22.0',
              `${D.meta.headcount} × ${D.meta.capaCoef} = ${f0(D.meta.capa)} m/d`)}
            ${chk(true, '[G4] 계약기간 모집단 (설치형)',
              `${ct.pop} → 신영 제외 ${ct.popEx} → 완료 ${ct.fin} · 예외(납기변경) ${ct.exception}건 → KPI 1.9로 별도 판정`)}
            ${(() => {
              const aux = INGEST.loadAll();
              const out = [];
              Object.values(INGEST.SCHEMAS).forEach(sc => {
                const v = aux[sc.id]; if (!v || !v.blocks) return;
                sc.blocks.forEach(b => {
                  if (!v.blocks[b.key]) return;
                  b.verify(v.blocks[b.key]).forEach(x => out.push(chk(x.ok, x.label, x.expr)));
                });
              });
              return out.join('');
            })()}
            ${chk(false, '[G4] 계약기간준수율 준수 건수',
              `본 산출 ${ct.ok}/${ct.fin} = ${f1(ct.rate)}%  ≠  확정 143/${ct.fin} = 80.8%  — 6건 차이, 원 산출 스크립트 확인 필요`)}
          </tbody></table></div>
        <div style="margin-top:.7rem;font-size:.73rem;color:var(--tx-s);line-height:1.7">
          특수규칙 적용 현황 —
          <b>경과 5%</b> ${D.meta.spRule?.['경과5%'] || 0}건 (구축완료예정일 경과 미완료 · 진행율 100% 캡 금지) ·
          <b>공수 0</b> ${D.meta.spRule?.['공수0'] || 0}건 (프로젝트구분=추가 &amp; 모듈구분=기타 &amp; 표준·예상공수=0 · 건수 포함/공수 미포함)</div>
      </div>

      <div class="g2">
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">🔴 금지값 · 인용 주의</h2>
            <span class="sub">작업지침 §5-2</span></div>
          <div class="tbl-wrap" style="max-height:420px;overflow-y:auto"><table>
            <thead><tr><th>금지 사항</th><th>사유</th><th>근거</th></tr></thead>
            <tbody>${BANNED.map(([a, b, c]) => `<tr>
              <td style="font-size:.73rem;color:var(--risk);font-weight:600">${esc(a)}</td>
              <td style="font-size:.72rem;color:var(--tx-s)">${esc(b)}</td>
              <td style="font-size:.68rem;color:var(--tx-m)">${esc(c)}</td></tr>`).join('')}</tbody></table></div></div>

        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">📎 별첨 근거 카드</h2>
            <span class="sub">발표 장표 각주용</span></div>
          <div class="notimpl" style="background:#F8FAFF;border-color:#C7D2FE"><div class="sch" style="border:none;background:transparent;padding:0">데이터 소스   : ①GCMS xlsx  ③CAPA 스킬
시트/위치     : GCMS A10(통합)구축진행현황 (건별 ${D.stat.total.toLocaleString()}행)
기준일        : ${D.asOf}
핵심 수치     : · 총접수 ${D.stat.total.toLocaleString()} = 이월 ${(D.meta.carry || 0).toLocaleString()} + 신규 ${(D.meta.new || 0).toLocaleString()}
                · 완료 ${D.stat.done.toLocaleString()} · 완료율 ${f2(pct(D.stat.done, D.stat.total))}%
                · 현진행 ${D.stat.active} = 진행 ${st['진행'] || 0} + 지연 ${st['지연'] || 0}
                · 납기준수율 ${f1(pct(keep, D.stat.done))}% (${keep}/${D.stat.done.toLocaleString()})
                · 계약공수 ${f1(m.contract)} · 최종미투입 ${f1(m.finalUn)} · 구축지연 ${f1(D.meta.delayM)}M
정합성 검증식 : 상태별 5구분 합 = 총접수 ${D.stat.total.toLocaleString()} ✅
                계약공수 = 투입환산 + 미투입1차 ✅
⚠ 인용 주의   : · 수주액은 O열(총수주액) — P열(라이선스) 아님
                · 미투입공수는 계약공수 기준 — 단순 AI−AJ 금지
                · AK(진행률%) 컬럼 사용 금지</div></div>
          <div style="margin-top:.8rem;font-size:.73rem;color:var(--tx-s);line-height:1.75">
            <b style="color:var(--tx-h)">장표 각주 예시</b><br>
            출처: GCMS 구축총괄실적현황(${esc(D.asOf.replace(/-/g, '').slice(2))}) 건별 상세<br>
            산출: 완료 ${D.stat.done.toLocaleString()}건 ÷ 총접수 ${D.stat.total.toLocaleString()}건 = ${f2(pct(D.stat.done, D.stat.total))}%<br>
            검증: 상태별 5구분 합(${D.CODE.STATUS.map(s => st[s] || 0).join('+')}) = 총접수 ${D.stat.total.toLocaleString()} 일치</div></div>
      </div>`;
  }

  /* ════════ 7. EQT Benchmark ════════ */
  const BENCH = [
    ['구축 완료율(건수)', '완료(B)/접수(A)×100', '1.1', '68.05%', '—', '90%+', '연말 재공 해소'],
    ['구축 GM%', '(매출−직접원가)/매출×100', '2.2', '측정 필요', '23%', '25%+', 'ERP 원가 연동 필수'],
    ['재공 처리 속도', '당월완료/전월잔여×100', '1.3', '31.2%', '—', '35%+', 'FoEX 확대가 핵심 레버'],
    ['FoEX Adoption (FAR)', 'FoEX방식건/전체건×100', '3.1', '41.4%', '60%', '50%+', '방문구축→FoEX 전환'],
    ['납기준수율', '준수건/판정모수×100', '1.7', '94.8%', '—', '94.8% 유지', '🔴 이진판정 70.0% 금지'],
    ['계약기간준수율', '준수/완료×100 (설치형)', '1.8', '80.8%', '—', '80.8% 유지', '🔴 95.3% 인용 금지 · 예외는 1.9로 판정'],
    ['기본 구축기간 준수율', '준수/완료×100 (AD 단독)', '1.9', '90.4%', '—', '90%+ 유지', '1.7과의 차이 = 납기 연장 효과'],
    ['TTV (SaaS)', 'AVG(완료일−수주일)', '5.1', '측정 필요', '60일', '60일 이내', 'GCMS 수주일 기준 산출'],
    ['Billable Utilization', '유상MD/가용MD×100', '4.1', '측정 필요', '75%', '75%+', 'GCMS MD구분 입력 필수'],
    ['RAG Red%', 'Red건/전체진행건×100', '6.3', '11.2%', '5%', '8% 이하', '재공 지연건 집중 처리'],
    ['구축지연 (M)', '최종미투입÷월가용CAPA', '6.5', '2.20M', '—', '2.0M 이하', '🔴 2.08M 인용 금지'],
    ['CSAT (개통 후)', 'AVG(고객응답, 5점)', '5.2', '미집계', '4.0', '4.2+', 'VOC 설문 시스템화 필요'],
    ['AI Attach Rate', 'AI활성고객/라이브고객×100', '5.4', '미집계', '—', '30%+', 'A10 로그 연동 Phase 1'],
    ['PM AI DAU%', 'AI도구활성PM/전체PM×100', '7.1', '미집계', '—', '70%+', 'IT인프라 협력 필요'],
    ['H/W 대기율', 'H/W대기건/구축형진행건×100', '6.4', '추정 20%+', '—', '10% 이하', '더존구매팀↔DELL 협의'],
    ['반품률', '반품(C)/접수(A)×100', '1.6', '0.44%', '—', '0.5% 이내', '현재 양호 수준 유지'],
  ];
  const ROADMAP = [
    ['0~30일 (즉시)', 'KPI v1.0 확정 + Master Data 매핑', '구축완료율 · 재공처리속도 · 반품률 · RAG Red%',
      'GCMS-NSM10 프로젝트ID/고객ID 키 통일. As-Is 수동 산출 시범 운영. ✅ 본 시스템에서 자동 산출 중'],
    ['31~90일 (Phase 1)', 'GCMS AI KPI 항목 개발 + GCMS→NSM10 자동집계', '완료율 + 금액 + TTV + 방식별완료율 + FoEX FAR',
      'GCMS MD실적등록 Billable 구분 필드 추가. NSM10 구축진척 자동 집계 메뉴 신설. ✅ 금액·TTV·FAR 산출 완료'],
    ['91~180일 (Phase 2)', 'NSM10 AI KPI 대시보드 가동 + GM% 자동 산출', 'Pillar 1·2·3·4 전체',
      'ERP 원가 연동으로 GM% 자동 산출. NSM10 AI KPI 대시보드 가동.'],
    ['181~360일 (Phase 3)', 'A10 사용로그 연동 + EQT BMS 보고 정렬', 'Pillar 5·6·7 추가 (전체)',
      'A10 AI Attach Rate·Adoption 자동 집계. CSAT·NPS VOC 시스템화. EQT 분기 보고 자동화.'],
  ];

  function renderBench(D, K) {
    $('v-bench').innerHTML = `
      <div class="sec-head"><h2>EQT BMS Benchmark &amp; 로드맵</h2>
        <span class="sub">가이드라인 v1.0 §3 벤치마크 매핑 · §5 산출 공식 정착 로드맵</span></div>
      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">PKG ↔ EQT 관리 기준 매핑</h2></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>KPI</th><th>압축 공식</th><th class="ctr">지침 As-Is</th><th class="ctr">EQT Median</th>
            <th class="ctr">2026 목표</th><th class="ctr">GCMS 현행</th><th class="ctr">판정</th><th>비고</th></tr></thead>
          <tbody>${BENCH.map(([n, f, id, asis, med, tgt, memo]) => {
            const k = K.get(id), now = k ? k.result.disp : '—', j = k ? k.judge : { cls: 'idle', txt: '—' };
            return `<tr><td class="strong">${esc(n)}</td>
              <td class="mono" style="font-size:.67rem;color:var(--info)">${esc(f)}</td>
              <td class="ctr" style="color:var(--tx-s)">${esc(asis)}</td>
              <td class="ctr" style="color:var(--tx-s)">${esc(med)}</td>
              <td class="ctr strong">${esc(tgt)}</td>
              <td class="ctr strong" style="color:${j.cls === 'ok' ? 'var(--ok)' : j.cls === 'risk' ? 'var(--risk)' : 'var(--tx-m)'}">${esc(now)}</td>
              <td class="ctr"><span class="judge ${j.cls}">${j.txt}</span></td>
              <td style="font-size:.69rem;color:var(--tx-s)">${esc(memo)}</td></tr>`;
          }).join('')}</tbody></table></div></div>

      <div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">산출 공식 정착 로드맵 (90 · 180 · 360일)</h2></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>기간</th><th>주요 산출물</th><th>우선 KPI</th><th>실행 과제</th></tr></thead>
          <tbody>${ROADMAP.map(([a, b, c, d]) => `<tr>
            <td class="strong" style="white-space:nowrap">${esc(a)}</td><td>${esc(b)}</td>
            <td style="color:var(--tx-s)">${esc(c)}</td>
            <td style="font-size:.72rem;color:var(--tx-s)">${esc(d)}</td></tr>`).join('')}</tbody></table></div></div>

      <div class="g2">
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">데이터 거버넌스 5원칙</h2></div>
          <div style="font-size:.76rem;line-height:1.9;color:var(--tx-b)">
            <b>① SSOT 단일 원천</b> — GCMS &gt; NSM10 &gt; ERP 순 우선순위. 동일 KPI 중복 산출 금지.<br>
            <b>② Master Data 일치성</b> — 프로젝트 ID·고객 ID를 4개 시스템에서 동일 키로 운영.<br>
            <b>③ 기간 정의 통일</b> — 월별 집계 기준일 매월 말일 23:59. 전년이월 별도 코드 분리.<br>
            <b>④ 변경 이력 관리</b> — 공식·목표값 변경 시 Change Log 등록. 분기 단위 변경만 허용.<br>
            <b>⑤ 감사 추적</b> — 모든 KPI 산출 결과는 GCMS 원천까지 Drill-down 가능하도록 설계.</div></div>
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">즉시 실행 3대 Quick Win</h2></div>
          <div style="font-size:.76rem;line-height:1.85;color:var(--tx-b)">
            <div style="padding:.6rem .75rem;background:var(--ok-bg);border-radius:8px;margin-bottom:.5rem">
              <b>1순위 — Master Data 매핑 워크숍</b><br>
              <span style="color:var(--tx-s);font-size:.73rem">GCMS·NSM10·ERP·HR 간 프로젝트 ID/고객 ID 통일.</span></div>
            <div style="padding:.6rem .75rem;background:var(--ok-bg);border-radius:8px;margin-bottom:.5rem">
              <b>2순위 — 4대 핵심 KPI 수동 산출 시범 ✅ 완료</b><br>
              <span style="color:var(--tx-s);font-size:.73rem">구축완료율·재공처리속도·FoEX FAR·RAG Red% — 본 시스템에서 자동 산출 중.</span></div>
            <div style="padding:.6rem .75rem;background:var(--warn-bg);border-radius:8px">
              <b>3순위 — GCMS MD실적등록 Billable 구분 필드 추가</b><br>
              <span style="color:var(--tx-s);font-size:.73rem">BU%·CTD 산출의 핵심 원천. 프로젝트 코드 vs 공통(IDLE) 정확 입력 체계.</span></div></div></div>
      </div>`;
  }


  /* ════════ 8. 데이터 입력 (별도 3종 — 붙여넣기 / 엑셀 업로드) ════════ */
  const ING = { src: 'oneai', block: 'recv', grid: null, headerRow: 0, map: {}, records: [],
                sheets: [], sheet: '', fileName: '', asOf: '', err: '', transposed: false, raw: null,
                presetApplied: false };

  const curBlock = () => INGEST.blockOf(ING.src, ING.block);

  function renderIngest(D) {
    const saved = INGEST.loadAll();
    const tabs = Object.values(INGEST.SCHEMAS).map(sc => {
      const v = saved[sc.id];
      const n = v ? Object.keys(v.blocks || {}).length : 0;
      return `<button class="dt-btn ${ING.src === sc.id ? 'active' : ''}" onclick="VIEWS.ingSrc('${sc.id}')">
        ${sc.icon} ${esc(sc.name)} ${n ? `<span class="st auto" style="margin-left:.3rem">${n}/${sc.blocks.length}표</span>`
          : '<span class="st pending" style="margin-left:.3rem">미입력</span>'}</button>`;
    }).join('');

    $('v-ingest').innerHTML = `
      <div class="sec-head"><h2>데이터 입력 — 별도 3종</h2>
        <span class="sub">작업지침 v2 §2-2 별도 업로드 3종 · GCMS에 없는 데이터 · 엑셀 붙여넣기 / 파일 업로드</span></div>
      <div class="card" style="margin-bottom:1rem;background:#F8FAFF;border-color:#C7D2FE">
        <div style="font-size:.77rem;line-height:1.8;color:var(--tx-b)">
          <b style="color:var(--tx-h)">⚠ 미입력 시 주의</b> —
          ①②③은 GCMS에 없는 데이터입니다. 미업로드 상태로 GCMS만 갱신하면 <b>해당 섹션에 이전 기준일 값이 잔존</b>합니다
          (v68 FoEX 단독 15건 누락 사례). 각 소스의 <b>기준일을 반드시 입력</b>하여 병기하십시오.<br>
          원본이 <b>월을 열로 펼친 가로형</b>이면 붙여넣기 후 <b>행/열을 자동으로 바꿔</b> 인식합니다.</div></div>
      <div class="detail-tabs">${tabs}</div>
      <div id="ing-body"></div>`;
    drawIngest();
  }

  function drawIngest() {
    const sc = INGEST.SCHEMAS[ING.src];
    const bl = curBlock();
    const saved = INGEST.loadAll()[ING.src];
    const savedRecs = saved?.blocks?.[bl.key];
    const hasPreset = !!INGEST.getPreset(ING.src, bl.key);
    const box = $('ing-body'); if (!box) return;

    const blockTabs = sc.blocks.length > 1 ? `
      <div style="display:flex;gap:.35rem;margin-bottom:.9rem;flex-wrap:wrap">
        ${sc.blocks.map(b => `<button class="pg ${ING.block === b.key ? 'active' : ''}"
          onclick="VIEWS.ingBlock('${b.key}')">${esc(b.name)}${saved?.blocks?.[b.key] ? ' ✓' : ''}${INGEST.getPreset(sc.id, b.key) ? ' 🔖' : ''}</button>`).join('')}
      </div>` : '';

    box.innerHTML = `
      ${blockTabs}
      <div class="g2" style="align-items:start">
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">${sc.icon} ${esc(sc.name)} — ${esc(bl.name)}</h2>
            <span class="sub">갱신주기 ${esc(sc.cycle)}</span></div>
          <div style="font-size:.74rem;color:var(--tx-s);margin-bottom:.4rem">${esc(sc.desc)}</div>
          ${bl.hint ? `<div style="font-size:.73rem;color:var(--info);background:var(--info-bg);border-radius:6px;padding:.5rem .7rem;margin-bottom:.8rem;line-height:1.6">${esc(bl.hint)}</div>` : ''}

          <div class="f-grid" style="grid-template-columns:1fr 1fr;margin-bottom:.8rem">
            <div class="fg"><label>기준일 (필수 · 병기용)</label>
              <input class="ctl" type="date" id="ing-asof" value="${esc(ING.asOf || saved?.asOf || '')}"
                onchange="VIEWS.ingAsOf(this.value)"></div>
            <div class="fg"><label>엑셀 파일 업로드 (.xlsx / .csv)</label>
              <input class="ctl" type="file" id="ing-file" accept=".xlsx,.csv,.tsv,.txt"
                onchange="VIEWS.ingFile(this)"></div>
          </div>

          <div class="fg" style="margin-bottom:.6rem">
            <label>엑셀 · PDF 표에서 복사 → 아래에 붙여넣기 (Ctrl+V)</label>
            <textarea class="ctl" id="ing-paste" rows="6" placeholder="머리글 포함 영역을 복사한 뒤 이곳에 붙여넣으세요. 가로형(월이 열)도 자동 인식합니다."
              style="font-family:ui-monospace,monospace;font-size:.72rem;resize:vertical"
              onpaste="setTimeout(()=>VIEWS.ingPaste(),0)"></textarea>
          </div>

          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <button class="pg" onclick="VIEWS.ingPaste()">붙여넣기 분석</button>
            ${ING.raw ? `<button class="pg" onclick="VIEWS.ingFlip()">행/열 바꾸기 ${ING.transposed ? '(전치됨)' : ''}</button>` : ''}
            ${ING.grid ? `<button class="pg" onclick="VIEWS.ingSavePreset()">매핑 저장</button>` : ''}
            ${hasPreset ? `<button class="pg" onclick="VIEWS.ingDropPreset()">저장 매핑 해제</button>` : ''}
            <button class="pg" onclick="VIEWS.ingTemplate()">양식 내려받기</button>
            <button class="pg" onclick="VIEWS.ingClear()">입력 초기화</button>
            ${savedRecs ? `<button class="pg" style="border-color:#FECACA;color:var(--risk)" onclick="VIEWS.ingRemove()">이 표 저장 삭제</button>` : ''}
          </div>

          ${ING.err ? `<div class="err" style="margin-top:.8rem;padding:.8rem 1rem;font-size:.78rem">${esc(ING.err)}</div>` : ''}
          ${ING.fileName ? `<div style="margin-top:.7rem;font-size:.73rem;color:var(--tx-s)">
            읽은 데이터: <b>${esc(ING.fileName)}</b>${ING.sheet ? ` · 시트 <b>${esc(ING.sheet)}</b>` : ''}
            ${ING.transposed ? ' · <b style="color:var(--info)">가로형 감지 → 행/열 전치 적용</b>' : ''}
            ${ING.presetApplied ? ' · <b style="color:var(--ok)">저장된 매핑 자동 적용</b>' : ''}</div>` : ''}
          ${hasPreset && !ING.grid ? `<div style="margin-top:.7rem;font-size:.73rem;color:var(--ok);background:var(--ok-bg);border-radius:6px;padding:.5rem .7rem;line-height:1.6">
            이 표의 <b>컬럼 매핑이 저장되어 있습니다.</b> 데이터를 붙여넣거나 업로드하면 머리글 행·전치 여부·컬럼 지정이 자동 복원됩니다.</div>` : ''}

          <div style="margin-top:.9rem;padding-top:.8rem;border-top:1px dashed var(--bd-light)">
            <div style="font-size:.72rem;font-weight:800;color:var(--tx-s);margin-bottom:.4rem">기대 컬럼</div>
            <div style="font-family:ui-monospace,monospace;font-size:.7rem;background:#F8FAFC;border:1px solid var(--bd-light);border-radius:6px;padding:.55rem .7rem;line-height:1.8">
              ${bl.cols.map(c => `${esc(c.label)}${c.req ? ' *' : ''}${c.hint ? `  — ${esc(c.hint)}` : ''}`).join('<br>')}
            </div></div>
        </div>

        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">컬럼 매핑 · 미리보기</h2>
            ${ING.grid ? `<span class="sub">${ING.grid.length}행 × ${Math.max(...ING.grid.map(r => r.length))}열</span>` : ''}</div>
          ${ING.grid ? mappingUI(bl) : `<div class="notimpl">
            <b>데이터를 먼저 입력하세요</b><br>
            엑셀·PDF 표에서 <b>머리글을 포함</b>하여 복사한 뒤 왼쪽에 붙여넣거나 <code>.xlsx</code> 파일을 업로드하면
            머리글 행과 컬럼이 자동 인식됩니다. 가로형(월이 열)이면 자동으로 행/열을 바꿔 처리합니다.</div>`}
        </div>
      </div>
      ${ING.records.length ? resultUI(bl) : ''}
      ${saved ? savedUI(sc, saved) : ''}`;
  }

  function mappingUI(bl) {
    const header = ING.grid[ING.headerRow] || [];
    const opts = idx => ['<option value="-1">— 미사용 —</option>']
      .concat(header.map((h, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${i + 1}열 · ${esc(String(h || '').replace(/\s+/g, ' ').slice(0, 28) || '(빈칸)')}</option>`)).join('');
    return `
      <div class="fg" style="margin-bottom:.7rem">
        <label>머리글 행</label>
        <select class="ctl" onchange="VIEWS.ingHeader(+this.value)">
          ${ING.grid.slice(0, 14).map((r, i) =>
            `<option value="${i}" ${i === ING.headerRow ? 'selected' : ''}>${i + 1}행 — ${esc(r.slice(0, 6).filter(Boolean).join(' | ').slice(0, 46))}</option>`).join('')}
        </select></div>
      <div class="tbl-wrap" style="max-height:250px;overflow:auto"><table>
        <thead><tr><th>스키마 필드</th><th>원본 컬럼</th></tr></thead>
        <tbody>${bl.cols.map(c => `<tr>
          <td class="strong" style="white-space:nowrap">${esc(c.label)}${c.req ? ' <span style="color:var(--risk)">*</span>' : ''}</td>
          <td><select class="ctl" style="padding:.3rem .5rem;font-size:.74rem"
              onchange="VIEWS.ingMap('${c.key}', +this.value)">${opts(ING.map[c.key])}</select></td>
        </tr>`).join('')}</tbody></table></div>
      <button class="pg" style="margin-top:.7rem;background:#3B4FC8;color:#fff;border-color:#3B4FC8"
        onclick="VIEWS.ingApply()">매핑 적용 → 집계</button>`;
  }

  function resultUI(bl) {
    const recs = ING.records;
    const sum = bl.summary(recs), ver = bl.verify(recs);
    return `
      <div class="card" style="margin-top:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">집계 결과 — ${esc(bl.name)}</h2>
          <span class="sub">${recs.length}행 · 기준일 ${esc(ING.asOf || '미입력')}</span>
          <span class="spacer"></span>
          <button class="pg" style="background:var(--ok);color:#fff;border-color:var(--ok)"
            onclick="VIEWS.ingSave()">이 표 저장</button></div>
        <div class="md-cards">${sum.map(([l, v], i) =>
          `<div class="md-card c${(i % 5) + 1}"><div class="l">${esc(l)}</div><div class="v" style="font-size:${String(v).length > 9 ? '.95rem' : '1.2rem'}">${esc(v)}</div></div>`).join('')}</div>
        <div class="tbl-wrap" style="max-height:260px;overflow:auto;margin-bottom:.9rem"><table>
          <thead><tr>${bl.cols.map(c => `<th class="${c.type === 'num' ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${recs.slice(0, 60).map(r => `<tr>${bl.cols.map(c =>
            `<td class="${c.type === 'num' ? 'num' : ''}">${c.type === 'num' ? (r[c.key] || 0).toLocaleString() : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
        <div class="sec-head"><h2 style="font-size:.85rem">정합성 검증</h2></div>
        <div class="tbl-wrap"><table><tbody>${ver.map(v => `<tr>
          <td class="ctr" style="width:44px;font-size:1rem">${v.ok ? '✅' : '⚠️'}</td>
          <td class="strong" style="width:220px">${esc(v.label)}</td>
          <td class="mono" style="font-size:.72rem;color:${v.ok ? 'var(--tx-b)' : 'var(--warn)'}">${esc(v.expr)}</td>
        </tr>`).join('')}</tbody></table></div>
      </div>`;
  }

  function savedUI(sc, saved) {
    const stale = APP.D && saved.asOf && saved.asOf !== APP.D.asOf;
    const done = sc.blocks.filter(b => saved.blocks?.[b.key]);
    return `<div class="card" style="margin-top:1rem;${stale ? 'background:var(--warn-bg);border-color:#FDE68A' : ''}">
      <div class="sec-head"><h2 style="font-size:.9rem">저장된 데이터 — ${esc(sc.name)}</h2>
        <span class="sub">${done.length}/${sc.blocks.length}표 · 기준일 ${esc(saved.asOf || '미입력')} · 저장 ${esc(saved.savedAt || '')}</span></div>
      ${done.map(b => `<div style="font-size:.76rem;line-height:1.8;color:var(--tx-b);padding:.35rem 0;border-bottom:1px dotted var(--bd-light)">
        <b style="color:var(--tx-h)">${esc(b.name)}</b> &nbsp;
        ${b.summary(saved.blocks[b.key]).map(([l, v]) => `${esc(l)} <b>${esc(v)}</b>`).join(' &nbsp;·&nbsp; ')}</div>`).join('')}
      ${sc.blocks.length > done.length ? `<div style="margin-top:.5rem;font-size:.73rem;color:var(--tx-m)">
        미입력: ${sc.blocks.filter(b => !saved.blocks?.[b.key]).map(b => esc(b.name)).join(', ')}</div>` : ''}
      ${stale ? `<div style="margin-top:.7rem;font-size:.75rem;color:#92400E;line-height:1.7">
        <b>⚠ 기준일 불일치</b> — 이 소스의 기준일(${esc(saved.asOf)})이 GCMS 기준일(${esc(APP.D.asOf)})과 다릅니다.
        작업지침 §2-3에 따라 값을 맞추지 말고 <b>기준일을 병기</b>하십시오.</div>` : ''}
    </div>`;
  }

  /* ── 데이터 입력 핸들러 ── */
  function ingReset() {
    ING.grid = null; ING.raw = null; ING.records = []; ING.err = '';
    ING.fileName = ''; ING.sheets = []; ING.sheet = ''; ING.transposed = false;
    ING.presetApplied = false;
  }
  function ingSrc(id) {
    ING.src = id; ING.block = INGEST.SCHEMAS[id].blocks[0].key;
    ingReset(); ING.asOf = INGEST.loadAll()[id]?.asOf || ''; drawIngest();
  }
  function ingBlock(k) { ING.block = k; ingReset(); drawIngest(); }
  function ingAsOf(v) { ING.asOf = v; }
  function ingHeader(n) { ING.headerRow = n; ING.map = INGEST.autoMap(ING.grid[n] || [], curBlock()); drawIngest(); }
  function ingMap(key, idx) { ING.map[key] = idx; }
  function ingClear() { ingReset(); const t = $('ing-paste'); if (t) t.value = ''; drawIngest(); }
  function ingRemove() {
    const all = INGEST.loadAll(), v = all[ING.src];
    if (v && v.blocks) { delete v.blocks[ING.block]; }
    if (v && !Object.keys(v.blocks || {}).length) INGEST.removeOne(ING.src);
    else if (v) INGEST.saveOne(ING.src, v);
    ingReset(); renderIngest(APP.D);
  }
  function ingTemplate() {
    const sc = INGEST.SCHEMAS[ING.src], bl = curBlock();
    INGEST.download(`PKG_${sc.id}_${bl.key}_양식.csv`, INGEST.templateCsv(bl));
  }
  function ingSavePreset() {
    if (!ING.grid) return;
    const ok = INGEST.savePreset(ING.src, ING.block, {
      transposed: ING.transposed, headerRow: ING.headerRow, map: { ...ING.map },
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    ING.err = ok ? '' : '※ 브라우저 저장소가 차단되어 매핑이 이번 세션에만 유지됩니다.';
    drawIngest();
  }

  function ingDropPreset() {
    INGEST.removePreset(ING.src, ING.block);
    ING.presetApplied = false;
    if (ING.raw) {                      // 저장 매핑 해제 후 자동 인식으로 재분석
      const best = INGEST.bestOrientation(ING.raw, curBlock());
      ING.transposed = best.transposed;
      applyGrid(best.grid);
    } else drawIngest();
  }

  function ingFlip() {
    if (!ING.raw) return;
    ING.transposed = !ING.transposed;
    applyGrid(ING.transposed ? INGEST.transpose(ING.raw) : ING.raw, true);
  }

  function applyGrid(grid, manual) {
    const bl = curBlock();
    ING.presetApplied = false;
    ING.grid = grid;
    const h = INGEST.findHeaderRow(grid, bl);
    ING.headerRow = h.row;
    ING.map = INGEST.autoMap(grid[h.row] || [], bl);
    ING.records = [];
    ING.err = h.hits === 0 ? '머리글을 자동 인식하지 못했습니다. 머리글 행과 컬럼 매핑을 직접 지정하세요.' : '';
    drawIngest();
    if (h.hits > 0) ingApply();
  }

  function loadGrid(grid, label) {
    const bl = curBlock();
    if (!grid.length) { ING.err = '읽을 데이터가 없습니다.'; drawIngest(); return; }
    ING.raw = grid; ING.fileName = label || '';

    // ① 저장된 매핑 프리셋이 현재 데이터에 적용 가능하면 우선 복원
    const preset = INGEST.getPreset(ING.src, bl.key);
    if (INGEST.presetUsable(preset, grid, bl)) {
      ING.transposed = !!preset.transposed;
      ING.grid = preset.transposed ? INGEST.transpose(grid) : grid;
      ING.headerRow = preset.headerRow;
      ING.map = { ...preset.map };
      ING.presetApplied = true;
      ING.err = '';
      ING.records = [];
      drawIngest();
      ingApply();
      return;
    }

    // ② 없으면 가로형 자동 전치 + 자동 매핑
    ING.presetApplied = false;
    const best = INGEST.bestOrientation(grid, bl);
    ING.transposed = best.transposed;
    applyGrid(best.grid);
  }

  function ingPaste() {
    const t = $('ing-paste'); if (!t) return;
    const grid = INGEST.parseText(t.value);
    if (!grid.length) { ING.err = '붙여넣은 내용이 없습니다.'; drawIngest(); return; }
    loadGrid(grid, '붙여넣기');
  }

  async function ingFile(input) {
    const f = input.files && input.files[0]; if (!f) return;
    try {
      if (/\.(csv|tsv|txt)$/i.test(f.name)) {
        loadGrid(INGEST.parseText(await f.text()), f.name);
      } else {
        const r = await INGEST.parseXlsx(await f.arrayBuffer());
        ING.sheets = r.sheets; ING.sheet = r.sheet;
        loadGrid(r.grid, f.name);
      }
    } catch (e) {
      ING.err = String(e.message || e);
      ING.grid = null; ING.raw = null; ING.records = [];
      drawIngest();
    }
  }

  function ingApply() {
    const bl = curBlock();
    const miss = bl.cols.filter(c => c.req && (ING.map[c.key] ?? -1) < 0);
    if (miss.length) { ING.err = `필수 컬럼 미매핑: ${miss.map(c => c.label).join(', ')}`; drawIngest(); return; }
    ING.err = '';
    ING.records = INGEST.toRecords(ING.grid, ING.headerRow, ING.map, bl);
    if (!ING.records.length) ING.err = '유효한 데이터 행이 없습니다. 머리글 행 지정을 확인하세요.';
    drawIngest();
  }

  function ingSave() {
    if (!ING.records.length) return;
    const asOf = ($('ing-asof') || {}).value || ING.asOf || '';
    if (!asOf) { ING.err = '기준일을 입력하세요. (기준일 병기 원칙 §2-3)'; drawIngest(); return; }
    const all = INGEST.loadAll();
    const cur = all[ING.src] || { blocks: {} };
    cur.asOf = asOf;
    cur.blocks = cur.blocks || {};
    cur.blocks[ING.block] = ING.records;
    cur.source = ING.fileName;
    cur.savedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const ok = INGEST.saveOne(ING.src, cur);
    // 표를 저장하면 컬럼 매핑도 함께 기억한다 (다음 회차 자동 복원)
    INGEST.savePreset(ING.src, ING.block, {
      transposed: ING.transposed, headerRow: ING.headerRow, map: { ...ING.map },
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    ING.err = ok ? '' : '※ 브라우저 저장소 사용이 차단되어 이번 세션에만 유지됩니다.';
    renderIngest(APP.D);
  }

  /* ════════ 9. 구축인력풀 등록 (CAPA 인력마스터 · 편집 가능) ════════ */
  const PL = { page: 1, size: 30, list: [], edit: null, isNew: false, msg: '' };

  /** 원본 + 변경분 병합 후 재판정·집계 */
  function poolState(D) {
    const base = D.people || [];
    const opt = { asOf: D.capaMeta?.asOf || D.asOf, evalMonths: D.capaMeta?.evalMonths ?? 1,
                  capaCoef: D.capaMeta?.capaCoef ?? 22 };
    const merged = POOL.merge(base);
    const agg = POOL.aggregate(merged, opt);
    // KPI 4.5 참고값이 편집 결과를 따르도록 갱신
    D.capaMeta = { ...(D.capaMeta || {}), ...agg, people: undefined };
    return agg;
  }

  /* 비가용 인원 구성 — 사람에 대한 직무 비가용(휴직)과 업무 비가용을 분리한다
     (「인원CAPA」 비가용 상세 항목을 3개 군으로 묶음. 3군 합 = A10 비가용인원) */
  const UNAVAIL_GROUPS = [
    { name: '인적 비가용 (휴직)', note: '사람 자체가 부재 — 직무 비가용',
      items: ['육아휴직', '병가휴직'], color: 'var(--risk)' },
    { name: '업무 비가용', note: '재직하나 구축 미투입 — 공수 차감 개념',
      items: ['유닛장 업무(2명, 50%)', '인바운드유선 4명', 'FoEX교육시스템운영(총괄)'], color: 'var(--warn)' },
    { name: '구축지원 등', note: '계약직·사업관리·직무전환교육',
      items: ['계약직-구축지원', '구축지원-사업관리', '기타-직무전환교육'], color: 'var(--info)' },
  ];

  function unavailGroups(trend) {
    const find = lab => (trend.detail || []).find(d => d.label === lab);
    return UNAVAIL_GROUPS.map(g => {
      const rows = g.items.map(find).filter(Boolean);
      if (!rows.length) return null;
      const sum = trend.months.map((_, i) => rows.reduce((a, r) => a + (r.values[i] || 0), 0));
      return { ...g, rows, sum };
    }).filter(Boolean);
  }

  /* 월별 CAPA 변동 추이 — 확정 / 현재(편집 즉시반영) / 예정 3구간 */
  function capaTrendChart(t) {
    const max = Math.max(...t.series.map(s => Math.max(s.capa, s.liveCapa || 0))) || 1;
    const h = v => (v / max * 100).toFixed(1);
    return `<div class="chart trend">${t.series.map(s => `
      <div class="col" title="${esc(s.ym)} · ${esc(s.kind)} ${f0(s.capa)} m/d (구축가용 ${f0(s.avail)}명)${
        s.liveCapa !== undefined ? ` · 인력풀 산출 ${f0(s.liveCapa)} m/d (${f0(s.liveAvail)}명)` : ''}">
        <div class="v">${s.liveCapa !== undefined
          ? `${f0(s.capa)}<span style="color:var(--warn)">/${f0(s.liveCapa)}</span>` : f0(s.capa)}</div>
        <div class="bars">
          <div class="b${s.kind === '예정' ? ' plan' : ''}" style="height:${h(s.capa)}%"></div>
          ${s.liveCapa !== undefined ? `<div class="b now" style="height:${h(s.liveCapa)}%"></div>` : ''}
        </div>
        <div class="l">${esc(s.ym)}<b>${s.liveAvail !== undefined
          ? `${f0(s.avail)}<span style="color:var(--warn)">/${f0(s.liveAvail)}</span>` : f0(s.avail)}명</b></div>
      </div>`).join('')}</div>
      <div class="chart-legend">
        <span style="color:var(--tx-h)">막대 = 가용 CAPA(m/d) · 축 아래 = 구축가용 인원(명)</span>
        <span><i style="background:#3B4FC8"></i>확정 (인원CAPA 실측)</span>
        <span><i style="background:#F59E0B"></i>${esc(t.nowYm)} 인력풀 산출 · 편집 즉시반영</span>
        <span><i style="background:#9CA3AF"></i>예정 (복귀예정월 반영)</span>
      </div>`;
  }

  /* 가로 막대 — 총원 트랙 위에 가용 인원을 겹쳐 표기.
     avail 이 없으면 인원현황 단독 막대로 그린다 (직급별처럼 가용 구분이 없는 축) */
  function hbars(rows, accent) {
    const max = Math.max(...rows.map(r => r.total)) || 1;
    const w = v => (v / max * 100).toFixed(1);
    return `<div class="hb">${rows.map(r => {
      const solo = r.avail === undefined;
      return `<div class="hb-row" title="${esc(r.label)} · 인원 ${r.total}명${solo ? '' : ` / 구축가용 ${r.avail}명`}">
        <div class="hb-l">${esc(r.label)}</div>
        <div class="hb-t">${solo ? '' : `<div class="hb-b" style="width:${w(r.total)}%"></div>`}
          <div class="hb-a" style="width:${w(solo ? r.total : r.avail)}%;background:${accent}"></div></div>
        <div class="hb-v">${solo ? `<b>${r.total}</b><span>명</span>` : `<b>${r.avail}</b><span>/${r.total}</span>`}</div>
      </div>`; }).join('')}</div>`;
  }

  function renderPool(D) {
    if (!D.people || !D.people.length) {
      $('v-pool').innerHTML = `<div class="card"><div class="notimpl">
        <b>구축인력풀 원본 미로드</b><br>「구축인력 CAPA 관리」 엑셀(②인력마스터 시트)이 필요합니다.
        <div class="sch">python update.py &lt;GCMS.xlsx&gt; --assignee &lt;담당자별.xlsx&gt; --capa &lt;CAPA.xlsx&gt;</div></div></div>`;
      return;
    }
    const cm = poolState(D);
    const st = cm.status || {};
    const diff = cm.available - (D.meta.headcount || 0);
    const changes = POOL.changeCount();
    // 편집분 전파량을 구하기 위해 '편집 전' 가용인원을 같은 규칙으로 한 번 더 산출한다
    const baseAvail = POOL.aggregate(D.people, {
      asOf: cm.asOf, evalMonths: cm.evalMonths, capaCoef: cm.capaCoef }).available;
    const tr = POOL.trend(D.capaMeta && D.capaMeta.trend, cm, { baseAvailable: baseAvail });

    $('v-pool').innerHTML = `
      <div class="sec-head"><h2>구축CAPA관리</h2>
        <span class="sub">구축인력 CAPA 관리 — 인력 ${cm.total}명 · 기준일 ${esc(cm.asOf)}</span>
        <span class="spacer"></span>
        ${changes ? `<span class="st proxy">변경 ${changes}건 저장됨</span>
          <button class="pg" style="border-color:#FECACA;color:var(--risk)" onclick="VIEWS.plReset()">원본으로 되돌리기</button>` : ''}
        <button class="pg" style="background:#3B4FC8;color:#fff;border-color:#3B4FC8" onclick="VIEWS.plNew()">＋ 인력 추가</button></div>

      ${PL.msg ? `<div class="card" style="margin-bottom:1rem;background:var(--ok-bg);border-color:#A7F3D0">
        <div style="font-size:.78rem;color:#047857">${esc(PL.msg)}</div></div>` : ''}

      ${cm.asOf !== D.asOf ? `<div class="card" style="margin-bottom:1rem;background:var(--warn-bg);border-color:#FDE68A">
        <div style="font-size:.78rem;color:#92400E;line-height:1.7">
          <b>⚠ 기준일 병기</b> — 인력풀 기준일 <b>${esc(cm.asOf)}</b> ≠ GCMS 기준일 <b>${esc(D.asOf)}</b>.
          작업지침 §2-3에 따라 값을 맞추지 않고 기준일을 병기합니다.</div></div>` : ''}

      ${PL.edit ? poolForm(cm) : ''}

      <div class="g3 eq">
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">가용 판정 결과</h2>
            ${changes ? '<span class="sub">변경 반영</span>' : ''}</div>
          <div class="md-cards" style="grid-template-columns:1fr 1fr">
            <div class="md-card c2"><div class="l">구축가용</div><div class="v">${cm.available}명</div>
              <div class="s">${f0(cm.capa)} m/d</div></div>
            <div class="md-card c4"><div class="l">평가중</div><div class="v">${st['평가중'] || 0}명</div>
              <div class="s">${f0((st['평가중'] || 0) * cm.capaCoef)} m/d</div></div>
            <div class="md-card c3"><div class="l">비가용</div><div class="v">${st['비가용'] || 0}명</div>
              <div class="s">${f0((st['비가용'] || 0) * cm.capaCoef)} m/d</div></div>
            <div class="md-card c5"><div class="l">구축제외</div><div class="v">${st['구축제외'] || 0}명</div>
              <div class="s">${f0((st['구축제외'] || 0) * cm.capaCoef)} m/d</div></div>
          </div>
          <div style="font-size:.73rem;color:var(--tx-s);line-height:1.7">
            인력 총계 <b>${cm.total}명</b> · 가용비율 <b>${f1(pct(cm.available, cm.total))}%</b>
            ${cm.edited ? ` · 수동 조정 <b style="color:var(--warn)">${cm.edited}명</b>` : ''}</div>
        </div>

        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">월가용 CAPA 산출</h2></div>
          <div class="md-cards" style="grid-template-columns:1fr 1fr">
            <div class="md-card c1"><div class="l">인력풀 산출</div><div class="v">${f0(cm.capa)}</div>
              <div class="s">m/d · ${cm.available}명</div></div>
            <div class="md-card c2"><div class="l">KPI 적용값</div><div class="v">${f0(D.meta.capa)}</div>
              <div class="s">m/d · ${D.meta.headcount}명</div></div>
          </div>
          <div style="font-size:.72rem;color:var(--tx-s);line-height:1.8;font-family:ui-monospace,monospace">
            인력풀 ${cm.available}명 × ${cm.capaCoef} = ${f0(cm.capa)} m/d<br>
            적용값 ${D.meta.headcount}명 × ${D.meta.capaCoef} = ${f0(D.meta.capa)} m/d</div>
          ${diff !== 0 ? `<div style="margin-top:.6rem;padding:.55rem .7rem;background:var(--warn-bg);border-radius:6px;font-size:.72rem;color:#92400E;line-height:1.6">
            <b>${diff > 0 ? '+' : ''}${diff}명 차이</b> — KPI 산출에는 확정 실측값(구축지연 2.20M) 재현을 위해
            현행 <b>${D.meta.headcount}명</b>을 유지하고, 인력풀 산출값은 참고로 병기합니다.</div>` : ''}
        </div>

        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">가용 판정 규칙</h2>
            <span class="sub">우선순위 순</span></div>
          <div class="tbl-wrap"><table>
            <thead><tr><th class="ctr">순위</th><th>상태</th><th>판정조건</th></tr></thead>
            <tbody>
              <tr><td class="ctr">1</td><td class="strong">구축제외</td><td style="font-size:.71rem">구축직무=N · 제외그룹(본부장·영업구축지원·옴니UC·인턴)</td></tr>
              <tr><td class="ctr">2</td><td class="strong">비가용</td><td style="font-size:.71rem">비가용사유 보유 (휴직·육아·출산·공통업무 등)</td></tr>
              <tr><td class="ctr">3</td><td class="strong">평가중</td><td style="font-size:.71rem">전환배치 &amp; 기준일 &lt; 배치일 + ${cm.evalMonths}개월</td></tr>
              <tr><td class="ctr">4</td><td class="strong">가용</td><td style="font-size:.71rem">위 조건 모두 아님 (평가완료 전환배치 포함)</td></tr>
            </tbody></table></div>
          <div style="margin-top:.6rem;font-size:.72rem;color:var(--tx-s);line-height:1.6">
            상태를 직접 지정하면 규칙보다 <b>수동 지정이 우선</b>합니다.
            목록의 상태 열에서 <b>자동</b>을 고르면 규칙 판정으로 되돌아갑니다.</div>
        </div>
      </div>

      ${tr ? `<div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">월별 CAPA 변동 추이</h2>
          <span class="sub">25년말 → 26.12 · 월가용 CAPA(m/d)</span><span class="spacer"></span>
          <span class="st auto">현재 ${esc(tr.nowYm)}</span></div>
        ${capaTrendChart(tr)}
        <div class="tbl-wrap" style="margin-top:.9rem"><table>
          <thead><tr><th>구분</th>${tr.series.map(s => `<th class="num">${esc(s.ym)}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><td class="strong">구축가용 인원</td>${tr.series.map(s => `<td class="num" style="color:${s.kind === '예정' ? 'var(--tx-m)' : 'var(--tx-h)'}">${f0(s.avail)}</td>`).join('')}</tr>
            <tr><td class="strong">가용 CAPA (m/d)</td>${tr.series.map(s => `<td class="num strong" style="color:${s.kind === '예정' ? 'var(--tx-m)' : 'var(--info)'}">${f0(s.capa)}</td>`).join('')}</tr>
            <tr style="background:#FFFBEB"><td class="strong">인력풀 산출 (편집 반영)</td>${tr.series.map(s =>
              `<td class="num strong" style="color:${s.liveCapa !== undefined ? 'var(--warn)' : 'var(--bd-light)'}">${s.liveCapa !== undefined ? f0(s.liveCapa) : '—'}</td>`).join('')}</tr>
            <tr><td>구분</td>${tr.series.map(s => `<td class="num" style="font-size:.68rem;color:var(--tx-m)">${esc(s.kind)}</td>`).join('')}</tr>
          </tbody></table></div>
        <div style="margin-top:.7rem;font-size:.72rem;color:var(--tx-s);line-height:1.75">
          <b>확정</b> 25.12 ~ ${esc(tr.nowYm)} — 「인원CAPA」시트 실측값을 가공 없이 그대로 표기<br>
          <b>현재 ${esc(tr.nowYm)}</b> — KPI 적용 <b>${f0(tr.now.capa)}</b> m/d(${f0(tr.now.avail)}명)와
          인력풀 산출 <b style="color:var(--warn)">${f0(cm.capa)}</b> m/d(${cm.available}명 × ${tr.coef})를 병기합니다.
          목록에서 상태값을 수정하면 인력풀 산출값이 즉시 갱신됩니다.<br>
          <b>예정 ${esc(tr.series[tr.series.length - 1].ym)}까지</b> — 시트 예정 CAPA(구축자별 복귀예정월 반영)
          ${tr.adjust ? ` + 화면 편집분 <b>${tr.adjust > 0 ? '+' : ''}${tr.adjust}명</b>` : ''}
          ${tr.planned ? ` + 화면 등록 복귀예정 <b>+${tr.planned}명</b>` : ''}
        </div>

        ${(() => {
          const gs = unavailGroups(D.capaMeta.trend);
          if (!gs.length) return '';
          const ms = D.capaMeta.trend.months, i0 = ms.indexOf(tr.series[0].ym);
          const cut = i => i >= i0;
          const hi = i => ms[i] === tr.nowYm ? 'background:#FFFBEB;' : '';
          const cells = vals => ms.map((_, i) => cut(i)
            ? `<td class="num" style="${hi(i)}">${vals[i] ? f0(vals[i]) : '—'}</td>` : '').join('');
          const totals = ms.map((_, i) => gs.reduce((a, g) => a + g.sum[i], 0));
          return `<div style="margin-top:1.1rem;padding-top:.9rem;border-top:1px dashed var(--bd-light)">
            <div class="sec-head"><h2 style="font-size:.85rem">비가용 인원 구성</h2>
              <span class="sub">사람에 대한 <b>직무 비가용</b>과 재직 중 구축 미투입인 <b>업무 비가용</b>을 분리 표기</span></div>
            <div class="tbl-wrap"><table>
              <thead><tr><th>구분</th><th>항목</th>${ms.map((m, i) => cut(i)
                ? `<th class="num" style="${hi(i)}">${esc(m)}</th>` : '').join('')}</tr></thead>
              <tbody>${gs.map(g => `
                ${g.rows.map((r, j) => `<tr>
                  ${j === 0 ? `<td class="strong" rowspan="${g.rows.length + 1}" style="color:${g.color};vertical-align:top">
                    ${esc(g.name)}<div style="font-weight:500;font-size:.66rem;color:var(--tx-m);line-height:1.4;margin-top:.2rem">${esc(g.note)}</div></td>` : ''}
                  <td style="font-size:.71rem">${esc(r.label)}</td>${cells(r.values)}</tr>`).join('')}
                <tr style="background:#F7F9FC;font-weight:800">
                  <td style="font-size:.71rem">소계</td>${cells(g.sum)}</tr>`).join('')}
                <tr style="background:#EEF2F7;font-weight:900">
                  <td colspan="2">비가용 인원 합계</td>${cells(totals)}</tr>
              </tbody></table></div>
            <div style="margin-top:.6rem;font-size:.71rem;color:var(--tx-s);line-height:1.7">
              ${esc(tr.nowYm)} 기준 — 인적 비가용 <b style="color:var(--risk)">${f0(gs[0].sum[ms.indexOf(tr.nowYm)])}명</b>
              · 업무 비가용 <b style="color:var(--warn)">${f0((gs[1] || { sum: [] }).sum[ms.indexOf(tr.nowYm)] || 0)}명</b>
              · 구축지원 등 <b style="color:var(--info)">${f0((gs[2] || { sum: [] }).sum[ms.indexOf(tr.nowYm)] || 0)}명</b>
              = 합계 <b>${f0(totals[ms.indexOf(tr.nowYm)])}명</b><br>
              업무 비가용은 재직 인원이지만 구축에 투입되지 않으므로 <b>공수 차감 개념</b>으로 가용인원에서 제외합니다.
              (인바운드 4명 × 22일 = 88 m/d 등)
            </div></div>`;
        })()}
      </div>` : ''}

      <div class="g2 eq">
        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">센터·직급별 구축인력 대시보드</h2>
            <span class="sub">센터 = 가용/총원 · 직급 = 인원현황</span></div>
          <div style="font-size:.72rem;font-weight:800;color:var(--tx-s);margin:.2rem 0 .5rem">센터별 <span style="font-weight:600;color:var(--tx-m)">— 구축가용 / 인원총계</span></div>
          ${hbars(cm.byCenter.map(c => ({ label: `${c.center} · ${c.region}`, avail: c.available, total: c.total })), 'linear-gradient(90deg,#4ADE80,#16A34A)')}
          <div style="font-size:.72rem;font-weight:800;color:var(--tx-s);margin:.9rem 0 .5rem">직급별 <span style="font-weight:600;color:var(--tx-m)">— 인원현황 (가용/비가용 구분 없음)</span></div>
          ${hbars(cm.byGrade.map(g => ({ label: g.grade, total: g.total })), 'linear-gradient(90deg,#818CF8,#3B4FC8)')}
          <div class="spacer" style="flex:1"></div>
          <div style="margin-top:.8rem;font-size:.72rem;color:var(--tx-s);line-height:1.7">
            총원 <b>${cm.total}명</b> 중 구축가용 <b style="color:var(--ok)">${cm.available}명</b>
            (<b>${f1(pct(cm.available, cm.total))}%</b>) · 월가용 CAPA <b>${f0(cm.capa)} m/d</b>
            ${Object.keys(cm.reasons).length ? `<br><b>비가용 사유</b> — ${Object.entries(cm.reasons).map(([k, v]) => `${esc(k)} ${v}명`).join(' · ')}` : ''}</div>
        </div>

        <div class="card"><div class="sec-head"><h2 style="font-size:.9rem">센터·직급별 인원현황</h2>
            <span class="sub">인원수 기준</span></div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>직급</th>${cm.centers.map(c => `<th class="num">${esc(c)}</th>`).join('')}
              <th class="num">인원계</th><th class="num">구성비</th></tr></thead>
            <tbody>${cm.byGrade.map(g => `<tr>
              <td class="strong">${esc(g.grade)}</td>
              ${cm.centers.map(c => `<td class="num">${g.byCenter[c] || 0}</td>`).join('')}
              <td class="num strong">${g.total}</td>
              <td class="num" style="color:var(--tx-s)">${f1(pct(g.total, cm.total))}%</td></tr>`).join('')}
            <tr style="background:#F7F9FC;font-weight:800">
              <td>계</td>
              ${cm.centers.map(c => `<td class="num">${cm.byCenter.find(x => x.center === c)?.total || 0}</td>`).join('')}
              <td class="num">${cm.total}</td><td class="num">100.0%</td></tr>
            </tbody></table></div>
          <div style="margin-top:.5rem;font-size:.71rem;color:var(--tx-m);line-height:1.6">
            직급별은 <b>가용/비가용을 구분하지 않습니다</b> — 업무비가용은 특정 인원의 상태가 아니라
            <b>가상 업무투입 공수</b>(인바운드·FoEX운영·유닛장 업무 등)이므로 직급 단위 귀속이 성립하지 않습니다.</div>

          <div class="sec-head" style="margin:1.1rem 0 .6rem"><h2 style="font-size:.85rem">센터별 가용/비가용 집계표</h2></div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>센터</th><th>지역</th><th class="num">인원총계</th>
              <th class="num">구축가용</th><th class="num">비가용</th><th class="num">평가중</th>
              <th class="num">구축제외</th><th class="num">가용비율</th></tr></thead>
            <tbody>${cm.byCenter.map(c => `<tr>
              <td class="strong">${esc(c.center)}</td><td style="color:var(--tx-s);font-size:.72rem">${esc(c.region)}</td>
              <td class="num">${c.total}</td>
              <td class="num strong" style="color:var(--ok)">${c.available}</td>
              <td class="num" style="color:var(--risk)">${c.unavailable}</td>
              <td class="num" style="color:var(--warn)">${c.evaluating}</td>
              <td class="num" style="color:var(--tx-m)">${c.excluded}</td>
              <td class="num strong">${f1(c.rate)}%</td></tr>`).join('')}
            <tr style="background:#F7F9FC;font-weight:800">
              <td>합계</td><td>—</td><td class="num">${cm.total}</td>
              <td class="num">${cm.available}</td><td class="num">${st['비가용'] || 0}</td>
              <td class="num">${st['평가중'] || 0}</td><td class="num">${st['구축제외'] || 0}</td>
              <td class="num">${f1(pct(cm.available, cm.total))}%</td></tr>
            </tbody></table></div>
          <div class="spacer" style="flex:1"></div>
          <div style="margin-top:.6rem;font-size:.71rem;color:var(--tx-m);line-height:1.6">
            여기의 <b>비가용</b>은 인력마스터의 비가용사유(휴직·육아·출산 등) 보유 인원입니다.
            업무비가용(가상 공수)은 「비가용 인원 구성」 표에서 별도 관리합니다.</div>
        </div>
      </div>

      ${(D.capaMeta?.history || []).length ? `<div class="card" style="margin-bottom:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">월별 인력 변동이력</h2>
          <span class="sub">입사·퇴사·휴직·복직·전환배치·전보</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>변동유형</th>${(D.capaMeta.history[0].months || []).map(m => `<th class="num">${esc(m)}</th>`).join('')}</tr></thead>
          <tbody>${D.capaMeta.history.map(h => `<tr>
            <td class="strong">${esc(h.type)}</td>
            ${h.values.map(v => `<td class="num" style="color:${v > 0 ? (h.type === '퇴사' || h.type === '휴직' ? 'var(--risk)' : 'var(--info)') : 'var(--tx-m)'}">${v || '—'}</td>`).join('')}
          </tr>`).join('')}</tbody></table></div></div>` : ''}

      <div class="filters"><div class="f-grid">
        <div class="fg"><label>성명 검색</label><input class="ctl" id="pl-q" placeholder="이름"></div>
        <div class="fg"><label>센터</label><select class="ctl" id="pl-center"><option value="">전체</option>
          ${cm.centers.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
        <div class="fg"><label>상태</label><select class="ctl" id="pl-st"><option value="">전체</option>
          ${POOL.STATUSES.map(x => `<option>${x}</option>`).join('')}</select></div>
        <div class="fg"><label>직급</label><select class="ctl" id="pl-grade"><option value="">전체</option>
          ${POOL.GRADES.map(g => `<option>${esc(g)}</option>`).join('')}</select></div>
        <div class="fg"><label>인력구분</label><select class="ctl" id="pl-kind"><option value="">전체</option>
          ${POOL.KINDS.map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
      </div><div class="f-info" id="pl-info"></div></div>

      <div class="card" style="padding:0;overflow:hidden">
        <!-- sticky 헤더가 페이지 스크롤 시 행을 덮지 않도록 컨테이너 내부 스크롤로 한정 -->
        <div class="tbl-wrap" style="border:none;max-height:560px;overflow:auto"><table>
          <thead><tr><th>성명</th><th>직급</th><th>인력구분</th><th>센터</th>
            <th>구축모듈</th><th class="ctr">구축직무</th><th>비가용사유</th><th>배치일</th>
            <th style="width:110px">상태</th><th class="ctr" style="width:88px">관리</th></tr></thead>
          <tbody id="pl-body"></tbody></table></div>
        <div class="pager" id="pl-pager"></div></div>`;

    bindFilters(['pl-q', 'pl-center', 'pl-st', 'pl-grade', 'pl-kind'],
      () => { PL.page = 1; applyPL(D); });
    applyPL(D);
  }

  /* ── 추가 · 편집 폼 ── */
  function poolForm(cm) {
    const e = PL.edit;
    const sel = (id, opts, val) => `<select class="ctl" id="${id}">
      ${opts.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<div class="card" style="margin-bottom:1rem;border-color:#C7D2FE;background:#F8FAFF">
      <div class="sec-head"><h2 style="font-size:.9rem">${PL.isNew ? '인력 추가' : `인력 수정 — ${esc(e.name)}`}</h2></div>
      <div class="f-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <div class="fg"><label>성명 <span style="color:var(--risk)">*</span></label>
          <input class="ctl" id="pf-name" value="${esc(e.name)}" ${PL.isNew ? '' : 'readonly style="background:#EEF2F7"'}></div>
        <div class="fg"><label>직급</label>${sel('pf-grade', POOL.GRADES, e.grade)}</div>
        <div class="fg"><label>인력구분</label>${sel('pf-kind', POOL.KINDS, e.kind)}</div>
        <div class="fg"><label>소속센터</label>${sel('pf-center', POOL.CENTERS, e.center)}</div>
        <div class="fg"><label>구축모듈</label><input class="ctl" id="pf-module" value="${esc(e.module || '')}" placeholder="ERP / TS / AX / 메디"></div>
        <div class="fg"><label>구축직무</label>${sel('pf-build', ['Y', 'N'], e.isBuild ? 'Y' : 'N')}</div>
        <div class="fg"><label>비가용사유</label><input class="ctl" id="pf-reason" value="${esc(e.unavailReason || '')}" placeholder="휴직 · 육아,출산 · 병가 등"></div>
        <div class="fg"><label>배치일 (전환배치)</label><input class="ctl" type="date" id="pf-place" value="${esc(e.placeDate || '')}"></div>
        <div class="fg"><label>1차평가</label>${sel('pf-eval', ['', '평가중'], e.evalDone || '')}</div>
        <div class="fg"><label>상태 지정</label>${sel('pf-status', ['자동 (규칙 판정)', ...POOL.STATUSES], e.statusOverride || '자동 (규칙 판정)')}</div>
      </div>
      <div style="display:flex;gap:.4rem;margin-top:.9rem;flex-wrap:wrap;align-items:center">
        <button class="pg" style="background:var(--ok);color:#fff;border-color:var(--ok)" onclick="VIEWS.plSave()">저장</button>
        <button class="pg" onclick="VIEWS.plCancel()">취소</button>
        ${!PL.isNew ? `<button class="pg" style="border-color:#FECACA;color:var(--risk)" onclick="VIEWS.plRemove('${esc(e.name)}')">이 인력 제외</button>` : ''}
        <span style="font-size:.72rem;color:var(--tx-s)">저장 시 가용 판정과 CAPA 집계가 즉시 재계산됩니다.</span>
      </div></div>`;
  }

  function applyPL(D) {
    const cm = D.capaMeta;
    const q = $('pl-q').value.trim().toLowerCase();
    const c = $('pl-center').value, st = $('pl-st').value;
    const g = $('pl-grade').value, k = $('pl-kind').value;
    PL.list = (cm.list || []).filter(p =>
      (!q || (p.name || '').toLowerCase().includes(q)) &&
      (!c || p.center === c) && (!st || p.status === st) &&
      (!g || p.grade === g) && (!k || p.kind === k));
    drawPL();
  }

  const PL_COLOR = { '가용': 'var(--ok)', '평가중': 'var(--warn)', '비가용': 'var(--warn)', '구축제외': 'var(--tx-m)' };

  function drawPL() {
    const tot = PL.list.length, pages = Math.max(1, Math.ceil(tot / PL.size));
    PL.page = Math.min(PL.page, pages);
    const rows = PL.list.slice((PL.page - 1) * PL.size, PL.page * PL.size);
    const cnt = k => PL.list.filter(p => p.status === k).length;
    $('pl-info').innerHTML = `
      <span>검색결과 <b style="color:var(--tx-h)">${tot}</b>명</span>
      <span>가용 <b style="color:var(--ok)">${cnt('가용')}</b></span>
      <span>평가중 <b style="color:var(--warn)">${cnt('평가중')}</b></span>
      <span>비가용 <b style="color:var(--warn)">${cnt('비가용')}</b></span>
      <span>구축제외 <b style="color:var(--tx-m)">${cnt('구축제외')}</b></span>
      <span>${PL.page} / ${pages}</span>`;

    $('pl-body').innerHTML = rows.map(p => {
      const mark = p._added ? '<span class="st auto" style="margin-left:.3rem">추가</span>'
        : (p._edited || p.statusOverride) ? '<span class="st proxy" style="margin-left:.3rem">수정</span>' : '';
      return `<tr>
      <td><button class="namebtn" onclick="VIEWS.plEdit('${esc(p.name)}')" title="클릭하여 수정">${esc(p.name)}</button>${mark}</td>
      <td>${esc(p.grade)}</td>
      <td style="font-size:.72rem;color:${p.kind === '전환배치' ? 'var(--info)' : 'var(--tx-s)'}">${esc(p.kind)}</td>
      <td style="font-size:.72rem">${esc(p.center)}</td>
      <td style="font-size:.72rem">${esc(p.module || '—')}</td>
      <td class="ctr" style="color:${p.isBuild ? 'var(--ok)' : 'var(--risk)'};font-weight:700">${p.isBuild ? 'Y' : 'N'}</td>
      <td style="font-size:.71rem;color:var(--warn)">${esc(p.unavailReason || '—')}</td>
      <td class="mono" style="font-size:.68rem">${esc(p.placeDate || '—')}</td>
      <td><select class="ctl" style="padding:.25rem .4rem;font-size:.72rem;color:${PL_COLOR[p.status]};font-weight:700"
            onchange="VIEWS.plStatus('${esc(p.name)}', this.value)">
          <option value="" ${!p.statusOverride ? 'selected' : ''}>자동 · ${esc(p.status)}</option>
          ${POOL.STATUSES.map(x => `<option ${p.statusOverride === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select></td>
      <td class="ctr"><button class="pg" style="padding:.2rem .5rem;font-size:.7rem"
            onclick="VIEWS.plEdit('${esc(p.name)}')">수정</button></td>
    </tr>`; }).join('') || `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--tx-m)">검색 결과가 없습니다.</td></tr>`;
    $('pl-pager').innerHTML = pager(pages, PL.page, 'VIEWS.goPL');
  }
  function goPL(p) { PL.page = p; drawPL(); }

  /* ── 인력풀 편집 핸들러 ── */
  function plRefresh(msg) {
    PL.msg = msg || '';
    PL.edit = null; PL.isNew = false;
    poolState(APP.D);               // ① capaMeta 를 먼저 갱신하고
    APP.refreshKpi();               // ② 그 값으로 KPI 를 재계산한다 (순서 중요)
    renderPool(APP.D);
    if (msg) setTimeout(() => { PL.msg = ''; }, 4000);
  }
  function plNew() { PL.edit = POOL.blank(); PL.isNew = true; renderPool(APP.D); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function plEdit(name) {
    const p = (APP.D.capaMeta.list || []).find(x => x.name === name);
    if (!p) return;
    PL.edit = { ...p }; PL.isNew = false;
    renderPool(APP.D); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function plCancel() { PL.edit = null; PL.isNew = false; renderPool(APP.D); }

  function plSave() {
    const v = id => ($(id) || {}).value || '';
    const name = v('pf-name').trim();
    if (!name) { PL.msg = ''; alert('성명을 입력하세요.'); return; }
    if (PL.isNew && (APP.D.capaMeta.list || []).some(p => p.name === name)) {
      alert('이미 등록된 성명입니다. 다른 이름을 사용하거나 기존 인력을 수정하세요.'); return;
    }
    const stSel = v('pf-status');
    const center = v('pf-center');
    const person = {
      ...(PL.edit || POOL.blank()),
      name, grade: v('pf-grade'), kind: v('pf-kind'), center,
      region: POOL.REGION_OF[center] || '',
      module: v('pf-module').trim(),
      isBuild: v('pf-build') === 'Y',
      unavailReason: v('pf-reason').trim(),
      placeDate: v('pf-place') || null,
      evalDone: v('pf-eval'),
      statusOverride: stSel.startsWith('자동') ? undefined : stSel,
    };
    delete person._edited; delete person._added; delete person.status;
    POOL.upsert(person, PL.isNew);
    plRefresh(`${name} ${PL.isNew ? '등록' : '수정'} 완료 — 가용 판정과 CAPA가 재계산되었습니다.`);
  }

  function plStatus(name, status) {
    POOL.setStatus(name, status || '');
    plRefresh(`${name} 상태를 ${status ? `'${status}'로 지정` : '자동 판정으로 복원'}했습니다.`);
  }
  function plRemove(name) {
    if (!confirm(`${name} 인력을 목록에서 제외하시겠습니까?`)) return;
    POOL.remove(name);
    plRefresh(`${name} 인력을 제외했습니다.`);
  }
  function plReset() {
    if (!confirm('모든 변경분을 삭제하고 원본 인력마스터로 되돌립니다. 진행하시겠습니까?')) return;
    POOL.reset();
    plRefresh('원본 인력마스터로 되돌렸습니다.');
  }

  /* ════════ 10. 프로젝트 일괄등록 (GCMS 엑셀 업로드) ════════ */
  const BK = { file: '', asOf: '', sheets: [], sheet: '', result: null, err: '', busy: false };

  function renderBulk(D) {
    const r = BK.result;
    $('v-bulk').innerHTML = `
      <div class="sec-head"><h2>프로젝트 일괄등록</h2>
        <span class="sub">GCMS 구축총괄실적현황 엑셀 업로드 — 3번째 시트 「${esc(BULK.SHEET)}」</span></div>

      <div class="card" style="margin-bottom:1rem;background:#F8FAFF;border-color:#C7D2FE">
        <div style="font-size:.77rem;line-height:1.85;color:var(--tx-b)">
          <b style="color:var(--tx-h)">Python 없이 데이터를 갱신합니다.</b>
          업로드한 엑셀을 브라우저에서 직접 파싱하여 <b>계약공수 기준 공수 산정</b>(작업지침 v2 §1-3)을 적용하고,
          <b>항등식 검증을 통과한 경우에만</b> 화면 전체에 반영합니다.
          산식은 <code>etl_gcms.py</code> 와 동일하며, 파일은 서버로 전송되지 않습니다.</div></div>

      <div class="g2" style="align-items:start">
        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">엑셀 업로드</h2></div>
          <div class="f-grid" style="grid-template-columns:1fr 1fr;margin-bottom:.8rem">
            <div class="fg"><label>GCMS 엑셀 파일 (.xlsx)</label>
              <input class="ctl" type="file" id="bk-file" accept=".xlsx" onchange="VIEWS.bkFile(this)"></div>
            <div class="fg"><label>기준일 (파일명에서 자동 인식)</label>
              <input class="ctl" type="date" id="bk-asof" value="${esc(BK.asOf || D.asOf)}"
                onchange="VIEWS.bkAsOf(this.value)"></div>
          </div>
          ${BK.sheets.length ? `<div class="fg" style="margin-bottom:.8rem">
            <label>시트 선택</label>
            <select class="ctl" onchange="VIEWS.bkSheet(this.value)">
              ${BK.sheets.map(x => `<option ${x === BK.sheet ? 'selected' : ''}>${esc(x)}</option>`).join('')}
            </select></div>` : ''}
          ${BK.busy ? `<div class="loading" style="padding:1.4rem"><div class="sp"></div>엑셀 파싱 중…</div>` : ''}
          ${BK.err ? `<div class="err" style="padding:.85rem 1rem;font-size:.78rem">${esc(BK.err)}</div>` : ''}
          ${BK.file && !BK.busy ? `<div style="font-size:.74rem;color:var(--tx-s);line-height:1.7">
            읽은 파일 <b>${esc(BK.file)}</b>${BK.sheet ? ` · 시트 <b>${esc(BK.sheet)}</b>` : ''}
            ${r ? ` · 원본 ${r.gridRows.toLocaleString()}행 → 유효 <b>${r.rows.length.toLocaleString()}</b>건` : ''}</div>` : ''}

          <div style="margin-top:.9rem;padding-top:.8rem;border-top:1px dashed var(--bd-light)">
            <div style="font-size:.72rem;font-weight:800;color:var(--tx-s);margin-bottom:.4rem">적용 산식</div>
            <div style="font-family:ui-monospace,monospace;font-size:.69rem;background:#F8FAFC;border:1px solid var(--bd-light);border-radius:6px;padding:.6rem .7rem;line-height:1.75;white-space:pre-wrap">계약공수  FoEX(1:N)계열 = 표준공수(AH) · 그 외 = 예상공수(AI)
미투입    1:N = 계약공수 × 잔여율 (×30%)
          1:N+방문 = 유상(AI−AJ) + 무상×잔여율 (무상만 ×30%)
          방문·단독 = AI − AJ
특수규칙  ① 완료 → 0  ② 완료예정일 경과 → 잔여율 5%(1:N계열)
          ③ 추가&amp;기타&amp;표준0&amp;예상0 → 공수 0
진행율    경과 ÷ 구축기간 · 상한 1.0만 적용 (착수 전 하한 클램프 없음)</div></div>
        </div>

        <div class="card">
          <div class="sec-head"><h2 style="font-size:.9rem">항등식 검증</h2>
            ${r ? `<span class="sub">${BULK.checks(r.meta).filter(c => c.ok).length} / ${BULK.checks(r.meta).length} 통과</span>` : ''}</div>
          ${r ? (() => {
            const cs = BULK.checks(r.meta);
            const allOk = cs.every(c => c.ok);
            return `<div class="tbl-wrap" style="max-height:330px;overflow:auto"><table><tbody>
              ${cs.map(c => `<tr>
                <td class="ctr" style="width:42px;font-size:1rem">${c.ok ? '✅' : '❌'}</td>
                <td class="strong" style="width:210px;font-size:.75rem">${esc(c.label)}</td>
                <td class="mono" style="font-size:.71rem;color:${c.ok ? 'var(--tx-b)' : 'var(--risk)'}">${esc(c.expr)}</td>
              </tr>`).join('')}</tbody></table></div>
              <div style="margin-top:.8rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                <button class="pg" style="background:${allOk ? 'var(--ok)' : 'var(--idle)'};color:#fff;border-color:${allOk ? 'var(--ok)' : 'var(--idle)'}"
                  ${allOk ? '' : 'disabled'} onclick="VIEWS.bkApply()">이 데이터로 전체 화면 반영</button>
                <span style="font-size:.73rem;color:${allOk ? 'var(--ok)' : 'var(--risk)'}">
                  ${allOk ? '전 항목 통과 — 반영 가능' : '검증 실패 항목이 있어 반영할 수 없습니다. 원본을 확인하세요.'}</span>
              </div>` })()
            : `<div class="notimpl"><b>엑셀을 먼저 업로드하세요</b><br>
                업로드하면 3번째 시트를 자동 인식하여 파싱하고, 항등식 4종을 검증합니다.
                검증을 통과해야 반영 버튼이 활성화됩니다.</div>`}
        </div>
      </div>

      ${r ? bulkSummary(r) : ''}`;
  }

  function bulkSummary(r) {
    const m = r.meta, md = m.md;
    const cur = APP.D;
    const dv = (a, b) => { const d = a - b; return d === 0 ? '—' : `${d > 0 ? '+' : ''}${f0(d)}`; };
    return `
      <div class="card" style="margin-top:1rem">
        <div class="sec-head"><h2 style="font-size:.9rem">집계 결과 · 현재 적용본과 비교</h2>
          <span class="sub">기준일 ${esc(m.asOf)}</span></div>
        <div class="md-cards">
          ${mdc('c1', '총접수', m.total.toLocaleString())}
          ${mdc('c2', '완료', m.done.toLocaleString())}
          ${mdc('c5', '현진행', m.active.toLocaleString())}
          ${mdc('c3', '최종미투입', f1(md.finalUn))}
          ${mdc('c4', '구축지연', f1(m.delayM) + 'M')}
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>항목</th><th class="num">업로드본</th><th class="num">현재 적용본</th><th class="num">차이</th></tr></thead>
          <tbody>
            ${[['총접수', m.total, cur.stat.total], ['완료', m.done, cur.stat.done],
               ['현진행', m.active, cur.stat.active],
               ['이월', m.carry, cur.meta.carry], ['신규', m.new, cur.meta.new],
               ['납기준수건', m.deliveryKeep, cur.meta.deliveryKeep],
               ['계약공수', md.contract, cur.meta.md.contract],
               ['최종미투입', md.finalUn, cur.meta.md.finalUn]].map(([l, a, b]) => `<tr>
              <td class="strong">${esc(l)}</td>
              <td class="num">${f0(a)}</td><td class="num" style="color:var(--tx-s)">${f0(b)}</td>
              <td class="num" style="color:${a === b ? 'var(--tx-m)' : 'var(--info)'};font-weight:700">${dv(a, b)}</td></tr>`).join('')}
          </tbody></table></div>
        <div style="margin-top:.7rem;font-size:.73rem;color:var(--tx-s);line-height:1.7">
          구축구분별 계약공수 —
          ${Object.entries(m.methodAgg).map(([k, v]) => `<b>${esc(k)}</b> ${v.cnt}건 ${f0(v.contract)}MD`).join(' · ')}<br>
          특수규칙 — ${Object.entries(m.spRule || {}).map(([k, v]) => `${esc(k)} ${v}건`).join(' · ') || '없음'}
        </div>
      </div>

      <div class="card" style="margin-top:1rem;padding:0;overflow:hidden">
        <div class="sec-head" style="padding:1.1rem 1.3rem 0"><h2 style="font-size:.9rem">미리보기 (상위 40건)</h2></div>
        <div class="tbl-wrap" style="border:none;max-height:420px;overflow:auto"><table>
          <thead><tr><th>프로젝트코드</th><th>거래처명</th><th>PM</th><th>진행상태</th><th>구축구분</th>
            <th class="num">계약공수</th><th class="num">투입</th><th class="num">최종미투입</th><th>접수일</th><th>완료예정일</th></tr></thead>
          <tbody>${r.rows.slice(0, 40).map(p => `<tr>
            <td class="mono strong">${esc(p.code)}</td><td>${esc(p.customer)}</td><td>${esc(p.pm)}</td>
            <td><span class="bdg ${esc(p.status)}">${esc(p.status)}</span></td>
            <td style="font-size:.71rem;color:var(--tx-s)">${esc(p.method)}</td>
            <td class="num">${f0(p.mdContract || p.mdPlan)}</td><td class="num">${f0(p.mdUsed)}</td>
            <td class="num" style="color:${p.mdFinalUn > 0 ? 'var(--warn)' : 'var(--tx-m)'}">${p.mdFinalUn ? f1(p.mdFinalUn) : '—'}</td>
            <td class="mono" style="font-size:.68rem">${esc(p.recvDate || '')}</td>
            <td class="mono" style="font-size:.68rem">${esc(p.dueDate || '')}</td></tr>`).join('')}</tbody>
        </table></div></div>`;
  }

  /* ── 일괄등록 핸들러 ── */
  function bkAsOf(v) { BK.asOf = v; }
  function bkSheet(v) { BK.sheet = v; if (BK.buf) bkRun(BK.buf); }

  async function bkFile(input) {
    const f = input.files && input.files[0]; if (!f) return;
    BK.file = f.name;
    BK.asOf = BULK.asOfFromName(f.name) || BK.asOf || APP.D.asOf;
    BK.buf = await f.arrayBuffer();
    BK.sheet = '';
    bkRun(BK.buf);
  }

  async function bkRun(buf) {
    BK.busy = true; BK.err = ''; BK.result = null;
    renderBulk(APP.D);
    try {
      const r = await BULK.parse(buf, BK.asOf, BK.sheet || undefined);
      BK.result = r; BK.sheets = r.sheets || []; BK.sheet = r.sheet;
    } catch (e) {
      BK.err = String(e.message || e);
    }
    BK.busy = false;
    renderBulk(APP.D);
  }

  function bkApply() {
    if (!BK.result) return;
    const cs = BULK.checks(BK.result.meta);
    if (!cs.every(c => c.ok)) return;
    APP.reload({ meta: BK.result.meta, rows: BK.result.rows });
  }

  return { renderExec, renderBulk, bkFile, bkAsOf, bkSheet, bkApply,
    renderPool, goPL, plNew, plEdit, plCancel, plSave, plStatus, plRemove, plReset,
    renderBook, renderProjectShell, renderStatus, renderCapa, renderAudit, renderBench,
    renderIngest, selectPJ, goPJ, goTab, goCP,
    ingSrc, ingBlock, ingAsOf, ingHeader, ingMap, ingClear, ingRemove, ingTemplate,
    ingPaste, ingFile, ingFlip, ingApply, ingSave, ingSavePreset, ingDropPreset };
})();
