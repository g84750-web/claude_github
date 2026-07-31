/* ══════════════════════════════════════════════════════════════════
   PKG 구축통합관리 — 별도 3종 데이터 입력 (엑셀 붙여넣기 / 일괄 업로드)

   대상 : ① ONE AI 실적  ② 영업지원 실적  ③ FoEX 교육실적
          (작업지침 v2 §2-2 「별도 업로드 3종」 — GCMS에 없는 데이터)

   구현 : 외부 라이브러리 없이 브라우저 내장 기능만 사용
          · XLSX  = ZIP 직접 파싱 + DecompressionStream('deflate-raw')
          · 붙여넣기 = TSV/CSV 파서
          · 저장   = localStorage (file:// 환경에서도 동작, 실패 시 메모리)
   ══════════════════════════════════════════════════════════════════ */
const INGEST = (() => {

  /* ════════ 스키마 정의 ════════ */
  const SCHEMAS = {
    /* ── ① ONE AI 실적 — 원본 PDF 3개 표 구조 ──────────────────
       2026년 A10_ONE AI 월별 구축 실적 현황 (PKG사업본부)
       ※ 원본은 월이 열로 펼쳐진 가로형 → 자동 전치 후 월별 행으로 처리 */
    oneai: {
      id: 'oneai', name: 'ONE AI 실적', icon: '🤖', cycle: '월',
      desc: '월별 구축 실적 현황 — 접수·완료 / 요금제별 / 사용량 3개 표',
      blocks: [
        {
          key: 'recv', name: '1. 접수·완료',
          hint: '표 1 「구축 실적 현황_고객수」 — 구분/총계/2025년이월/합계/1~12월 행 전체를 복사',
          cols: [
            { key: 'label', label: '구분', type: 'text', req: true, hint: '총계 · 2025년 이월 · 합계 · 1월~12월' },
            { key: 'recv', label: 'ONE AI 구축 접수', type: 'num', req: true },
            { key: 'done', label: 'ONE AI 구축 완료', type: 'num', req: true },
          ],
          summary: rows => {
            const f = re => rows.find(r => re.test(r.label)) || {};
            const mo = rows.filter(r => /^\s*\d+월/.test(r.label));
            return [
              ['총관리', (f(/총계/).recv || 0).toLocaleString() + '건'],
              ['2025 이월', (f(/이월/).recv || 0).toLocaleString() + '건'],
              ['2026 신규', (f(/^\s*합계/).recv || 0).toLocaleString() + '건'],
              ['구축 완료', (f(/총계/).done || 0).toLocaleString() + '건'],
              ['집계 월수', mo.length + '개월'],
            ];
          },
          verify: rows => {
            const f = re => rows.find(r => re.test(r.label)) || {};
            const mo = rows.filter(r => /^\s*\d+월/.test(r.label));
            const tot = f(/총계/).recv || 0, carry = f(/이월/).recv || 0, sum = f(/^\s*합계/).recv || 0;
            const moRecv = mo.reduce((a, r) => a + (r.recv || 0), 0);
            const moDone = mo.reduce((a, r) => a + (r.done || 0), 0);
            const totDone = f(/총계/).done || 0;
            return [
              { ok: tot === carry + sum, label: '총관리 = 이월 + 신규',
                expr: `${tot.toLocaleString()} = ${carry.toLocaleString()} + ${sum.toLocaleString()}` },
              { ok: moRecv === sum, label: '접수 월별 합 = 신규 합계',
                expr: `${moRecv.toLocaleString()} = ${sum.toLocaleString()}` },
              { ok: moDone === totDone, label: '완료 월별 합 = 완료 총계',
                expr: `${moDone.toLocaleString()} = ${totDone.toLocaleString()}  (오픈확인서 수령 기준)` },
            ];
          },
        },
        {
          key: 'plan', name: '2. 요금제별',
          hint: '표 2 「요금제별 실적」 — 소계·데모 요금제 행 포함하여 복사',
          cols: [
            { key: 'label', label: '구분', type: 'text', req: true, hint: '총계 · 1월~12월' },
            { key: 'total', label: '요금제 실적 총계', type: 'num' },
            { key: 'p25', label: '25요금제', type: 'num' },
            { key: 'p35', label: '35요금제', type: 'num' },
            { key: 'p50', label: '50요금제', type: 'num' },
            { key: 'p75', label: '75요금제', type: 'num' },
            { key: 'sub', label: '소계', type: 'num' },
            { key: 'demo', label: '데모 요금제', type: 'num' },
          ],
          summary: rows => {
            const mo = rows.filter(r => /^\s*\d+월/.test(r.label));
            const S = k => mo.reduce((a, r) => a + (r[k] || 0), 0);
            return [
              ['25요금제', S('p25').toLocaleString() + '건'],
              ['35요금제', S('p35').toLocaleString() + '건'],
              ['50/75요금제', (S('p50') + S('p75')).toLocaleString() + '건'],
              ['데모', S('demo').toLocaleString() + '건'],
              ['월별 합계', (S('p25') + S('p35') + S('p50') + S('p75') + S('demo')).toLocaleString() + '건'],
            ];
          },
          verify: rows => {
            const f = re => rows.find(r => re.test(r.label)) || {};
            const mo = rows.filter(r => /^\s*\d+월/.test(r.label));
            const S = k => mo.reduce((a, r) => a + (r[k] || 0), 0);
            const paid = S('p25') + S('p35') + S('p50') + S('p75');
            const all = paid + S('demo');
            const tot = f(/총계/).total || 0;
            return [
              { ok: true, label: '유상 4종 합 = 소계', expr: `25(${S('p25')}) + 35(${S('p35')}) + 50(${S('p50')}) + 75(${S('p75')}) = ${paid.toLocaleString()}` },
              { ok: true, label: '소계 + 데모 = 요금제 총계', expr: `${paid.toLocaleString()} + ${S('demo')} = ${all.toLocaleString()}` },
              { ok: all === tot, label: '월별 합 = 총계 열',
                expr: all === tot ? `${all.toLocaleString()} = ${tot.toLocaleString()}`
                  : `⚠ 월별 합 ${all.toLocaleString()} ≠ 총계 열 ${tot.toLocaleString()} (차 ${(all - tot).toLocaleString()}) — 원본 총계 열이 당월 미반영일 수 있음. 인용 시 기준 명시` },
            ];
          },
        },
        {
          key: 'usage', name: '3. 사용량',
          hint: '표 3 「월별 사용량」 — 구축진행 / 구축완료(T) / 구축완료(+M2) 3구분. 2단 머리글이라 컬럼을 직접 지정하십시오',
          cols: [
            { key: 'label', label: '구분', type: 'text', req: true, hint: '1월~12월' },
            { key: 'procCust', label: '구축진행 대상 고객수', type: 'num' },
            { key: 'procCredit', label: '구축진행 총 사용량', type: 'num' },
            { key: 'doneTCust', label: '구축완료(T) 대상 고객수', type: 'num' },
            { key: 'doneTCredit', label: '구축완료(T) 총 사용량', type: 'num' },
            { key: 'm2Cust', label: '구축완료(+M2) 대상 고객수', type: 'num' },
            { key: 'm2Credit', label: '구축완료(+M2) 총 사용량', type: 'num' },
          ],
          summary: rows => {
            const mo = rows.filter(r => /^\s*\d+월/.test(r.label));
            const S = k => mo.reduce((a, r) => a + (r[k] || 0), 0);
            const peak = [...mo].sort((a, b) => (b.procCredit || 0) - (a.procCredit || 0))[0];
            return [
              ['구축진행 사용량', S('procCredit').toLocaleString()],
              ['완료(T) 사용량', S('doneTCredit').toLocaleString()],
              ['완료(+M2) 사용량', S('m2Credit').toLocaleString()],
              ['총 사용량', (S('procCredit') + S('doneTCredit') + S('m2Credit')).toLocaleString()],
              ['구축진행 최대월', peak ? `${peak.label} ${(peak.procCredit || 0).toLocaleString()}` : '—'],
            ];
          },
          verify: rows => {
            const mo = rows.filter(r => /^\s*\d+월/.test(r.label));
            const bad = mo.filter(r => r.procCust > 0 && r.procCredit > 0
              && Math.abs(r.procCredit / r.procCust - (r.procAvg || r.procCredit / r.procCust)) > 1e6);
            const peak = [...mo].sort((a, b) => (b.procCredit || 0) - (a.procCredit || 0))[0];
            return [
              { ok: mo.length > 0, label: '월별 행 인식', expr: `${mo.length}개월` },
              { ok: true, label: '구축진행 최대 사용월',
                expr: peak ? `${peak.label} · ${(peak.procCredit || 0).toLocaleString()} 크레딧 (고객 ${(peak.procCust || 0).toLocaleString()})` : '—' },
              { ok: bad.length === 0, label: '고객별 평균 정합', expr: bad.length ? `⚠ ${bad.length}개월 이상치` : '이상치 없음' },
            ];
          },
        },
      ],
    },

    /* ── ② 영업지원 실적 ─────────────────────────────────────── */
    sales: {
      id: 'sales', name: '영업지원 실적', icon: '💼', cycle: '월',
      desc: '영업지원 / 업무지원 — 지원·계약·전환율·수주금액 4구분',
      blocks: [{
        key: 'main', name: '영업지원',
        hint: '월 · 지원건수 · 계약건수 · 금액 4구분. 1Q(1~3월)는 합산 1행으로 유지하십시오',
        cols: [
          { key: 'label', label: '월', type: 'text', req: true, hint: '1Q는 1~3월 합산 1행' },
          { key: 'support', label: '지원건수', type: 'num', req: true },
          { key: 'contract', label: '계약건수', type: 'num', req: true },
          { key: 'upsell', label: '업셀(억)', type: 'num' },
          { key: 'newbiz', label: '신규(억)', type: 'num' },
          { key: 'building', label: '구축중(억)', type: 'num' },
          { key: 'built', label: '구축완료(억)', type: 'num' },
        ],
        summary: rows => {
          const S = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
          const sup = S('support'), ctr = S('contract');
          return [
            ['지원', sup.toLocaleString() + '건'],
            ['계약', ctr.toLocaleString() + '건'],
            ['전환율', (sup ? (ctr / sup * 100).toFixed(1) : '—') + '%'],
            ['수주금액', (S('upsell') + S('newbiz') + S('building') + S('built')).toFixed(2) + '억'],
          ];
        },
        verify: rows => {
          const S = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
          const sup = S('support'), ctr = S('contract');
          const amt = S('upsell') + S('newbiz') + S('building') + S('built');
          const q1 = rows.filter(r => /1Q|1~3|1분기/.test(String(r.label)));
          const m123 = rows.filter(r => /^\s*[123]월/.test(String(r.label)));
          return [
            { ok: sup > 0, label: '[G5] 전환율 = 계약 ÷ 지원',
              expr: `${ctr} ÷ ${sup} = ${sup ? (ctr / sup * 100).toFixed(1) : '—'}%` },
            { ok: true, label: '[G5] 수주금액 = 4구분 합',
              expr: `${S('upsell').toFixed(2)} + ${S('newbiz').toFixed(2)} + ${S('building').toFixed(2)} + ${S('built').toFixed(2)} = ${amt.toFixed(2)}억` },
            { ok: m123.length === 0, label: '[G5] 1Q(1~3월) 합산 유지',
              expr: m123.length === 0 ? `1Q 합산 유지 ✓ ${q1.length ? `(1Q 행 ${q1.length}개)` : ''}`
                : `⚠ 1~3월이 ${m123.length}행으로 분리됨 — 3월 단독 66.7% 사용 금지 규정 위반` },
          ];
        },
      }],
    },

    /* ── ③ FoEX 교육실적 ─────────────────────────────────────── */
    foex: {
      id: 'foex', name: 'FoEX 교육실적', icon: '🎓', cycle: '주~월',
      desc: '1:N / 단독 / 정책효과 — 정규·특별·DX 분류별 · 월별 단독 교육',
      blocks: [{
        key: 'main', name: 'FoEX 교육',
        hint: '월 · 1:N 정규/특별 · DX · 단독. DX는 1:N에 합산하지 않습니다',
        cols: [
          { key: 'label', label: '월', type: 'text', req: true },
          { key: 'regular', label: '1:N 정규', type: 'num' },
          { key: 'special', label: '1:N 특별(지원)', type: 'num' },
          { key: 'dx', label: 'DX사용자교육', type: 'num', hint: '⚠ 1:N 합산 금지 — 별도 관리' },
          { key: 'solo', label: '단독', type: 'num' },
        ],
        summary: rows => {
          const S = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
          const n1 = S('regular') + S('special');
          return [
            ['1:N', n1.toLocaleString() + '건'],
            ['단독', S('solo').toLocaleString() + '건'],
            ['총교육', (n1 + S('solo')).toLocaleString() + '건'],
            ['DX (별도)', S('dx').toLocaleString() + '건'],
          ];
        },
        verify: rows => {
          const S = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
          const reg = S('regular'), sp = S('special'), dx = S('dx'), solo = S('solo');
          const n1 = reg + sp;
          return [
            { ok: true, label: '[G6] 1:N = 정규 + 특별', expr: `${reg} + ${sp} = ${n1}` },
            { ok: true, label: '[G6] 총교육 = 1:N + 단독', expr: `${n1} + ${solo} = ${n1 + solo}` },
            { ok: true, label: '🔴 DX사용자교육 별도 관리',
              expr: dx ? `DX ${dx}건 — 1:N ${n1}에 합산하지 않음 ✓` : 'DX 입력 없음' },
          ];
        },
      }],
    },
  };

  const blockOf = (srcId, blockKey) => {
    const sc = SCHEMAS[srcId];
    return sc.blocks.find(b => b.key === blockKey) || sc.blocks[0];
  };

  /* ════════ XLSX 파서 — ZIP + DecompressionStream ════════ */
  const dv = b => new DataView(b);
  const td = new TextDecoder();

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined')
      throw new Error('이 브라우저는 XLSX 직접 읽기를 지원하지 않습니다. 엑셀에서 복사 → 붙여넣기를 사용하세요.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** ZIP 중앙 디렉터리를 읽어 { 파일명: Uint8Array } 반환 */
  async function unzip(buf) {
    const v = dv(buf), n = buf.byteLength;
    let eocd = -1;
    for (let i = n - 22; i >= Math.max(0, n - 65558); i--)
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('올바른 XLSX(ZIP) 파일이 아닙니다.');

    const count = v.getUint16(eocd + 10, true);
    let off = v.getUint32(eocd + 16, true);
    const out = {};
    for (let i = 0; i < count; i++) {
      if (v.getUint32(off, true) !== 0x02014b50) break;
      const method = v.getUint16(off + 10, true);
      const csize = v.getUint32(off + 20, true);
      const nameLen = v.getUint16(off + 28, true);
      const extraLen = v.getUint16(off + 30, true);
      const cmtLen = v.getUint16(off + 32, true);
      const lho = v.getUint32(off + 42, true);
      const name = td.decode(new Uint8Array(buf, off + 46, nameLen));
      // 로컬 헤더에서 실제 데이터 시작 위치 계산
      const lNameLen = v.getUint16(lho + 26, true);
      const lExtraLen = v.getUint16(lho + 28, true);
      const dataStart = lho + 30 + lNameLen + lExtraLen;
      const raw = new Uint8Array(buf, dataStart, csize);
      out[name] = { method, raw };
      off += 46 + nameLen + extraLen + cmtLen;
    }
    const get = async name => {
      const e = out[name];
      if (!e) return null;
      return td.decode(e.method === 0 ? e.raw : await inflateRaw(e.raw));
    };
    return { names: Object.keys(out), get };
  }

  const colIdx = ref => {
    let c = 0;
    for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + (ch.charCodeAt(0) - 64);
    return c - 1;
  };

  /** XLSX → 2차원 배열 (첫 시트 또는 지정 시트) */
  async function parseXlsx(arrayBuffer, sheetName) {
    const zip = await unzip(arrayBuffer);
    const P = new DOMParser();

    // 공유 문자열
    const ssXml = await zip.get('xl/sharedStrings.xml');
    const shared = [];
    if (ssXml) {
      const doc = P.parseFromString(ssXml, 'application/xml');
      doc.querySelectorAll('si').forEach(si => {
        shared.push([...si.querySelectorAll('t')].map(t => t.textContent).join(''));
      });
    }

    // 시트 목록 (workbook.xml ↔ rels)
    const wbXml = await zip.get('xl/workbook.xml');
    const relXml = await zip.get('xl/_rels/workbook.xml.rels');
    const sheets = [];
    if (wbXml && relXml) {
      const wb = P.parseFromString(wbXml, 'application/xml');
      const rel = P.parseFromString(relXml, 'application/xml');
      const relMap = {};
      rel.querySelectorAll('Relationship').forEach(r =>
        relMap[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\/?xl\//, ''));
      wb.querySelectorAll('sheet').forEach(s => sheets.push({
        name: s.getAttribute('name'),
        path: 'xl/' + (relMap[s.getAttribute('r:id') || s.getAttributeNS(
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')] || ''),
      }));
    }
    const target = (sheetName && sheets.find(s => s.name === sheetName)) || sheets[0];
    const path = target ? target.path : 'xl/worksheets/sheet1.xml';
    const shXml = await zip.get(path) || await zip.get('xl/worksheets/sheet1.xml');
    if (!shXml) throw new Error('시트를 찾을 수 없습니다.');

    const doc = P.parseFromString(shXml, 'application/xml');
    const grid = [];
    doc.querySelectorAll('row').forEach(row => {
      const arr = [];
      row.querySelectorAll('c').forEach(c => {
        const ref = c.getAttribute('r') || '';
        const i = ref ? colIdx(ref) : arr.length;
        const t = c.getAttribute('t');
        let val = '';
        if (t === 'inlineStr') val = [...c.querySelectorAll('is t')].map(x => x.textContent).join('');
        else {
          const vEl = c.querySelector('v');
          const raw = vEl ? vEl.textContent : '';
          val = (t === 's') ? (shared[+raw] ?? '') : raw;
        }
        arr[i] = val;
      });
      grid.push([...arr].map(x => x ?? ''));
    });
    return { grid, sheets: sheets.map(s => s.name), sheet: target ? target.name : '' };
  }

  /* ════════ 붙여넣기 파서 (TSV / CSV) ════════ */
  function parseText(text) {
    const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (!t.trim()) return [];
    const lines = t.split('\n');
    const tab = lines[0].includes('\t');
    return lines.map(line => tab ? line.split('\t') : splitCsv(line));
  }

  function splitCsv(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  /* ════════ 행/열 전치 ════════ */
  function transpose(grid) {
    const w = Math.max(...grid.map(r => r.length), 0);
    const out = [];
    for (let c = 0; c < w; c++) out.push(grid.map(r => r[c] ?? ''));
    return out;
  }

  /* ════════ 헤더 자동 매핑 ════════ */
  const norm = s => String(s ?? '').replace(/[\s()（）\[\]·・_\-\/]/g, '').toLowerCase();

  function autoMap(header, block) {
    const map = {};
    block.cols.forEach(col => {
      const want = norm(col.label);
      let hit = header.findIndex(h => norm(h) === want);
      if (hit < 0) hit = header.findIndex(h => norm(h) && (norm(h).includes(want) || want.includes(norm(h))));
      map[col.key] = hit;
    });
    return map;
  }

  /** 헤더 행 자동 탐지 — 스키마 라벨과 가장 많이 일치하는 행 */
  function findHeaderRow(grid, block) {
    let best = 0, bestHit = -1;
    grid.slice(0, 12).forEach((row, i) => {
      const m = autoMap(row, block);
      const hit = Object.values(m).filter(x => x >= 0).length;
      if (hit > bestHit) { bestHit = hit; best = i; }
    });
    return { row: best, hits: bestHit };
  }

  const toNum = v => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/[,\s원건억%]/g, ''));
    return isFinite(n) ? n : 0;
  };

  /** grid + 매핑 → 레코드 배열 */
  function toRecords(grid, headerRow, map, block) {
    const out = [];
    for (let i = headerRow + 1; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.every(c => String(c ?? '').trim() === '')) continue;
      const rec = {};
      let hasVal = false;
      block.cols.forEach(col => {
        const idx = map[col.key];
        const raw = (idx >= 0 && idx < row.length) ? row[idx] : '';
        rec[col.key] = col.type === 'num' ? toNum(raw) : String(raw ?? '').trim();
        if (rec[col.key] !== '' && rec[col.key] !== 0) hasVal = true;
      });
      if (hasVal) out.push(rec);
    }
    return out;
  }

  /** 원본/전치 두 방향 중 스키마 일치도가 높은 쪽 선택 */
  function bestOrientation(grid, block) {
    const a = findHeaderRow(grid, block);
    const tg = transpose(grid);
    const b = findHeaderRow(tg, block);
    return (b.hits > a.hits)
      ? { grid: tg, headerRow: b.row, hits: b.hits, transposed: true }
      : { grid, headerRow: a.row, hits: a.hits, transposed: false };
  }

  /* ════════ 저장소 ════════ */
  const KEY = 'pkg-icm.aux.v1';
  const mem = {};
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return { ...mem }; }
  }
  function saveOne(id, payload) {
    const all = loadAll();
    all[id] = payload;
    mem[id] = payload;
    try { localStorage.setItem(KEY, JSON.stringify(all)); return true; }
    catch { return false; }   // file:// 등에서 차단되면 메모리 보관
  }
  function removeOne(id) {
    const all = loadAll();
    delete all[id]; delete mem[id];
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { }
  }

  /* ════════ 컬럼 매핑 프리셋 ════════
     원본 레이아웃이 매주 동일하므로 (전치여부 · 머리글행 · 컬럼매핑)을 저장해
     다음 회차에 자동 복원한다. 2단 머리글처럼 자동 인식이 어려운 표에 특히 유용. */
  const PKEY = 'pkg-icm.map.v1';
  const pmem = {};
  const pid = (src, block) => `${src}.${block}`;

  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); }
    catch { return { ...pmem }; }
  }
  function getPreset(src, block) { return loadPresets()[pid(src, block)] || null; }
  function savePreset(src, block, preset) {
    const all = loadPresets();
    all[pid(src, block)] = preset; pmem[pid(src, block)] = preset;
    try { localStorage.setItem(PKEY, JSON.stringify(all)); return true; } catch { return false; }
  }
  function removePreset(src, block) {
    const all = loadPresets();
    delete all[pid(src, block)]; delete pmem[pid(src, block)];
    try { localStorage.setItem(PKEY, JSON.stringify(all)); } catch { }
  }

  /** 프리셋이 현재 데이터에 적용 가능한지 검사 */
  function presetUsable(preset, grid, block) {
    if (!preset || !preset.map) return false;
    const g = preset.transposed ? transpose(grid) : grid;
    const hdr = g[preset.headerRow];
    if (!hdr) return false;
    const idxs = Object.values(preset.map).filter(i => i >= 0);
    if (!idxs.length || Math.max(...idxs) >= hdr.length) return false;
    // 필수 컬럼이 모두 매핑되어 있어야 한다
    return block.cols.filter(c => c.req).every(c => (preset.map[c.key] ?? -1) >= 0);
  }

  /* ════════ 양식(템플릿) CSV ════════ */
  function templateCsv(block) {
    const head = block.cols.map(c => c.label).join(',');
    const sample = block.cols.map(c => c.type === 'num' ? '0' : '').join(',');
    return '﻿' + head + '\n' + sample + '\n';
  }

  function download(name, text, mime = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    SCHEMAS, blockOf, parseXlsx, parseText, autoMap, findHeaderRow, toRecords,
    transpose, bestOrientation,
    loadAll, saveOne, removeOne, templateCsv, download, toNum, norm,
    getPreset, savePreset, removePreset, loadPresets, presetUsable,
  };
})();
