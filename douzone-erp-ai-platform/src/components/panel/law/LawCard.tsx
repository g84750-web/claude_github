import { badgeLevel, daysUntil, elapsedLabel } from '../../../lib/date';
import { fiscalYears } from '../../../lib/date';
import { useAppStore } from '../../../store/useAppStore';
import type { LawDateContext, LawItem, LawTagStyle } from '../../../types/law';
import s from '../panel.module.css';

const TAG_CLASS: Record<LawTagStyle, string> = {
  ifrs: s.lawIfrs,
  tax: s.lawTax,
  new: s.lawNew,
  warn: s.lawWarn,
};

const DDAY_CLASS = {
  'upcoming-far': s.ddayFar,
  'upcoming-near': s.ddayNear,
  dday: s.ddayToday,
  active: s.ddayActive,
} as const;

/** 법령 카드 본문에 주입할 런타임 날짜 컨텍스트 */
export function buildLawContext(law: LawItem, base: Date = new Date()): LawDateContext {
  const d = daysUntil(law.effectiveDate, base);
  const { cy, py, ppy } = fiscalYears(base);
  return {
    sincePublished: elapsedLabel(law.publishedDate, base),
    sinceEffective: elapsedLabel(law.effectiveDate, base),
    daysToEffective: d,
    daysSinceEffective: Math.max(0, -d),
    currentYear: cy,
    priorYear: py,
    priorPriorYear: ppy,
  };
}

export function LawCard({ law, base }: { law: LawItem; base: Date }) {
  const gotoLawTab = useAppStore((st) => st.gotoLawTab);

  const ctx = buildLawContext(law, base);
  const badge = badgeLevel(law.effectiveDate, base);

  return (
    <article className={s.lawCard}>
      <div className={s.lawHead}>
        <span className={`${s.lawTag} ${TAG_CLASS[law.tagStyle]}`}>{law.tag}</span>
        <span className={s.lawTitle}>{law.title}</span>
        <span className={`${s.dday} ${DDAY_CLASS[badge.level]}`}>{badge.label}</span>
      </div>

      {/* 본문은 신뢰된 내부 데이터만 사용하며 강조 태그(<strong>)만 포함한다 */}
      <div className={s.lawBody} dangerouslySetInnerHTML={{ __html: law.buildBody(ctx) }} />

      <ul className={s.lawBullets}>
        {law.bullets.map((b, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: b }} />
        ))}
      </ul>

      <div className={s.lawActions}>
        <span className={s.lawDate}>
          발행 {law.publishedDate} · 시행 {law.effectiveDate}
        </span>
        {law.actions?.map((a) => (
          <button
            key={a.label}
            className={s.btn}
            style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 9px' }}
            onClick={() => gotoLawTab(a.action === 'goCompare' ? 2 : 3)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </article>
  );
}

export default LawCard;
