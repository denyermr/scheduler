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
