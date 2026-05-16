import { describe, it, expect } from 'vitest';
import { addCard, createBoard, moveCard } from '../../../src/domain/board';

const SEED = { startMonday: '2026-05-18', weeks: 10 };

describe('domain/board — moveCard (TDD step 7, CLAUDE.md invariant 6)', () => {
  it('moves to a new cell and preserves id, rotation, pin (invariant 6)', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
    });
    const original = b1.cards[0];
    expect(original).toBeDefined();
    if (!original) return;

    const b2 = moveCard(b1, cardId, { week: 5, day: 3 });
    const moved = b2.cards[0];

    expect(moved?.id).toBe(original.id);
    expect(moved?.rotation).toBe(original.rotation);
    expect(moved?.pin).toBe(original.pin);
    expect(moved?.week).toBe(5);
    expect(moved?.day).toBe(3);
  });

  it('moving to the same cell is a no-op (returns the same board reference)', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 2,
      day: 1,
    });
    const b2 = moveCard(b1, cardId, { week: 2, day: 1 });
    expect(b2).toBe(b1);
  });

  it('original board is not mutated', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
    });
    moveCard(b1, cardId, { week: 4, day: 4 });
    expect(b1.cards[0]?.week).toBe(0);
    expect(b1.cards[0]?.day).toBe(0);
  });

  it('throws when the card id is unknown', () => {
    const board = createBoard(SEED);
    expect(() =>
      moveCard(board, 'card_ghost00', { week: 0, day: 0 }),
    ).toThrowError(/no card/);
  });

  it('rejects a target week off the board', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
    });
    expect(() => moveCard(b1, cardId, { week: 10, day: 0 })).toThrowError(
      /week/,
    );
    expect(() => moveCard(b1, cardId, { week: -1, day: 0 })).toThrowError(
      /week/,
    );
  });

  it('rejects an invalid day', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally pass an out-of-type day to assert the runtime guard fires
    expect(() => moveCard(b1, cardId, { week: 0, day: 5 as any })).toThrowError(
      /day/,
    );
  });
});
