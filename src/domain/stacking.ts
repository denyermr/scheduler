import { type Clock, defaultClock } from './clock';
import type { Board, Card, Day, Week } from './types';

export type Offset = { x: number; y: number };

/**
 * Deterministic in-cell offsets, indexed `i = 0..n-1` by createdAt ascending.
 * Formula from CLAUDE.md §4 "Stacking offsets":
 *   x[i] = (-1)^i * (4 + i*3)
 *   y[i] = (-1)^i * (3 + i*2.5)
 *
 * For N = 1 the §4 formula does not apply — a single card sits centred at
 * (0, 0). For N = 0 the function returns an empty array.
 */
export function stackOffsets(n: number): Offset[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`stackOffsets: n must be a non-negative integer, got ${String(n)}`);
  }
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];
  const offsets: Offset[] = [];
  for (let i = 0; i < n; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    offsets.push({
      x: sign * (4 + i * 3),
      y: sign * (3 + i * 2.5),
    });
  }
  return offsets;
}

/** Returns the cards in the given cell. Stable order by `z` ascending. */
export function cardsInCell(
  board: Board,
  week: Week,
  day: Day,
): readonly Card[] {
  return board.cards
    .filter((c) => c.week === week && c.day === day)
    .slice()
    .sort((a, b) => a.z - b.z);
}

/**
 * Promotes the bottom (lowest-z) card of a (week, day) cell to the new top,
 * by giving it `z = max(other z in cell) + 1`. Bumps that card's `updatedAt`.
 * No-op if the cell has 0 or 1 cards.
 *
 * `z` values outside the target cell are not touched. Threads, board metadata,
 * and other cards are returned by reference.
 */
export function cycleStack(
  board: Board,
  week: Week,
  day: Day,
  options: { clock?: Clock } = {},
): Board {
  const stack = cardsInCell(board, week, day);
  if (stack.length < 2) return board;
  const bottom = stack[0];
  const top = stack[stack.length - 1];
  if (!bottom || !top) return board;
  const clock = options.clock ?? defaultClock;
  const nextZ = top.z + 1;
  const promoted: Card = {
    ...bottom,
    z: nextZ,
    updatedAt: clock(),
  };
  return {
    ...board,
    cards: board.cards.map((c) => (c.id === bottom.id ? promoted : c)),
  };
}
