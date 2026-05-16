import { describe, it, expect } from 'vitest';
import {
  addCard,
  addThread,
  createBoard,
  deleteCard,
} from '../../../src/domain/board';

const SEED = { startMonday: '2026-05-18', weeks: 10 };

describe('domain/board — deleteCard (TDD steps 8 + 9, CLAUDE.md invariant 9)', () => {
  it('removes the card from the cards array', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
    });
    const b2 = deleteCard(b1, cardId);
    expect(b2.cards).toEqual([]);
  });

  it('also removes threads where it is the from-endpoint (invariant 9)', () => {
    const start = createBoard(SEED);
    const { board: b1, cardId: a } = addCard(start, { week: 0, day: 0 });
    const { board: b2, cardId: b } = addCard(b1, { week: 0, day: 1 });
    const { board: b3 } = addThread(b2, { fromCardId: a, toCardId: b });

    const b4 = deleteCard(b3, a);
    expect(b4.threads).toEqual([]);
    expect(b4.cards.map((c) => c.id)).toEqual([b]);
  });

  it('also removes threads where it is the to-endpoint (invariant 9)', () => {
    const start = createBoard(SEED);
    const { board: b1, cardId: a } = addCard(start, { week: 0, day: 0 });
    const { board: b2, cardId: b } = addCard(b1, { week: 0, day: 1 });
    const { board: b3 } = addThread(b2, { fromCardId: a, toCardId: b });

    const b4 = deleteCard(b3, b);
    expect(b4.threads).toEqual([]);
  });

  it('leaves unrelated threads intact', () => {
    const start = createBoard(SEED);
    const { board: b1, cardId: a } = addCard(start, { week: 0, day: 0 });
    const { board: b2, cardId: b } = addCard(b1, { week: 0, day: 1 });
    const { board: b3, cardId: c } = addCard(b2, { week: 0, day: 2 });
    const { board: b4, threadId: tBC } = addThread(b3, {
      fromCardId: b,
      toCardId: c,
    });

    const b5 = deleteCard(b4, a);
    expect(b5.threads.map((t) => t.id)).toEqual([tBC]);
  });

  it('throws when the card id is unknown', () => {
    expect(() => deleteCard(createBoard(SEED), 'card_ghost00')).toThrowError(
      /no card/,
    );
  });

  it('original board is not mutated', () => {
    const { board: b1, cardId } = addCard(createBoard(SEED), {
      week: 0,
      day: 0,
    });
    deleteCard(b1, cardId);
    expect(b1.cards).toHaveLength(1);
  });
});
