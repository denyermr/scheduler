import { type Clock, defaultClock } from './clock';
import { cardId as defaultCardId, threadId as defaultThreadId } from './ids';
import { defaultRng, randomPin, randomRotation, type Rng } from './random';
import {
  type Board,
  type Card,
  type CardId,
  type Color,
  DAYS,
  type Day,
  type Thread,
  type ThreadId,
} from './types';
import { DEFAULT_WEEKS, MAX_WEEKS, MIN_WEEKS } from './weeks';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidWeeks(weeks: number, ctx: string): void {
  if (!Number.isInteger(weeks)) {
    throw new Error(`${ctx}: weeks must be an integer, got ${String(weeks)}`);
  }
  if (weeks < MIN_WEEKS || weeks > MAX_WEEKS) {
    throw new Error(
      `${ctx}: weeks must be in [${String(MIN_WEEKS)}, ${String(MAX_WEEKS)}], got ${String(weeks)}`,
    );
  }
}

function assertValidDay(day: Day, ctx: string): void {
  if (!DAYS.includes(day)) {
    throw new Error(`${ctx}: day must be one of 0..4, got ${String(day)}`);
  }
}

function assertOnBoardWeek(week: number, boardWeeks: number, ctx: string): void {
  if (!Number.isInteger(week) || week < 0 || week >= boardWeeks) {
    throw new Error(
      `${ctx}: week ${String(week)} out of range [0, ${String(boardWeeks)})`,
    );
  }
}

function findCardIndex(board: Board, id: CardId): number {
  return board.cards.findIndex((c) => c.id === id);
}

function nextZForCell(
  cards: readonly Card[],
  week: number,
  day: Day,
  excludeId?: CardId,
): number {
  let max = -1;
  let count = 0;
  for (const c of cards) {
    if (excludeId !== undefined && c.id === excludeId) continue;
    if (c.week !== week || c.day !== day) continue;
    count += 1;
    if (c.z > max) max = c.z;
  }
  return count === 0 ? 0 : max + 1;
}

function replaceAt<T>(arr: readonly T[], index: number, value: T): T[] {
  const next = arr.slice();
  next[index] = value;
  return next;
}

export function createBoard(opts: {
  startMonday: string;
  weeks?: number;
}): Board {
  if (typeof opts.startMonday !== 'string' || !ISO_DATE.test(opts.startMonday)) {
    throw new Error(
      `createBoard: startMonday must be YYYY-MM-DD, got ${String(opts.startMonday)}`,
    );
  }
  const weeks = opts.weeks ?? DEFAULT_WEEKS;
  assertValidWeeks(weeks, 'createBoard');
  return {
    startMonday: opts.startMonday,
    weeks,
    cards: [],
    threads: [],
  };
}

export type AddCardInput = {
  week: number;
  day: Day;
  color?: Color;
  text?: string;
  rng?: Rng;
  newId?: () => CardId;
  /** Injected clock; falls back to the deterministic zero clock for tests. */
  clock?: Clock;
};

export function addCard(
  board: Board,
  input: AddCardInput,
): { board: Board; cardId: CardId } {
  assertOnBoardWeek(input.week, board.weeks, 'addCard');
  assertValidDay(input.day, 'addCard');

  const rng = input.rng ?? defaultRng;
  const clock = input.clock ?? defaultClock;
  const id = input.newId ? input.newId() : defaultCardId(rng);
  const now = clock();
  const card: Card = {
    id,
    week: input.week,
    day: input.day,
    color: input.color ?? 'peach',
    text: input.text ?? '',
    rotation: randomRotation(rng),
    pin: randomPin(rng),
    createdAt: now,
    updatedAt: now,
    z: nextZForCell(board.cards, input.week, input.day),
  };
  return {
    board: { ...board, cards: [...board.cards, card] },
    cardId: id,
  };
}

export type UpdateCardOptions = { clock?: Clock };

