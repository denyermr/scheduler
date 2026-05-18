export const CARD_COLORS = [
  'peach',
  'coral',
  'orange',
  'salmon',
  'yellow',
  'mint',
  'sky',
  'lilac',
] as const;
export type Color = (typeof CARD_COLORS)[number];

export const PIN_COLORS = [
  '#d6463a',
  '#e9b834',
  '#3a7ed6',
  '#3aa15a',
  '#f5f1e6',
] as const;
export type Pin = (typeof PIN_COLORS)[number];

export const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Day = (typeof DAYS)[number];

export type Week = number;
export type Rotation = number;

export type CardId = string;
export type ThreadId = string;

export type Card = {
  readonly id: CardId;
  readonly week: Week;
  readonly day: Day;
  readonly color: Color;
  readonly text: string;
  readonly rotation: Rotation;
  readonly pin: Pin;
  /** Unix epoch ms set on create, never modified. */
  readonly createdAt: number;
  /** Unix epoch ms bumped on every mutation (text, color, week, day, z-cycle). */
  readonly updatedAt: number;
  /**
   * Stack order within the card's (week, day) cell. Higher = on top.
   * Assigned by `addCard` / `moveCard` as `max(z in target cell) + 1`,
   * or 0 if the target cell is empty. Cycled in-place by `cycleStack`.
   * The render-time offset within the cell is derived from `z` ordering
   * via `stackOffsets(N)` — see CLAUDE.md §4.
   */
  readonly z: number;
};

export type Thread = {
  readonly id: ThreadId;
  readonly fromCardId: CardId;
  readonly toCardId: CardId;
};

export type Board = {
  readonly startMonday: string;
  readonly weeks: number;
  readonly cards: readonly Card[];
  readonly threads: readonly Thread[];
};
