import { useMemo } from 'react';
import { itemsOf } from '../../data/automation';
import { useRunItem } from '../../hooks/useRunItem';
import { tokenContext } from '../../lib/tokens';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../ui/Icon';
import { AutomationCard } from './AutomationCard';
import { CenterHeader } from './CenterHeader';
import s from './center.module.css';

export function CenterPanel() {
  const product = useAppStore((st) => st.product);
  const moduleId = useAppStore((st) => st.moduleId);
  const stageIndex = useAppStore((st) => st.stageIndex);
  const { run } = useRunItem();

  const items = itemsOf(product, moduleId, stageIndex);
  // [제약] 날짜 토큰은 렌더 시점 런타임 컨텍스트로 치환
  const ctx = useMemo(() => tokenContext(), [product, moduleId, stageIndex]);

  return (
    <main className={s.center}>
      <CenterHeader />
      <div className={s.items}>
        {items.length === 0 ? (
          <div className={s.empty}>
            <Icon name="moodEmpty" size={26} />
            이 단계에 등록된 자동화 항목이 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <AutomationCard key={item.id} item={item} ctx={ctx} onRun={run} />
          ))
        )}
      </div>
    </main>
  );
}

export default CenterPanel;
