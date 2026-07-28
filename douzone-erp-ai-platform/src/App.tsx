import { ICON_NAMES, Icon } from './components/ui/Icon';
import { PRODUCT_LABEL, STAGES, type ProductId } from './types';
import { A10_MODULES, OE_MODULES } from './data/modules';
import { DATA_BY_PRODUCT, itemsOf, moduleItemCount, totalItemCount } from './data/automation';
import { buildLaws } from './data/laws';
import { resolveTokens, tokenContext } from './lib/tokens';
import './App.css';

/**
 * Phase 1 기반 구축 검증 화면.
 * 디자인 토큰 렌더 / 인라인 SVG 아이콘 전수 렌더 / 런타임 날짜 산출을 눈으로 확인한다.
 * Phase 5 UI 컴포넌트 작업 시 실제 레이아웃 셸로 대체된다.
 */

const COLOR_TOKENS = [
  ['--bg', '배경'],
  ['--s1', '표면 1'],
  ['--s2', '표면 2'],
  ['--b1', '테두리 1'],
  ['--b2', '테두리 2'],
  ['--t1', '텍스트 1'],
  ['--t2', '텍스트 2'],
  ['--t3', '텍스트 3'],
  ['--green', '완전자동화'],
  ['--amber', '반자동'],
  ['--blue', '어시스턴트'],
  ['--purple', '액센트'],
  ['--red', '경고'],
  ['--a10c', 'A10'],
  ['--oec', 'OmniEsol'],
] as const;

const PRODUCTS: Array<{ id: ProductId; modules: typeof A10_MODULES }> = [
  { id: 'A10', modules: A10_MODULES },
  { id: 'OE', modules: OE_MODULES },
];

export default function App() {
  // [제약] 날짜 하드코딩 금지 — 전부 런타임 산출
  const ctx = tokenContext();
  const { today: todayISO, cy } = ctx;
  const laws = buildLaws();
  const total = totalItemCount();

  return (
    <div className="p1">
      <header className="p1-top">
        <span className="p1-mark">DZ</span>
        <span className="p1-brand">더존비즈온</span>
        <span className="p1-pill">PKG 사업본부 AI혁신TF</span>
        <span className="p1-sep" />
        <span className="p1-sub">ERP AI 자동화 플랫폼 — Phase 1·2 검증</span>
        <span className="p1-chips">
          <span className="p1-chip mono">기준일 {todayISO}</span>
          <span className="p1-chip mono">
            비교연도 {cy - 2}/{cy - 1}/{cy}
          </span>
        </span>
      </header>

      <main className="p1-body">
        <section className="p1-sect">
          <h2 className="p1-h">1.2 디자인 토큰</h2>
          <div className="p1-swatches">
            {COLOR_TOKENS.map(([token, label]) => (
              <div className="p1-sw" key={token}>
                <span className="p1-swbox" style={{ background: `var(${token})` }} />
                <span className="p1-swtxt">
                  <b className="mono">{token}</b>
                  <em>{label}</em>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="p1-sect">
          <h2 className="p1-h">1.3 타입 정의 — 구축 5단계 (순 한글 고정)</h2>
          <ol className="p1-stages">
            {STAGES.map((s, i) => (
              <li key={s}>
                <span className="p1-stnum mono">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="p1-note">
            제품: {PRODUCT_LABEL.A10} / {PRODUCT_LABEL.OE}
          </p>
        </section>

        <section className="p1-sect">
          <h2 className="p1-h">1.4 인라인 SVG 아이콘 ({ICON_NAMES.length}종) — 외부 요청 0건</h2>
          <div className="p1-icons">
            {ICON_NAMES.map((n) => (
              <div className="p1-ico" key={n}>
                <Icon name={n} size={18} spin={n === 'loader'} />
                <span className="mono">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="p1-sect">
          <h2 className="p1-h">
            2.1~2.4 자동화 항목 데이터 — 65슬롯 / 총 {total}건 (슬롯당 최소 2건)
          </h2>
          {PRODUCTS.map(({ id, modules }) => (
            <div className="p1-grid" key={id}>
              <table className="p1-tbl">
                <thead>
                  <tr>
                    <th>{PRODUCT_LABEL[id]}</th>
                    {STAGES.map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                    <th>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <b>{m.id}</b> {m.name}
                      </td>
                      {STAGES.map((s) => (
                        <td className="mono num" key={s}>
                          {DATA_BY_PRODUCT[id][m.id]?.[s]?.length ?? 0}
                        </td>
                      ))}
                      <td className="mono num tot">{moduleItemCount(id, m.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="p1-note">
            날짜 토큰 치환 예시 (FI · 착수·분석 #1) —{' '}
            <span className="mono">{resolveTokens(itemsOf('A10', 'FI', 0)[0]?.task ?? '', ctx)}</span>
          </p>
        </section>

        <section className="p1-sect">
          <h2 className="p1-h">2.5 법령·IFRS 정의 ({laws.length}건)</h2>
          <table className="p1-tbl">
            <thead>
              <tr>
                <th>구분</th>
                <th>제목</th>
                <th>발행일</th>
                <th>시행일</th>
              </tr>
            </thead>
            <tbody>
              {laws.map((l) => (
                <tr key={l.id}>
                  <td>{l.tag}</td>
                  <td>{l.title}</td>
                  <td className="mono num">{l.publishedDate}</td>
                  <td className="mono num">{l.effectiveDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p1-note">
            D-Day 배지·경과 기간 산출은 Phase 3 (lib/date.ts) 에서 구현합니다.
          </p>
        </section>
      </main>

      <footer className="p1-status mono">
        <span>Phase 1 기반 구축 · Phase 2 데이터 레이어</span>
        <span>·</span>
        <span>Vite + React 18 + TypeScript 5</span>
        <span>·</span>
        <span>외부 CDN 0건 / sessionStorage 전용</span>
      </footer>
    </div>
  );
}
