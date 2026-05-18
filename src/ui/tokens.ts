import {
  CARD_COLORS,
  type Color,
  type Day,
  DAYS,
  type Pin,
} from '../domain/types';

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

/**
 * Page background — the soft cool off-white the board floats on (v2).
 * Matches the SCREEN_BG gradient in design/screens.jsx.
 */
export const PAGE_BG = `
  radial-gradient(ellipse 900px 700px at 12% -6%, rgba(180,200,230,0.35), transparent 60%),
  radial-gradient(ellipse 1100px 800px at 105% 110%, rgba(200,210,225,0.30), transparent 65%),
  linear-gradient(180deg, #eef0f4 0%, #e1e4ec 100%)
`;

export const URL_CHIP_DIM = '#7a8295';
export const URL_CHIP_BRIGHT = '#2a3142';

export const SURFACE = {
  cork: 'linear-gradient(180deg, #c9a978 0%, #b89465 100%)',
  paper: '#f6f2ec',
  inkDark: '#2a1f15',
  inkMid: '#6b5a48',
  inkOnCork: '#3a2410',
} as const;

export const CORK_TEXTURE_BG = `
  radial-gradient(circle at 22% 18%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
  radial-gradient(circle at 71% 64%, rgba(0,0,0,.04) 0 1px, transparent 1.5px),
  radial-gradient(circle at 44% 88%, rgba(0,0,0,.05) 0 1px, transparent 1.5px),
  radial-gradient(circle at 88% 12%, rgba(255,255,255,.05) 0 1.2px, transparent 2px),
  ${SURFACE.cork}`;

export const CORK_TEXTURE_SIZE =
  '13px 13px, 9px 9px, 17px 17px, 11px 11px, 100% 100%';

/** Cork inner glow + hairline edge (v2 — softer + cooler than v1). */
export const CORK_INSET_SHADOW =
  'inset 0 0 28px rgba(60,30,10,.16), inset 0 0 0 1px rgba(40,30,15,.28)';

export const CORK_RADIUS = 3;

/** Floating elevated shadow that replaces the wood frame (v2). */
export const BOARD_FLOAT_SHADOW =
  '0 40px 80px -24px rgba(30,40,60,.28), 0 14px 32px -12px rgba(30,40,60,.18), 0 2px 6px rgba(30,40,60,.10)';

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

/** Thread-creation handle (workflow 03) — 10 px red-brown disc with white ring. */
export const THREAD_HANDLE_FILL = '#9c5a2e';
export const THREAD_HANDLE_RING = '#ffffff';
/** Stroke color used for the brief click-flash before a thread is deleted. */
export const THREAD_DELETE_FLASH_STROKE = '#d6463a';
/** Duration of the click-flash before the thread is removed (ms). */
export const THREAD_DELETE_FLASH_MS = 100;
/** Invisible hit-area stroke width (px) used to make the thread clickable. */
export const THREAD_HIT_WIDTH = 12;
/** Dash pattern for the in-progress thread path while drawing. */
export const THREAD_DRAWING_DASH = '5 4';

/**
 * Stacking level for the threads layer. Sits above resting cards (default
 * z=0 in their cell) so a thread between two vertically aligned cards
 * (which always visually overlap, since rendered card height exceeds cellH)
 * remains visible. Stays below hovered (500) / lifted (1000) cards so the
 * drag-lift visual still floats above the threads, and below the popover
 * anchor (30) so the edit popover isn't covered.
 */
export const THREAD_LAYER_Z = 10;

/** Day-header badge styling. Weekend (Sat=5, Sun=6) is muted. */
export const DAY_HEADER_BADGE = {
  weekday: {
    fill: '#F4B584',
    fontSize: 18,
    opacity: 1,
  },
  weekend: {
    fill: '#e9c79a',
    fontSize: 16,
    opacity: 0.78,
  },
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

/**
 * Drag timing constants — Phase 4 workflow 02.
 *
 * - `DRAG_LIFT_MS`: a card lifts after this many ms of pointer-hold (rotation
 *   resets, slight scale-up, larger shadow). Shorter than the spec's 80ms
 *   would catch double-clicks; longer would feel sluggish.
 * - `DRAG_SNAP_MS`: ease-out duration when the card lands in its target cell.
 *
 * Both values are pinned by integration tests with fake timers.
 */
export const DRAG_LIFT_MS = 80;
export const DRAG_SNAP_MS = 120;
export const DRAG_LIFT_SCALE = 1.05;
export const DRAG_LIFT_SHADOW =
  '0 8px 18px rgba(0,0,0,.30), 0 2px 4px rgba(0,0,0,.20)';

const DAY_LABELS = [
  'MON',
  'TUES',
  'WED',
  'THURS',
  'FRI',
  'SAT',
  'SUN',
] as const;
export const DAY_HEADER_LABELS: readonly string[] = DAY_LABELS;
export const WEEKEND_DAY_INDICES: readonly number[] = [5, 6];

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

/** Canonical metrics. Header + rail are fixed; cell dimensions are fluid. */
export const BOARD_FIXED_METRICS = {
  railW: 64,
  headerH: 32,
  horizontalMargin: 48,
} as const;

export const CELL_W_MIN = 120;
export const CELL_W_MAX = 180;
export const CELL_ASPECT = 0.55;

export type BoardMetrics = {
  cellW: number;
  cellH: number;
  railW: number;
  headerH: number;
};

/**
 * Compute the per-cell metrics for a given container width, per CLAUDE.md §4
 * "Board sizing (fluid)":
 *   cellW = clamp(120, (containerWidth − railW − margin) / 7, 180)
 *   cellH = round(cellW × 0.55)
 */
export function computeBoardMetrics(
  containerWidth: number,
  opts?: {
    railW?: number;
    headerH?: number;
    margin?: number;
  },
): BoardMetrics {
  const railW = opts?.railW ?? BOARD_FIXED_METRICS.railW;
  const headerH = opts?.headerH ?? BOARD_FIXED_METRICS.headerH;
  const margin = opts?.margin ?? BOARD_FIXED_METRICS.horizontalMargin;
  const raw = (containerWidth - railW - margin) / 7;
  const cellW = clamp(raw, CELL_W_MIN, CELL_W_MAX);
  const cellH = Math.round(cellW * CELL_ASPECT);
  return { cellW, cellH, railW, headerH };
}

/** Pixel center of the (week, day) cell on the cork surface. */
export function cellCenter(
  pos: { week: number; day: Day },
  metrics: BoardMetrics,
): { x: number; y: number } {
  return {
    x: metrics.railW + pos.day * metrics.cellW + metrics.cellW / 2,
    y: metrics.headerH + pos.week * metrics.cellH + metrics.cellH / 2,
  };
}

/**
 * Reverse of `cellCenter`: pixel → (week, day). Returns null when the point
 * is outside the grid (header row, week rail, or past the board edges).
 * Phase 3 click-to-create routes via per-cell DOM hit targets, but Phase 4's
 * drag-over will read continuous coordinates through this helper.
 */
export function cellAt(
  x: number,
  y: number,
  metrics: BoardMetrics,
  weeks: number,
): { week: number; day: Day } | null {
  const { cellW, cellH, railW, headerH } = metrics;
  if (x < railW || y < headerH) return null;
  const dayIdx = Math.floor((x - railW) / cellW);
  const week = Math.floor((y - headerH) / cellH);
  if (dayIdx < 0 || dayIdx >= DAYS.length) return null;
  if (week < 0 || week >= weeks) return null;
  const day = DAYS[dayIdx];
  if (day === undefined) return null;
  return { week, day };
}
