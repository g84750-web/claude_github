import type { ReactNode } from 'react';
import s from './ui.module.css';

export interface BadgeProps {
  children: ReactNode;
  /** CSS 변수명 (예: '--green') */
  colorVar?: string;
  bgVar?: string;
  /** 테두리 표시 여부 */
  bordered?: boolean;
  title?: string;
}

export function Badge({
  children,
  colorVar = '--t2',
  bgVar = '--s2',
  bordered = true,
  title,
}: BadgeProps) {
  return (
    <span
      className={s.badge}
      title={title}
      style={{
        color: `var(${colorVar})`,
        background: `var(${bgVar})`,
        borderColor: bordered ? `color-mix(in srgb, var(${colorVar}) 35%, transparent)` : 'transparent',
      }}
    >
      {children}
    </span>
  );
}

export default Badge;
