import { resolveTokens, type TokenContext } from '../../lib/tokens';
import { useExecStore } from '../../store/useExecStore';
import {
  AUTOMATION_TYPE_META,
  type AutomationItem,
  type AutomationType,
  type CardState,
} from '../../types/automation';
import { Icon, type IconName } from '../ui/Icon';
import s from './center.module.css';

const TYPE_ICON: Record<AutomationType, IconName> = {
  auto: 'bolt',
  semi: 'userCheck',
  asst: 'chatbot',
};

const STATE_CLASS: Record<CardState, string> = {
  idle: '',
  running: s.cardRunning,
  done: s.cardDone,
  error: s.cardError,
};

const BTN_CLASS: Record<CardState, string> = {
  idle: '',
  running: s.runBtnRunning,
  done: s.runBtnDone,
  error: s.runBtnError,
};

const BTN_LABEL: Record<CardState, string> = {
  idle: '실행',
  running: '실행 중',
  done: '완료',
  error: '재시도',
};

const BTN_ICON: Record<CardState, IconName> = {
  idle: 'playerPlay',
  running: 'loader',
  done: 'check',
  error: 'refresh',
};

export interface AutomationCardProps {
  item: AutomationItem;
  ctx: TokenContext;
  onRun: (item: AutomationItem) => void;
}

export function AutomationCard({ item, ctx, onRun }: AutomationCardProps) {
  const state = useExecStore((st) => st.cardStates[item.id] ?? 'idle');
  const meta = AUTOMATION_TYPE_META[item.type];

  return (
    <article className={`${s.card} ${STATE_CLASS[state]}`}>
      <span
        className={s.typePill}
        style={{ background: `var(${meta.bgVar})`, color: `var(${meta.fgVar})` }}
      >
        <Icon name={TYPE_ICON[item.type]} size={11} />
        {meta.label}
      </span>

      <div className={s.body}>
        <div className={s.task}>{resolveTokens(item.task, ctx)}</div>
        <div className={s.meta}>
          <span className={s.tool}>{resolveTokens(item.tool, ctx)}</span>
          <span className={s.hours}>-{item.hours}h</span>
          {item.tags?.map((t) => (
            <span className={s.tag} key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <button
        className={`${s.runBtn} ${BTN_CLASS[state]}`}
        onClick={() => onRun(item)}
        disabled={state === 'running'}
        aria-label={`${resolveTokens(item.task, ctx)} ${BTN_LABEL[state]}`}
      >
        <Icon name={BTN_ICON[state]} size={11} spin={state === 'running'} />
        {BTN_LABEL[state]}
      </button>
    </article>
  );
}

export default AutomationCard;
