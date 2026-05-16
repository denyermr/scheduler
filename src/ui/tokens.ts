import { CARD_COLORS, type Color, type Pin } from '../domain/types';

export type ColorToken = { readonly fill: string; readonly ink: string };

export const CARD_PALETTE: Readonly<Record<Color, ColorToken>> = {
  peach: { fill: '#F4B584', ink: '#5a3520' },
  coral: { fill: '#F26B86', ink: '#4a1a26' },
  orange: { fill: '#EE7A3E', ink: '#4a1f0a' },
  salmon: { fill: '#F5A088', ink: '#4a221a' },
  yellow: { fill: '#F5D257', ink: '#4a3c10' },
  mint: { fill: '#9BD3B0', ink: '#1f3f2c' },
  sky: { fill: '#6FA8D8', ink: '#102a44' },
  lilac: { fill: '#B89DD0', ink: '#2c1f44' },
};

export const PIN_PALETTE = {
  red: '#d6463a',
  yellow: '#e9b834',
  blue: '#3a7ed6',
  green: '#3aa15a',
  white: '#f5f1e6',
} as const satisfies Record<string, Pin>;

export const SURFACE = {
  page: '#3a2410',
  cork: 'linear-gradient(180deg, #c9a978 0%, #b89465 100%)',
  wood: 'linear-gradient(180deg, #b8845a 0%, #a06c3e 40%, #8a5530 100%)',
  paper: '#f6f2ec',
  inkDark: '#2a1f15',
  inkMid: '#6b5a48',
} as const;

export const CORK_TEXTURE_BG = `
  radial-gradient(circle at 22% 18%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
  radial-gradient(circle at 71% 64%, rgba(0,0,0,.04) 0 1px, transparent 1.5px),
  radial-gradient(circle at 44% 88%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
  radial-gradient(circle at 88% 12%, rgba(255,255,255,.05) 0 1.2px, transparent 2px),
  ${SURFACE.cork}`;

export const CORK_TEXTURE_SIZE =
  '13px 13px, 9px 9px, 17px 17px, 11px 11px, 100% 100%';

export const FONTS = {
  caveat: "'Caveat', cursive",
  marker: "'Permanent Marker', 'Caveat', cursive",
  body: "'Manrope', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const GRID_LINE = 'rgba(40,20,5,.22)';
export const GRID_EDGE = 'rgba(0,0,0,.3)';
export const GRID_HEADER_RULE = 'rgba(0,0,0,.35)';

export const THREAD_STROKE = '#9c5a2e';
export const THREAD_WIDTH = 1.8;
export const THREAD_OPACITY = 0.92;

export const BOARD_DEFAULT_METRICS = {
  cellW: 56,
  cellH: 38,
  railW: 64,
  headerH: 32,
} as const;

export const BOARD_HERO_METRICS = {
  cellW: 84,
  cellH: 42,
  railW: 80,
  headerH: 36,
} as const;

export const FRAME_PADDING = {
  top: 8,
  right: 14,
  bottom: 24,
  left: 12,
} as const;

export const CARD_BASE = {
  width: 78,
  minHeight: 30,
  paddingY: 6,
  paddingRight: 8,
  paddingLeft: 12,
  borderRadius: 1.5,
} as const;

export const PIN_SIZE = 5;

const DAY_LABELS = ['MON', 'TUES', 'WED', 'THURS', 'FRI'] as const;
export const DAY_HEADER_LABELS: readonly string[] = DAY_LABELS;

export const CARD_PALETTE_FILLS: readonly string[] = CARD_COLORS.map(
  (k) => CARD_PALETTE[k].fill,
);

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function threadSag(distance: number): number {
  return clamp(distance * 0.06, 8, 22);
}

export function threadPathD(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sag: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  return `M ${String(x1)} ${String(y1)} Q ${String(mx)} ${String(my)} ${String(x2)} ${String(y2)}`;
}
