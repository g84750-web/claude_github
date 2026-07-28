import { useToastStore, type ToastKind } from '../../store/useToastStore';
import { Icon, type IconName } from './Icon';
import s from './ui.module.css';

const KIND_STYLE: Record<ToastKind, { cls: string; icon: IconName }> = {
  ok: { cls: s.toastOk, icon: 'circleCheck' },
  warn: { cls: s.toastWarn, icon: 'alertTriangle' },
  error: { cls: s.toastError, icon: 'alertCircle' },
};

export function Toast() {
  const items = useToastStore((st) => st.items);
  const dismiss = useToastStore((st) => st.dismiss);

  if (items.length === 0) return null;

  return (
    <div className={s.toastWrap} role="status" aria-live="polite">
      {items.map((t) => {
        const k = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            className={`${s.toast} ${k.cls}`}
            onClick={() => dismiss(t.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && dismiss(t.id)}
          >
            <Icon name={k.icon} size={14} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

export default Toast;