export function updateCard(
  board: Board,
  cardId: CardId,
  patch: { text?: string; color?: Color },
  options: UpdateCardOptions = {},
): Board {
  const idx = findCardIndex(board, cardId);
  if (idx === -1) {
    throw new Error(`updateCard: no card with id ${cardId}`);
  }
  const existing = board.cards[idx];
  if (existing === undefined) {
    throw new Error(`updateCard: unreachable: index ${String(idx)} missing`);
  }
  const clock = options.clock ?? defaultClock;
  const next: Card = {
    ...existing,
    ...(patch.text !== undefined ? { text: patch.text } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    updatedAt: clock(),
  };
  return { ...board, cards: replaceAt(board.cards, idx, next) };
}

export type MoveCardOptions = { clock?: Clock };

export function moveCard(
  board: Board,
  cardId: CardId,
  to: { week: number; day: Day },
  options: MoveCardOptions = {},
): Board {
  assertOnBoardWeek(to.week, board.weeks, 'moveCard');
  assertValidDay(to.day, 'moveCard');

  const idx = findCardIndex(board, cardId);
  if (idx === -1) {
    throw new Error(`moveCard: no card with id ${cardId}`);
  }
  const existing = board.cards[idx];
  if (existing === undefined) {
    throw new Error(`moveCard: unreachable: index ${String(idx)} missing`);
  }
  if (existing.week === to.week && existing.day === to.day) {
    return board;
  }
  const clock = options.clock ?? defaultClock;
  const next: Card = {
    ...existing,
    week: to.week,
    day: to.day,
    updatedAt: clock(),
    z: nextZForCell(board.cards, to.week, to.day, existing.id),
  };
  return { ...board, cards: replaceAt(board.cards, idx, next) };
}

export function deleteCard(board: Board, cardId: CardId): Board {
  if (!board.cards.some((c) => c.id === cardId)) {
    throw new Error(`deleteCard: no card with id ${cardId}`);
  }
  return {
    ...board,
    cards: board.cards.filter((c) => c.id !== cardId),
    threads: board.threads.filter(
      (t) => t.fromCardId !== cardId && t.toCardId !== cardId,
    ),
  };
}

export type AddThreadInput = {
  fromCardId: CardId;
  toCardId: CardId;
  rng?: Rng;
  newId?: () => ThreadId;
};

export function addThread(
  board: Board,
  input: AddThreadInput,
): { board: Board; threadId: ThreadId } {
  if (input.fromCardId === input.toCardId) {
    throw new Error(`addThread: self-thread not allowed (${input.fromCardId})`);
  }
  const cardIds = new Set(board.cards.map((c) => c.id));
  if (!cardIds.has(input.fromCardId)) {
    throw new Error(`addThread: from-card ${input.fromCardId} does not exist`);
  }
  if (!cardIds.has(input.toCardId)) {
    throw new Error(`addThread: to-card ${input.toCardId} does not exist`);
  }
  const isDuplicate = board.threads.some(
    (t) =>
      (t.fromCardId === input.fromCardId && t.toCardId === input.toCardId) ||
      (t.fromCardId === input.toCardId && t.toCardId === input.fromCardId),
  );
  if (isDuplicate) {
    throw new Error(
      `addThread: duplicate thread between ${input.fromCardId} and ${input.toCardId}`,
    );
  }
  const id = input.newId
    ? input.newId()
    : defaultThreadId(input.rng ?? defaultRng);
  const thread: Thread = {
    id,
    fromCardId: input.fromCardId,
    toCardId: input.toCardId,
  };
  return {
    board: { ...board, threads: [...board.threads, thread] },
    threadId: id,
  };
}

export function deleteThread(board: Board, threadId: ThreadId): Board {
  if (!board.threads.some((t) => t.id === threadId)) {
    throw new Error(`deleteThread: no thread with id ${threadId}`);
  }
  return {
    ...board,
    threads: board.threads.filter((t) => t.id !== threadId),
  };
}

export function resizeWeeks(
  board: Board,
  weeks: number,
): { board: Board; offBoardCardIds: readonly CardId[] } {
  assertValidWeeks(weeks, 'resizeWeeks');
  const next: Board = { ...board, weeks };
  const offBoardCardIds = next.cards
    .filter((c) => c.week >= weeks)
    .map((c) => c.id);
  return { board: next, offBoardCardIds };
}

export function cardsOnBoard(board: Board): readonly Card[] {
  return board.cards.filter((c) => c.week < board.weeks);
}

export function cardsOffBoard(board: Board): readonly Card[] {
  return board.cards.filter((c) => c.week >= board.weeks);
}
