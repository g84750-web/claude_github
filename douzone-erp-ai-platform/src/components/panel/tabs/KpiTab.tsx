import { moduleName } from '../../../data/modules';
import { timeLabel } from '../../../lib/date';
import { resolveTokens, tokenContext } from '../../../lib/tokens';
import { useExecStore } from '../../../store/useExecStore';
import { AUTOMATION_TYPE_META, type AutomationType } from '../../../types/automation';
import { stageNameOf } from '../../../types/domain';
import { KPI_METAS } from '../../../types/kpi';
import { Icon, type IconName } from '../../ui/Icon';
import { ProgressBar } from '../../ui/ProgressBar';
import s from '../panel.module.css';

const TYPE_ICON: Record<AutomationType, IconName> = {
  auto: 'bolt',
  semi: 'userCheck',
  asst: 'chatbot',
};

export function KpiTab() {
  const kpi = useExecStore((st) => st.kpi());
  const log = useExecStore((st) => st.log);
  const ctx = tokenContext();

  return (
    <div className={s.pane}>
      <div className={s.kpiWrap}>
        <div className={s.sectLabel}>KPI 현황</div>
        {KPI_METAS.map((m) => {
          const value = kpi[m.key];
          return (
            <div className={s.kpiCard} key={m.key}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{m.label}</span>
                <span className={s.kpiValue} style={{ color: `var(${m.colorVar})` }}>
                  {value}%
                </span>
              </div>
              <ProgressBar value={value} max={m.max} colorVar={m.colorVar} label={m.label} />
              <div className={s.kpiMeta}>
                <span>목표 {m.target}%</span>
                <span>
                  달성률 {m.target > 0 ? Math.round((value / m.target) * 100) : 0}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={s.logWrap}>
        <div className={s.sectLabel} style={{ padding: '7px 10px 3px' }}>
          실행 이력 ({log.length})
        </div>

        {log.length === 0 ? (
          <div className={s.emptyNote}>
            아직 실행한 항목이 없습니다.
            <br />
            자동화 항목을 실행하면 이력이 누적됩니다.
          </div>
        ) : (
          // 역순 정렬 — 최신 우선
          [...log].reverse().map((r, i) => {
            const meta = AUTOMATION_TYPE_META[r.type];
            return (
              <div className={s.logItem} key={`${r.itemId}-${r.timestamp}-${i}`}>
                <Icon
                  name={TYPE_ICON[r.type]}
                  size={13}
                  color={`var(${meta.fgVar})`}
                />
                <div className={s.logBody}>
                  <div className={s.logTask} title={resolveTokens(r.task, ctx)}>
                    {resolveTokens(r.task, ctx)}
                  </div>
                  <div className={s.logMeta}>
                    {timeLabel(r.timestamp)} · {r.product} {r.moduleId} {moduleName(r.moduleId)} ·{' '}
                    {stageNameOf(r.stageIndex)}
                    {r.liveApi ? ' · AI' : ''}
                  </div>
                </div>
                <span className={s.logHours}>-{r.hours}h</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default KpiTab;
