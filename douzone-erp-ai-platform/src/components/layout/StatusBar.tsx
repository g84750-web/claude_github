import { useApiStore } from '../../store/useApiStore';
import { useAppStore } from '../../store/useAppStore';
import { useExecStore } from '../../store/useExecStore';
import { todayISO } from '../../lib/date';
import s from './layout.module.css';

export function StatusBar() {
  const product = useAppStore((st) => st.product);
  const kpi = useExecStore((st) => st.kpi);
  const live = useApiStore((st) => st.isLive());

  // [제약] 기준일은 렌더 시점 런타임 산출
  const today = todayISO();

  const items: Array<[string, string]> = [
    ['실행', `${kpi.execCount}`],
    ['절감', `${kpi.totalHours}h`],
    ['제품', product],
    ['모드', live ? 'Claude AI' : '시뮬레이션'],
    ['기준일', today],
  ];

  return (
    <footer className={s.statusbar}>
      {items.map(([label, value], i) => (
        <span key={label} style={{ display: 'contents' }}>
          {i > 0 && <span className={s.statusSep} />}
          <span className={s.statusItem}>
            {label} <span className={s.statusValue}>{value}</span>
          </span>
        </span>
      ))}
    </footer>
  );
}

export default StatusBar;
