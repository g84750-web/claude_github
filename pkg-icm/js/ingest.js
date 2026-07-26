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
    oneai: {
      id: 'oneai', name: 'ONE AI 실적', icon: '🤖',
      desc: '교육실적 / 구축실적 / 사용량실적 — 총관리·완료·요금제별·월별 사용량',
      cycle: '월',
      cols: [
        { key: 'month', label: '월', type: 'text', req: true, hint: '2026-01 또는 1월' },
        { key: 'carry', label: '이월', type: 'num' },
        { key: 'new', label: '신규접수', type: 'num' },
        { key: 'done', label: '완료', type: 'num', req: true, hint: '오픈확인서 수령 기준' },
        { key: 'plan', label: '요금제', type: 'text' },
        { key: 'credit', label: '사용량(크레딧)', type: 'num' },
      ],
      /* 검증 — 지침 §1-1 #14 */
      verify: rows => {
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const carry = sum('carry'), nw = sum('new'), done = sum('done');
        return [
          { ok: true, label: '총관리 = 이월 + 신규', expr: `${carry.toLocaleString()} + ${nw.toLocaleString()} = ${(carry + nw).toLocaleString()}` },
          { ok: done > 0, label: '완료 (오픈확인서 수령)', expr: `${done.toLocaleString()}건` },
          { ok: true, label: '월별 사용량 최대', expr: (() => {
              const m = rows.filter(r => r.credit).sort((a, b) => b.credit - a.credit)[0];
              return m ? `${m.month} · ${m.credit.toLocaleString()} 크레딧` : '—';
            })() },
        ];
      },
      summary: rows => {
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        return [
          ['총관리', (sum('carry') + sum('new')).toLocaleString() + '건'],
          ['이월', sum('carry').toLocaleString() + '건'],
          ['신규', sum('new').toLocaleString() + '건'],
          ['완료', sum('done').toLocaleString() + '건'],
          ['총 사용량', sum('credit').toLocaleString() + ' 크레딧'],
        ];
      },
    },

    sales: {
      id: 'sales', name: '영업지원 실적', icon: '💼',
      desc: '영업지원 / 업무지원 — 지원·계약·전환율·수주금액 4구분',
      cycle: '월',
      cols: [
        { key: 'month', label: '월', type: 'text', req: true, hint: '1Q는 1~3월 합산 1행' },
        { key: 'support', label: '지원건수', type: 'num', req: true },
        { key: 'contract', label: '계약건수', type: 'num', req: true },
        { key: 'upsell', label: '업셀(억)', type: 'num' },
        { key: 'newbiz', label: '신규(억)', type: 'num' },
        { key: 'building', label: '구축중(억)', type: 'num' },
        { key: 'built', label: '구축완료(억)', type: 'num' },
      ],
      /* 검증 — 지침 §3-3 [G5] */
      verify: rows => {
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const sup = sum('support'), ctr = sum('contract');
        const amt = sum('upsell') + sum('newbiz') + sum('building') + sum('built');
        const q1 = rows.filter(r => /1Q|1~3|1분기/.test(String(r.month)));
        return [
          { ok: sup > 0, label: '[G5] 전환율 = 계약 ÷ 지원',
            expr: `${ctr} ÷ ${sup} = ${sup ? (ctr / sup * 100).toFixed(1) : '—'}%` },
          { ok: true, label: '[G5] 수주금액 = 4구분 합',
            expr: `${sum('upsell').toFixed(2)} + ${sum('newbiz').toFixed(2)} + ${sum('building').toFixed(2)} + ${sum('built').toFixed(2)} = ${amt.toFixed(2)}억` },
          { ok: q1.length <= 1, label: '[G5] 1Q(1~3월) 합산 유지',
            expr: q1.length <= 1 ? '1Q 단일 행 — 월별 분리 없음 ✓'
              : `⚠ 1Q가 ${q1.length}행으로 분리됨 — 3월 단독 66.7% 사용 금지 규정 위반` },
        ];
      },
      summary: rows => {
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const sup = sum('support'), ctr = sum('contract');
        return [
          ['지원', sup.toLocaleString() + '건'],
          ['계약', ctr.toLocaleString() + '건'],
          ['전환율', (sup ? (ctr / sup * 100).toFixed(1) : '—') + '%'],
          ['수주금액', (sum('upsell') + sum('newbiz') + sum('building') + sum('built')).toFixed(2) + '억'],
        ];
      },
    },

    foex: {
      id: 'foex', name: 'FoEX 교육실적', icon: '🎓',
      desc: '1:N / 단독 / 정책효과 — 정규·특별·DX 분류별 · 월별 단독 교육',
      cycle: '주~월',
      cols: [
        { key: 'month', label: '월', type: 'text', req: true },
        { key: 'regular', label: '1:N 정규', type: 'num' },
        { key: 'special', label: '1:N 특별(지원)', type: 'num' },
        { key: 'dx', label: 'DX사용자교육', type: 'num', hint: '⚠ 1:N 합산 금지 — 별도 관리' },
        { key: 'solo', label: '단독', type: 'num' },
      ],
      /* 검증 — 지침 §3-3 [G6] */
      verify: rows => {
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const reg = sum('regular'), sp = sum('special'), dx = sum('dx'), solo = sum('solo');
        const n1 = reg + sp, tot = n1 + solo;
        return [
          { ok: true, label: '[G6] 1:N = 정규 + 특별', expr: `${reg} + ${sp} = ${n1}` },
          { ok: true, label: '[G6] 총교육 = 1:N + 단독', expr: `${n1} + ${solo} = ${tot}` },
          { ok: true, label: '🔴 DX사용자교육 별도 관리',
            expr: dx ? `DX ${dx}건 — 1:N ${n1}에 합산하지 않음 ✓` : 'DX 입력 없음' },
        ];
      },
      summary: rows => {
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const n1 = sum('regular') + sum('special');
        return [
          ['1:N', n1.toLocaleString() + '건'],
          ['단독', sum('solo').toLocaleString() + '건'],
          ['총교육', (n1 + sum('solo')).toLocaleString() + '건'],
          ['DX (별도)', sum('dx').toLocaleString() + '건'],
        ];
      },
    },
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

  /* ════════ 헤더 자동 매핑 ════════ */
  const norm = s => String(s ?? '').replace(/[\s()（）\[\]·・_\-\/]/g, '').toLowerCase();

  function autoMap(header, schema) {
    const map = {};
    schema.cols.forEach(col => {
      const want = norm(col.label);
      let hit = header.findIndex(h => norm(h) === want);
      if (hit < 0) hit = header.findIndex(h => norm(h) && (norm(h).includes(want) || want.includes(norm(h))));
      map[col.key] = hit;
    });
    return map;
  }

  /** 헤더 행 자동 탐지 — 스키마 라벨과 가장 많이 일치하는 행 */
  function findHeaderRow(grid, schema) {
    let best = 0, bestHit = -1;
    grid.slice(0, 12).forEach((row, i) => {
      const m = autoMap(row, schema);
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
  function toRecords(grid, headerRow, map, schema) {
    const out = [];
    for (let i = headerRow + 1; i < grid.length; i++) {
      const row = grid[i];
      if (!row || row.every(c => String(c ?? '').trim() === '')) continue;
      const rec = {};
      let hasVal = false;
      schema.cols.forEach(col => {
        const idx = map[col.key];
        const raw = (idx >= 0 && idx < row.length) ? row[idx] : '';
        rec[col.key] = col.type === 'num' ? toNum(raw) : String(raw ?? '').trim();
        if (rec[col.key] !== '' && rec[col.key] !== 0) hasVal = true;
      });
      if (hasVal) out.push(rec);
    }
    return out;
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

  /* ════════ 양식(템플릿) CSV ════════ */
  function templateCsv(schema) {
    const head = schema.cols.map(c => c.label).join(',');
    const sample = schema.cols.map(c => c.type === 'num' ? '0' : '').join(',');
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
    SCHEMAS, parseXlsx, parseText, autoMap, findHeaderRow, toRecords,
    loadAll, saveOne, removeOne, templateCsv, download, toNum, norm,
  };
})();
