import { useAppStore, type TabIndex } from '../../store/useAppStore';
import { KpiTab } from './tabs/KpiTab';
import { LawTab } from './tabs/LawTab';
import { ProjectTab } from './tabs/ProjectTab';
import { ResultTab } from './tabs/ResultTab';
import { SimulatorTab } from './tabs/SimulatorTab';
import s from './panel.module.css';

const TABS: Array<{ index: TabIndex; label: string }> = [
  { index: 0, label: 'AI결과' },
  { index: 1, label: 'KPI·이력' },
  { index: 2, label: '프로젝트' },
  { index: 3, label: '법령·IFRS' },
  { index: 4, label: '공수시뮬' },
];

export function RightPanel() {
  const activeTab = useAppStore((st) => st.activeTab);
  const setTab = useAppStore((st) => st.setTab);

  return (
    <aside className={s.panel}>
      <div className={s.tabs} role="tablist" aria-label="우측 패널">
        {TABS.map((t) => (
          <button
            key={t.index}
            role="tab"
            aria-selected={activeTab === t.index}
            className={`${s.tab} ${activeTab === t.index ? s.tabActive : ''}`}
            onClick={() => setTab(t.index)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 0 && <ResultTab />}
      {activeTab === 1 && <KpiTab />}
      {activeTab === 2 && <ProjectTab />}
      {activeTab === 3 && <LawTab />}
      {activeTab === 4 && <SimulatorTab />}
    </aside>
  );
}

export default RightPanel;
