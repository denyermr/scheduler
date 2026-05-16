import { describe, it, expect } from 'vitest';
import { addCard, createBoard } from '../../../src/domain/board';
import { PIN_COLORS } from '../../../src/domain/types';

const SEED = { startMonday: '2026-05-18', weeks: 10 };

describe('domain/board — addCard (TDD steps 4 + 5)', () => {
  it('adds a card and returns its id; original board is unchanged', () => {
    const before = createBoard(SEED);
    const { board: after, cardId } = addCard(before, {
      week: 2,
      day: 1,
      text: 'hello',
    });

    expect(before.cards).toEqual([]);
    expect(after.cards).toHaveLength(1);
    expect(after.cards[0]?.id).toBe(cardId);
    expect(after.cards[0]?.text).toBe('hello');
    expect(after.cards[0]?.week).toBe(2);
    expect(after.cards[0]?.day).toBe(1);
  });

  it('defaults new card color to peach (CLAUDE.md §4)', () => {
    const { board } = addCard(createBoard(SEED), { week: 0, day: 0 });
    expect(board.cards[0]?.color).toBe('peach');
  });

  it('assigns rotation in [-2, +2) and a pin from PIN_COLORS', () => {
    for (let i = 0; i < 50; i++) {
      const { board } = addCard(createBoard(SEED), { week: 0, day: 0 });
      const card = board.cards[0];
      expect(card).toBeDefined();
      if (!card) return;
      expect(card.rotation).toBeGreaterThanOrEqual(-2);
      expect(card.rotation).toBeLessThan(2);
      expect(PIN_COLORS).toContain(card.pin);
    }
  });

  it('rotation and pin are deterministic when rng is injected', () => {
    const rng = (): number => 0.25;
    const { board } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      rng,
      newId: () => 'card_deadbeef',
    });
    expect(board.cards[0]?.rotation).toBe(-1);
    expect(board.cards[0]?.pin).toBe(PIN_COLORS[1]);
    expect(board.cards[0]?.id).toBe('card_deadbeef');
  });

  it('rejects week outside [0, board.weeks)', () => {
    const board = createBoard(SEED);
    expect(() => addCard(board, { week: -1, day: 0 })).toThrowError(/week/);
    expect(() => addCard(board, { week: 10, day: 0 })).toThrowError(/week/);
    expect(() => addCard(board, { week: 1.5, day: 0 })).toThrowError(/week/);
  });

  it('rejects day outside 0..4 (CLAUDE.md invariant 7 — Mon–Fri only)', () => {
    const board = createBoard(SEED);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally pass an out-of-type day to assert the runtime guard fires
    expect(() => addCard(board, { week: 0, day: 5 as any })).toThrowError(/day/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally pass an out-of-type day to assert the runtime guard fires
    expect(() => addCard(board, { week: 0, day: -1 as any })).toThrowError(/day/);
  });

  it('defaults text to empty string when omitted', () => {
    const { board } = addCard(createBoard(SEED), { week: 0, day: 0 });
    expect(board.cards[0]?.text).toBe('');
  });

  it('respects an explicit color', () => {
    const { board } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      color: 'mint',
    });
    expect(board.cards[0]?.color).toBe('mint');
  });
});
