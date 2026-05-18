import { describe, expect, it } from 'vitest';

import {
  addCard,
  type Board,
  createBoard,
  cycleStack,
  moveCard,
  stackOffsets,
} from '../../../src/domain';

const baseBoard = (): Board =>
  createBoard({ startMonday: '2026-01-05', weeks: 4 });

const fixedClock = (t: number): (() => number) => () => t;

describe('stackOffsets — deterministic in-cell offsets per CLAUDE.md §4', () => {
  it('returns [(0, 0)] for a single card (the §4 formula only applies for N > 1)', () => {
    expect(stackOffsets(1)).toStrictEqual([{ x: 0, y: 0 }]);
  });

  it('returns the table-driven values for n = 2..5', () => {
    expect(stackOffsets(2)).toStrictEqual([
      { x: 4, y: 3 },
      { x: -7, y: -5.5 },
    ]);
    expect(stackOffsets(3)).toStrictEqual([
      { x: 4, y: 3 },
      { x: -7, y: -5.5 },
      { x: 10, y: 8 },
    ]);
    expect(stackOffsets(4)).toStrictEqual([
      { x: 4, y: 3 },
      { x: -7, y: -5.5 },
      { x: 10, y: 8 },
      { x: -13, y: -10.5 },
    ]);
    expect(stackOffsets(5)).toStrictEqual([
      { x: 4, y: 3 },
      { x: -7, y: -5.5 },
      { x: 10, y: 8 },
      { x: -13, y: -10.5 },
      { x: 16, y: 13 },
    ]);
  });

  it('returns [] for n = 0', () => {
    expect(stackOffsets(0)).toStrictEqual([]);
  });

  it('throws for negative n', () => {
    expect(() => stackOffsets(-1)).toThrow(/stackOffsets/);
  });
});

describe('addCard auto-assigns z within the target cell', () => {
  it('assigns z = 0 when placing the first card in an empty cell', () => {
    const { board, cardId } = addCard(baseBoard(), {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    const card = board.cards.find((c) => c.id === cardId);
    expect(card?.z).toBe(0);
  });

  it('assigns z = max(existing z in cell) + 1 when stacking', () => {
    let { board } = addCard(baseBoard(), {
      week: 1,
      day: 3,
      clock: fixedClock(100),
    });
    ({ board } = addCard(board, { week: 1, day: 3, clock: fixedClock(101) }));
    const { board: final, cardId } = addCard(board, {
      week: 1,
      day: 3,
      clock: fixedClock(102),
    });
    const third = final.cards.find((c) => c.id === cardId);
    expect(third?.z).toBe(2);
  });

  it('only considers z within the same (week, day) — other cells do not influence', () => {
    let { board } = addCard(baseBoard(), {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    ({ board } = addCard(board, { week: 0, day: 0, clock: fixedClock(101) }));
    ({ board } = addCard(board, { week: 0, day: 0, clock: fixedClock(102) }));
    const { board: final, cardId } = addCard(board, {
      week: 2,
      day: 4,
      clock: fixedClock(200),
    });
    expect(final.cards.find((c) => c.id === cardId)?.z).toBe(0);
  });
});

describe('moveCard rebases z when moving into a non-empty target cell', () => {
  it('puts the moved card on top of the target stack', () => {
    let board = baseBoard();
    const { board: b1, cardId: stayBottom } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    board = b1;
    const { board: b2, cardId: stayMiddle } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(101),
    });
    board = b2;
    const { board: b3, cardId: traveler } = addCard(board, {
      week: 1,
      day: 1,
      clock: fixedClock(200),
    });
    board = b3;
    expect(board.cards.find((c) => c.id === traveler)?.z).toBe(0);

    const moved = moveCard(
      board,
      traveler,
      { week: 0, day: 0 },
      { clock: fixedClock(300) },
    );
    const inCell = moved.cards.filter((c) => c.week === 0 && c.day === 0);
    const movedTraveler = inCell.find((c) => c.id === traveler);
    expect(movedTraveler?.z).toBe(2);
    expect(inCell.find((c) => c.id === stayBottom)?.z).toBe(0);
    expect(inCell.find((c) => c.id === stayMiddle)?.z).toBe(1);
  });

  it('keeps z = 0 when moving into an empty cell', () => {
    let board = baseBoard();
    const { board: b1, cardId } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    board = b1;
    const moved = moveCard(
      board,
      cardId,
      { week: 2, day: 4 },
      { clock: fixedClock(200) },
    );
    expect(moved.cards.find((c) => c.id === cardId)?.z).toBe(0);
  });

  it('same-cell move is still a no-op (preserves identity, including z)', () => {
    let board = baseBoard();
    const { board: b1, cardId: bottom } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    board = b1;
    const { board: b2, cardId: top } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(101),
    });
    board = b2;
    const after = moveCard(
      board,
      top,
      { week: 0, day: 0 },
      { clock: fixedClock(300) },
    );
    expect(after).toBe(board);
    expect(after.cards.find((c) => c.id === bottom)?.z).toBe(0);
    expect(after.cards.find((c) => c.id === top)?.z).toBe(1);
  });
});

