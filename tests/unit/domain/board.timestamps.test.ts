import { describe, expect, it } from 'vitest';
import {
  addCard,
  createBoard,
  deleteCard,
  moveCard,
  updateCard,
} from '../../../src/domain/board';

const SEED = { startMonday: '2026-05-18', weeks: 10 };

function makeClock(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 0;
    i += 1;
    return v;
  };
}

describe('domain/board — timestamps (Phase 3, CLAUDE.md §10 change-log row 3)', () => {
  it('addCard sets createdAt and updatedAt to the injected clock value (step 1)', () => {
    const clock = makeClock([1700]);
    const { board } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      clock,
    });
    expect(board.cards[0]?.createdAt).toBe(1700);
    expect(board.cards[0]?.updatedAt).toBe(1700);
  });

  it('updateCard bumps updatedAt to the new clock value; createdAt is unchanged (step 2)', () => {
    const clock = makeClock([100, 250]);
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      text: 'before',
      clock,
    });
    expect(b1.cards[0]?.createdAt).toBe(100);
    expect(b1.cards[0]?.updatedAt).toBe(100);

    const b2 = updateCard(b1, cardId, { text: 'after' }, { clock });
    expect(b2.cards[0]?.createdAt).toBe(100); // unchanged
    expect(b2.cards[0]?.updatedAt).toBe(250); // bumped
  });

  it('updateCard bumps updatedAt even for color-only changes', () => {
    const clock = makeClock([10, 20]);
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      clock,
    });
    const b2 = updateCard(b1, cardId, { color: 'coral' }, { clock });
    expect(b2.cards[0]?.updatedAt).toBe(20);
  });

  it('moveCard bumps updatedAt; createdAt is unchanged (step 3)', () => {
    const clock = makeClock([500, 600]);
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      clock,
    });
    const b2 = moveCard(b1, cardId, { week: 2, day: 3 }, { clock });
    expect(b2.cards[0]?.createdAt).toBe(500);
    expect(b2.cards[0]?.updatedAt).toBe(600);
  });

  it('moveCard same-cell no-op does not bump updatedAt (returns same board)', () => {
    const clock = makeClock([10, 20]);
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 2,
      day: 1,
      clock,
    });
    const b2 = moveCard(b1, cardId, { week: 2, day: 1 }, { clock });
    expect(b2).toBe(b1);
    expect(b2.cards[0]?.updatedAt).toBe(10);
  });

  it('deleteCard does not need a clock (the card is gone)', () => {
    const clock = makeClock([1]);
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      clock,
    });
    const b2 = deleteCard(b1, cardId);
    expect(b2.cards).toEqual([]);
  });

  it('addCard without an injected clock falls back to the deterministic default (0)', () => {
    // Mirrors the Rng pattern: production code must inject a real clock; the
    // domain default is deterministic so tests that ignore timestamps still work.
    const { board } = addCard(createBoard(SEED), { week: 0, day: 0 });
    expect(board.cards[0]?.createdAt).toBe(0);
    expect(board.cards[0]?.updatedAt).toBe(0);
  });
});
