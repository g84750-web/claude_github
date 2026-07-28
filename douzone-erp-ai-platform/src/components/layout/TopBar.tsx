import { useAppStore } from '../../store/useAppStore';
import { useExecStore } from '../../store/useExecStore';
import { PRODUCT_LABEL, type ProductId } from '../../types/domain';
import { Icon } from '../ui/Icon';
import s from './layout.module.css';

const PRODUCTS: ProductId[] = ['A10', 'OE'];

export function TopBar() {
  const product = useAppStore((st) => st.product);
  const setProduct = useAppStore((st) => st.setProduct);
  const kpi = useExecStore((st) => st.kpi());

  return (
    <header className={s.topbar}>
      <div className={s.brand}>
        <span className={s.mark}>DZ</span>
        <span className={s.brandName}>더존비즈온</span>
      </div>
      <span className={s.brandSub}>PKG 사업본부 AI혁신TF</span>
      <span className={s.sep} />
      <span className={s.title}>ERP AI 자동화 플랫폼</span>
      <span className={s.sep} />

      <div className={s.prodSwitch} role="tablist" aria-label="제품 전환">
        {PRODUCTS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={product === p}
            className={`${s.prodBtn} ${
              product === p ? (p === 'A10' ? s.prodA10 : s.prodOe) : ''
            }`}
            onClick={() => setProduct(p)}
          >
            {PRODUCT_LABEL[p]}
          </button>
        ))}
      </div>

      <div className={s.chips}>
        <span className={s.chip} style={{ color: 'var(--green)' }} title="누적 실행 건수">
          <Icon name="bolt" size={12} />
          {kpi.execCount}건
        </span>
        <span className={s.chip} style={{ color: 'var(--blue)' }} title="누적 절감 공수">
          <Icon name="clock" size={12} />
          {kpi.totalHours}h
        </span>
        <span className={s.chip} style={{ color: 'var(--amber)' }} title="AI Attach Rate">
          <Icon name="chartBar" size={12} />
          AI {kpi.attachRate}%
        </span>
      </div>
    </header>
  );
}

export default TopBar;
