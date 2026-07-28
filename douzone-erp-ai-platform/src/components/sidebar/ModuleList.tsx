import { MODULES_BY_PRODUCT } from '../../data/modules';
import { moduleItemCount } from '../../data/automation';
import { useAppStore } from '../../store/useAppStore';
import s from './sidebar.module.css';

export function ModuleList() {
  const product = useAppStore((st) => st.product);
  const moduleId = useAppStore((st) => st.moduleId);
  const setModule = useAppStore((st) => st.setModule);

  const modules = MODULES_BY_PRODUCT[product];
  const activeCls = product === 'A10' ? s.modActiveA10 : s.modActiveOe;

  return (
    <nav className={s.moduleScroll} aria-label="모듈 목록">
      {modules.map((m) => {
        const active = m.id === moduleId;
        return (
          <button
            key={m.id}
            className={`${s.modBtn} ${active ? activeCls : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => setModule(m.id)}
          >
            <span className={s.modIcon}>{m.id}</span>
            <span className={s.modInfo}>
              <span className={s.modName}>{m.name}</span>
              <span className={s.modEn}>{m.nameEn}</span>
            </span>
            <span className={s.modCount}>{moduleItemCount(product, m.id)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default ModuleList;
