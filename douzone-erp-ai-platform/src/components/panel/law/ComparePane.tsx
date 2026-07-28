import { COMPLIANCE_DEFS, buildLaws } from '../../../data/laws';
import { badgeLevel } from '../../../lib/date';
import { useExecStore } from '../../../store/useExecStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { allItems } from '../../../data/automation';
import type { ComplianceCheck, ComplianceStatus } from '../../../types/law';
import { COMPLIANCE_STATUS_LABEL } from '../../../types/law';
import { Badge } from '../../ui/Badge';
import { Icon, type IconName } from '../../ui/Icon';
import { buildLawContext } from './LawCard';
import s from '../panel.module.css';

const STATUS_META: Record<ComplianceStatus, { colorVar: string; bgVar: string; icon: IconName }> = {
  ok: { colorVar: '--green', bgVar: '--gbg', icon: 'circleCheck' },
  review: { colorVar: '--amber', bgVar: '--abg', icon: 'alertTriangle' },
  action: { colorVar: '--red', bgVar: '--rbg', icon: 'alertCircle' },
};

/**
 * 실행 이력과 법령 시행일을 대조해 대응 현황을 판정한다.
 *  · 관련 항목 실행 있음        → 정상
 *  · 미실행 + 시행 임박/시행 중 → 대응 필요
 *  · 미실행 + 시행 여유         → 검토 필요
 */
export function ComparePane({ base }: { base: Date }) {
  const log = useExecStore((st) => st.log);
  const isSaved = useProjectStore((st) => st.isSaved());
  const laws = buildLaws(base);

  const executedModules = new Set(log.map((r) => r.moduleId));

  // 태그 기준 매칭을 위해 전 항목 인덱스를 만든다
  const itemTags = new Map(allItems().map(({ item }) => [item.id, item.tags ?? []]));

  const checks: ComplianceCheck[] = COMPLIANCE_DEFS.map((def) => {
    const law = def.lawId ? laws.find((l) => l.id === def.lawId) : undefined;
    const ctx = law ? buildLawContext(law, base) : undefined;

    const tagHit = def.tags
      ? log.some((r) => (itemTags.get(r.itemId) ?? []).some((t) => def.tags!.includes(t)))
      : false;
    const moduleHit = def.modules ? def.modules.some((m) => executedModules.has(m)) : false;
    const hit = tagHit || moduleHit;

    let status: ComplianceStatus;
    let detail: string;

    if (hit) {
      status = 'ok';
      detail = tagHit ? '관련 태그 항목 실행 완료' : '관련 모듈 항목 실행 완료';
    } else if (law) {
      const badge = badgeLevel(law.effectiveDate, base);
      const urgent = badge.level !== 'upcoming-far';
      status = urgent ? 'action' : 'review';
      detail = `${law.tag} ${badge.label} — 관련 항목 미실행`;
    } else {
      status = 'review';
      detail = '관련 항목 미실행';
    }

    return {
      id: def.id,
      label: ctx ? def.label(ctx) : def.label(buildLawContext(laws[0], base)),
      status,
      detail,
    };
  });

  const okCount = checks.filter((c) => c.status === 'ok').length;

  return (
    <div className={s.paneScroll}>
      {!isSaved && (
        <div className={s.sect} style={{ borderColor: 'var(--amber-a30)' }}>
          <div className={s.sectTitle} style={{ color: 'var(--amber)' }}>
            <Icon name="infoCircle" size={12} />
            프로젝트 정보 미등록
          </div>
          <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.7 }}>
            프로젝트 탭에서 프로젝트명과 고객사명을 저장하면 검증 결과를 프로젝트 기준으로
            해석할 수 있습니다. 아래 판정은 실행 이력만으로 산출된 값입니다.
          </p>
        </div>
      )}

      <div className={s.sect}>
        <div className={s.sectTitle}>
          <Icon name="gitCompare" size={12} />
          대응 현황 검증
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)' }}>
            {okCount}/{checks.length} 정상
          </span>
        </div>

        {checks.map((c) => {
          const meta = STATUS_META[c.status];
          return (
            <div className={s.checkRow} key={c.id}>
              <Icon name={meta.icon} size={13} color={`var(${meta.colorVar})`} />
              <div className={s.checkBody}>
                <div className={s.checkLabel}>{c.label}</div>
                <div className={s.checkDetail}>{c.detail}</div>
              </div>
              <Badge colorVar={meta.colorVar} bgVar={meta.bgVar}>
                {COMPLIANCE_STATUS_LABEL[c.status]}
              </Badge>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.7, padding: '0 2px' }}>
        판정 기준: 해당 태그·모듈의 자동화 항목 실행 여부와 법령 시행일(D-Day)을 대조합니다.
        실행 이력은 세션 단위로 유지됩니다. 실행 {log.length}건 반영.
      </p>
    </div>
  );
}

export default ComparePane;
