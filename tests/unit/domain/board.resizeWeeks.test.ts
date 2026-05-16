import { describe, it, expect } from 'vitest';
import {
  addCard,
  cardsOffBoard,
  cardsOnBoard,
  createBoard,
  resizeWeeks,
} from '../../../src/domain/board';

describe('domain/board — resizeWeeks (TDD steps 13 + 14, CLAUDE.md invariant 8)', () => {
  it('shrinking below max(card.week)+1 leaves off-board cards in place but flagged', () => {
    const b0 = createBoard({ startMonday: '2026-05-18', weeks: 10 });
    const { board: b1, cardId: aId } = addCard(b0, { week: 1, day: 0 });
    const { board: b2, cardId: bId } = addCard(b1, { week: 7, day: 2 });
    const { board: b3, cardId: cId } = addCard(b2, { week: 9, day: 4 });

    const { board: shrunk, offBoardCardIds } = resizeWeeks(b3, 5);

    expect(shrunk.weeks).toBe(5);
    expect(shrunk.cards.map((c) => c.id)).toEqual([aId, bId, cId]);
    expect(offBoardCardIds).toEqual([bId, cId]);
    expect(cardsOnBoard(shrunk).map((c) => c.id)).toEqual([aId]);
    expect(cardsOffBoard(shrunk).map((c) => c.id)).toEqual([bId, cId]);
  });

  it('regrowing restores previously off-board cards as on-board (invariant 8)', () => {
    const b0 = createBoard({ startMonday: '2026-05-18', weeks: 10 });
    const { board: b1 } = addCard(b0, { week: 7, day: 0 });
    const { board: shrunk } = resizeWeeks(b1, 5);
    expect(cardsOffBoard(shrunk)).toHaveLength(1);

    const { board: regrown, offBoardCardIds } = resizeWeeks(shrunk, 10);
    expect(cardsOffBoard(regrown)).toHaveLength(0);
    expect(cardsOnBoard(regrown)).toHaveLength(1);
    expect(offBoardCardIds).toEqual([]);
  });

  it('shrink with no overflow returns empty offBoardCardIds', () => {
    const b0 = createBoard({ startMonday: '2026-05-18', weeks: 10 });
    const { board: b1 } = addCard(b0, { week: 0, day: 0 });
    const { board: b2, offBoardCardIds } = resizeWeeks(b1, 5);
    expect(offBoardCardIds).toEqual([]);
    expect(b2.weeks).toBe(5);
  });

  it('original board is not mutated', () => {
    const b0 = createBoard({ startMonday: '2026-05-18', weeks: 10 });
    resizeWeeks(b0, 5);
    expect(b0.weeks).toBe(10);
  });

  it('rejects weeks outside [MIN_WEEKS, MAX_WEEKS]', () => {
    const b0 = createBoard({ startMonday: '2026-05-18', weeks: 10 });
    expect(() => resizeWeeks(b0, 3)).toThrowError(/weeks must be in/);
    expect(() => resizeWeeks(b0, 53)).toThrowError(/weeks must be in/);
    expect(() => resizeWeeks(b0, 5.5)).toThrowError(/integer/);
  });
});

describe('domain/board — cardsOnBoard / cardsOffBoard', () => {
  it('partitions cards by week < board.weeks', () => {
    const b0 = createBoard({ startMonday: '2026-05-18', weeks: 4 });
    const { board: b1 } = addCard(b0, { week: 0, day: 0 });
    const { board: b2 } = addCard(b1, { week: 3, day: 0 });
    const { board: shrunk } = resizeWeeks(b2, 4); // same size, no overflow

    expect(cardsOnBoard(shrunk)).toHaveLength(2);
    expect(cardsOffBoard(shrunk)).toHaveLength(0);
  });
});