describe('cycleStack rotates z within a single (week, day) cell', () => {
  it('promotes the bottom (lowest-z) card to the new top', () => {
    let board = baseBoard();
    const { board: b1, cardId: a } = addCard(board, {
      week: 0,
      day: 2,
      clock: fixedClock(100),
    });
    board = b1;
    const { board: b2, cardId: b } = addCard(board, {
      week: 0,
      day: 2,
      clock: fixedClock(101),
    });
    board = b2;
    const { board: b3, cardId: c } = addCard(board, {
      week: 0,
      day: 2,
      clock: fixedClock(102),
    });
    board = b3;

    const cycled = cycleStack(board, 0, 2, { clock: fixedClock(200) });
    const inCell = cycled.cards.filter((card) => card.week === 0 && card.day === 2);
    const byId = Object.fromEntries(inCell.map((card) => [card.id, card]));
    expect(byId[a]?.z).toBeGreaterThan(byId[b]?.z ?? -1);
    expect(byId[a]?.z).toBeGreaterThan(byId[c]?.z ?? -1);
    expect(byId[b]?.z).toBe(1);
    expect(byId[c]?.z).toBe(2);
  });

  it('bumps updatedAt only on the promoted card', () => {
    let board = baseBoard();
    const { board: b1, cardId: a } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    board = b1;
    const { board: b2, cardId: b } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(101),
    });
    board = b2;
    const cycled = cycleStack(board, 0, 0, { clock: fixedClock(500) });
    expect(cycled.cards.find((c) => c.id === a)?.updatedAt).toBe(500);
    expect(cycled.cards.find((c) => c.id === b)?.updatedAt).toBe(101);
  });

  it('is a no-op when the cell has 0 or 1 cards', () => {
    const empty = baseBoard();
    expect(cycleStack(empty, 0, 0, { clock: fixedClock(999) })).toBe(empty);

    const { board: oneCard } = addCard(empty, {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    expect(cycleStack(oneCard, 0, 0, { clock: fixedClock(999) })).toBe(oneCard);
  });

  it('does not touch cards in other cells', () => {
    let board = baseBoard();
    const { board: b1, cardId: untouched } = addCard(board, {
      week: 2,
      day: 4,
      clock: fixedClock(50),
    });
    board = b1;
    const { board: b2 } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(100),
    });
    board = b2;
    const { board: b3 } = addCard(board, {
      week: 0,
      day: 0,
      clock: fixedClock(101),
    });
    board = b3;
    const cycled = cycleStack(board, 0, 0, { clock: fixedClock(500) });
    const outsider = cycled.cards.find((c) => c.id === untouched);
    expect(outsider?.z).toBe(0);
    expect(outsider?.updatedAt).toBe(50);
  });
});
