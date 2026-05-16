import { describe, it, expect } from 'vitest';
import { addCard, createBoard, updateCard } from '../../../src/domain/board';

const SEED = { startMonday: '2026-05-18', weeks: 10 };

describe('domain/board — updateCard (TDD step 6, CLAUDE.md invariant 6)', () => {
  it('updates text without disturbing other fields', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      text: 'before',
    });
    const original = b1.cards[0];
    expect(original).toBeDefined();
    if (!original) return;

    const b2 = updateCard(b1, cardId, { text: 'after' });
    const updated = b2.cards[0];
    expect(updated?.text).toBe('after');
    expect(updated?.color).toBe(original.color);
    expect(updated?.rotation).toBe(original.rotation);
    expect(updated?.pin).toBe(original.pin);
    expect(updated?.week).toBe(original.week);
    expect(updated?.day).toBe(original.day);
  });

  it('updates color without disturbing other fields', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      color: 'peach',
    });
    const original = b1.cards[0];
    expect(original).toBeDefined();
    if (!original) return;

    const b2 = updateCard(b1, cardId, { color: 'coral' });
    expect(b2.cards[0]?.color).toBe('coral');
    expect(b2.cards[0]?.rotation).toBe(original.rotation);
    expect(b2.cards[0]?.pin).toBe(original.pin);
  });

  it('original board is not mutated', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      text: 'before',
    });
    updateCard(b1, cardId, { text: 'after' });
    expect(b1.cards[0]?.text).toBe('before');
  });

  it('throws when the card id is unknown', () => {
    const board = createBoard(SEED);
    expect(() => updateCard(board, 'card_ghost00', { text: 'x' })).toThrowError(
      /no card/,
    );
  });

  it('a no-op patch (no fields) returns an unchanged card', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
      text: 'same',
    });
    const b2 = updateCard(b1, cardId, {});
    expect(b2.cards[0]).toEqual(b1.cards[0]);
  });
});
