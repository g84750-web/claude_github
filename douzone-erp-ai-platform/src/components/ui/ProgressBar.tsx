import s from './ui.module.css';

export interface ProgressBarProps {
  /** 현재 값 */
  value: number;
  /** 최대값 (기본 100) */
  max?: number;
  /** CSS 변수명 */
  colorVar?: string;
  label?: string;
}

export function ProgressBar({ value, max = 100, colorVar = '--blue', label }: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={s.barWrap}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={s.barFill} style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
    </div>
  );
}

export default ProgressBar;
