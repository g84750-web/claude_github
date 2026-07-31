/**
 * 인라인 SVG 아이콘 컴포넌트
 *
 * [절대 제약] 외부 CDN(Tabler Icons CDN, 아이콘 웹폰트 등) 사용 금지.
 * 과거 CORS / cssRules 접근 오류가 반복 발생하여 전 아이콘을 인라인 path 로 직접 정의한다.
 * 네트워크 요청이 발생하지 않으므로 오프라인/폐쇄망에서도 동일하게 렌더된다.
 */

type PathDef = string | readonly string[];

/** 24×24 viewBox 기준 stroke path 정의 */
const PATHS = {
  // ── 상태 / 자동화 유형 ──
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  userCheck: [
    'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2',
    'M9 11a4 4 0 100-8 4 4 0 000 8z',
    'M16 11l2 2 4-4',
  ],
  chatbot: [
    'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    'M8 10h.01M12 10h.01M16 10h.01',
  ],

  // ── 실행 / 진행 ──
  playerPlay: 'M8 5v14l11-7L8 5z',
  check: 'M20 6L9 17l-5-5',
  circleCheck: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M8.5 12.5l2.5 2.5 4.5-5'],
  checks: ['M1 12l5 5 6-6', 'M11 17l1 1 10-10'],
  loader: 'M12 3a9 9 0 109 9h-2a7 7 0 11-7-7V3z',
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0114.85-3.36L23 10',
    'M1 14l4.64 4.36A9 9 0 0020.49 15',
  ],

  // ── 지표 / 통계 ──
  clock: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 6v6l4 2'],
  chartBar: ['M6 20v-5', 'M12 20V9', 'M18 20V4'],
  trendingUp: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  flame: [
    'M12 22c4 0 7-2.5 7-6.5 0-3-2-5-3.5-7.5C14 5.5 13 3 12 2c-1 3-3 4.5-4.5 6.5C6 11 5 13 5 15.5 5 19.5 8 22 12 22z',
    'M12 18a2.5 2.5 0 002.5-2.5c0-1.5-1-2.5-2.5-4.5-1.5 2-2.5 3-2.5 4.5A2.5 2.5 0 0012 18z',
  ],
  target: [
    'M12 22a10 10 0 100-20 10 10 0 000 20z',
    'M12 18a6 6 0 100-12 6 6 0 000 12z',
    'M12 14a2 2 0 100-4 2 2 0 000 4z',
  ],

  // ── API / 시스템 ──
  key: [
    'M9.5 20a5.5 5.5 0 110-11 5.5 5.5 0 010 11z',
    'M13.4 11.6L21 4',
    'M18 7l2 2M15.5 9.5l2 2',
  ],
  deviceFloppy: [
    'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  api: ['M8 4L3 12l5 8', 'M16 4l5 8-5 8', 'M14 3l-4 18'],
  plug: ['M9 2v6M15 2v6', 'M6 8h12v4a6 6 0 01-12 0z', 'M12 18v4'],
  database: [
    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z',
    'M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3',
    'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
  ],
  settingsAutomation: [
    'M12 15a3 3 0 100-6 3 3 0 000 6z',
    'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-2.82-1.18l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003.6 15H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6V4a2 2 0 114 0v.09a1.65 1.65 0 002.82 1.18l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0020.4 11H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  ],
  layoutGrid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  sparkles: [
    'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z',
    'M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15z',
  ],

  // ── 문서 / 편집 ──
  copy: [
    'M9 9h11a2 2 0 012 2v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9a2 2 0 012-2z',
    'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  ],
  download: ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  notes: [
    'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
    'M14 2v6h6',
    'M16 13H8M16 17H8M10 9H8',
  ],
  forms: ['M3 5h18v14H3z', 'M7 9h6M7 13h10'],
  checklist: [
    'M9 6h11M9 12h11M9 18h11',
    'M3.5 6L5 7.5 7.5 5',
    'M3.5 12L5 13.5 7.5 11',
    'M3.5 18L5 19.5 7.5 17',
  ],
  edit: [
    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
    'M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6',
    'M10 11v6M14 11v6',
  ],
  history: ['M3.05 11a9 9 0 1 0 2.13-5.66', 'M3 3v5h5', 'M12 8v4.5l3 1.5'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 100-6 3 3 0 000 6z'],
  gitCompare: [
    'M6 21a3 3 0 100-6 3 3 0 000 6z',
    'M18 9a3 3 0 100-6 3 3 0 000 6z',
    'M13 6H8a2 2 0 00-2 2v7',
    'M11 18h5a2 2 0 002-2V9',
  ],

  // ── 기타 ──
  building: ['M3 21h18', 'M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16', 'M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2'],
  link: [
    'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  ],
  externalLink: ['M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6', 'M15 3h6v6', 'M10 14L21 3'],
  calendar: ['M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', 'M16 2v4M8 2v4M3 10h18'],
  infoCircle: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 16v-4M12 8h.01'],
  alertCircle: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 8v4M12 16h.01'],
  alertTriangle: [
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    'M12 9v4M12 17h.01',
  ],
  moodEmpty: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M8 15h8', 'M9 9h.01M15 9h.01'],
  point: 'M12 9a3 3 0 100 6 3 3 0 000-6z',
  x: 'M18 6L6 18M6 6l12 12',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  search: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.35-4.35'],
} as const satisfies Record<string, PathDef>;

export type IconName = keyof typeof PATHS;

/** 전체 아이콘 이름 (아이콘 갤러리/검증용) */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/** 채움(fill) 렌더 대상 — 나머지는 stroke 렌더 */
const FILLED: ReadonlySet<string> = new Set<IconName>(['playerPlay', 'point', 'loader']);

export interface IconProps {
  name: IconName;
  /** px 단위 크기 (정사각) */
  size?: number;
  /** stroke/fill 색상. 기본 currentColor */
  color?: string;
  strokeWidth?: number;
  className?: string;
  /** 회전 애니메이션 (실행 중 로더) */
  spin?: boolean;
  /** 제공 시 접근성 라벨로 노출, 미제공 시 aria-hidden */
  title?: string;
  style?: React.CSSProperties;
}

export function Icon({
  name,
  size = 14,
  color = 'currentColor',
  strokeWidth = 2,
  className,
  spin = false,
  title,
  style,
}: IconProps) {
  const def = PATHS[name] as PathDef;
  const paths: readonly string[] = typeof def === 'string' ? [def] : def;
  const filled = FILLED.has(name);
  const cls = [spin ? 'dz-spin' : '', className ?? ''].filter(Boolean).join(' ') || undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      style={{ flexShrink: 0, display: 'block', ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export default Icon;
