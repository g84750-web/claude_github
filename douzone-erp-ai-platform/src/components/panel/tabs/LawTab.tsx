import { useMemo } from 'react';
import { buildLaws } from '../../../data/laws';
import { useAppStore, type LawTabIndex } from '../../../store/useAppStore';
import { AiQueryPane } from '../law/AiQueryPane';
import { ComparePane } from '../law/ComparePane';
import { LawCard } from '../law/LawCard';
import s from '../panel.module.css';

const SUB_TABS: Array<{ index: LawTabIndex; label: string }> = [
  { index: 0, label: 'K-IFRS' },
  { index: 1, label: '세법변경' },
  { index: 2, label: '비교검증' },
  { index: 3, label: 'AI조회' },
];

export function LawTab() {
  const activeLawTab = useAppStore((st) => st.activeLawTab);
  const setLawTab = useAppStore((st) => st.setLawTab);

  // [제약] 법령 목록·D-Day 는 렌더 시점 기준으로 산출
  const base = useMemo(() => new Date(), [activeLawTab]);
  const laws = useMemo(() => buildLaws(base), [base]);

  const ifrs = laws.filter((l) => l.category === 'ifrs');
  const tax = laws.filter((l) => l.category === 'tax');

  return (
    <div className={s.pane}>
      <div className={s.lawTabs} role="tablist" aria-label="법령 서브탭">
        {SUB_TABS.map((t) => (
          <button
            key={t.index}
            role="tab"
            aria-selected={activeLawTab === t.index}
            className={`${s.lawTab} ${activeLawTab === t.index ? s.lawTabActive : ''}`}
            onClick={() => setLawTab(t.index)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeLawTab === 0 && (
        <div className={s.paneScroll}>
          {ifrs.map((l) => (
            <LawCard key={l.id} law={l} base={base} />
          ))}
        </div>
      )}

      {activeLawTab === 1 && (
        <div className={s.paneScroll}>
          {tax.map((l) => (
            <LawCard key={l.id} law={l} base={base} />
          ))}
        </div>
      )}

      {activeLawTab === 2 && <ComparePane base={base} />}
      {activeLawTab === 3 && <AiQueryPane />}
    </div>
  );
}

export default LawTab;
