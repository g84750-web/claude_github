import { moduleName } from '../../data/modules';
import { useAppStore } from '../../store/useAppStore';
import { AUTOMATION_TYPE_META, type AutomationType } from '../../types/automation';
import { stageNameOf } from '../../types/domain';
import s from './center.module.css';

const LEGEND: AutomationType[] = ['auto', 'semi', 'asst'];

export function CenterHeader() {
  const product = useAppStore((st) => st.product);
  const moduleId = useAppStore((st) => st.moduleId);
  const stageIndex = useAppStore((st) => st.stageIndex);

  return (
    <div className={s.head}>
      <span className={`${s.prodBadge} ${product === 'A10' ? s.prodA10 : s.prodOe}`}>
        {product}
      </span>
      <span className={s.title}>
        {moduleId} — {moduleName(moduleId)}
      </span>
      <span className={s.stagePill}>{stageNameOf(stageIndex)}</span>

      <div className={s.legend}>
        {LEGEND.map((t) => {
          const meta = AUTOMATION_TYPE_META[t];
          return (
            <span className={s.legendItem} key={t}>
              <span className={s.dot} style={{ background: `var(${meta.fgVar})` }} />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default CenterHeader;
