import { useAppStore } from '../../store/useAppStore';
import { ModuleList } from './ModuleList';
import { StageList } from './StageList';
import s from './sidebar.module.css';

export function Sidebar() {
  const product = useAppStore((st) => st.product);

  return (
    <aside className={s.sidebar}>
      <div className={s.section}>모듈 ({product})</div>
      <ModuleList />
      <div className={s.divider} />
      <div className={s.section}>구축 단계</div>
      <StageList />
    </aside>
  );
}

export default Sidebar;
