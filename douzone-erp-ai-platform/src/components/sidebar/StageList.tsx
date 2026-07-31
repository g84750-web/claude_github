import { itemsOf } from '../../data/automation';
import { STAGE_DEFS } from '../../data/stages';
import { useAppStore } from '../../store/useAppStore';
import s from './sidebar.module.css';

export function StageList() {
  const product = useAppStore((st) => st.product);
  const moduleId = useAppStore((st) => st.moduleId);
  const stageIndex = useAppStore((st) => st.stageIndex);
  const setStage = useAppStore((st) => st.setStage);

  return (
    <nav className={s.stageScroll} aria-label="구축 단계">
      {STAGE_DEFS.map((st2) => {
        const active = st2.index === stageIndex;
        const count = itemsOf(product, moduleId, st2.index).length;
        return (
          <button
            key={st2.name}
            className={`${s.stageBtn} ${active ? s.stageActive : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => setStage(st2.index)}
          >
            <span className={s.stageNum}>{st2.no}</span>
            <span className={s.stageLabel}>{st2.name}</span>
            <span className={s.stageCount}>{count}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default StageList;
