import { describe, it, expect } from 'vitest';
import {
  addCard,
  addThread,
  createBoard,
  deleteThread,
} from '../../../src/domain/board';

const SEED = { startMonday: '2026-05-18', weeks: 10 };

function seedTwoCards() {
  const start = createBoard(SEED);
  const { board: b1, cardId: a } = addCard(start, { week: 0, day: 0 });
  const { board: b2, cardId: b } = addCard(b1, { week: 0, day: 1 });
  return { board: b2, a, b };
}

describe('domain/board — addThread (TDD steps 10 + 11, CLAUDE.md invariant 10)', () => {
  it('creates a thread between two existing cards using card ids (invariant 10)', () => {
    const { board, a, b } = seedTwoCards();
    const { board: next, threadId } = addThread(board, {
      fromCardId: a,
      toCardId: b,
    });
    expect(next.threads).toHaveLength(1);
    expect(next.threads[0]?.id).toBe(threadId);
    expect(next.threads[0]?.fromCardId).toBe(a);
    expect(next.threads[0]?.toCardId).toBe(b);
    expect(threadId).toMatch(/^thread_[0-9a-f]{8}$/);
  });

  it('rejects self-threads', () => {
    const { board, a } = seedTwoCards();
    expect(() =>
      addThread(board, { fromCardId: a, toCardId: a }),
    ).toThrowError(/self-thread/);
  });

  it('rejects duplicate threads (same direction)', () => {
    const { board, a, b } = seedTwoCards();
    const { board: withThread } = addThread(board, {
      fromCardId: a,
      toCardId: b,
    });
    expect(() =>
      addThread(withThread, { fromCardId: a, toCardId: b }),
    ).toThrowError(/duplicate/);
  });

  it('rejects duplicate threads (reverse direction — threads are undirected per §4 "no arrowhead")', () => {
    const { board, a, b } = seedTwoCards();
    const { board: withThread } = addThread(board, {
      fromCardId: a,
      toCardId: b,
    });
    expect(() =>
      addThread(withThread, { fromCardId: b, toCardId: a }),
    ).toThrowError(/duplicate/);
  });

  it('rejects threads referencing a non-existent from-card', () => {
    const { board, b } = seedTwoCards();
    expect(() =>
      addThread(board, { fromCardId: 'card_ghost00', toCardId: b }),
    ).toThrowError(/from-card/);
  });

  it('rejects threads referencing a non-existent to-card', () => {
    const { board, a } = seedTwoCards();
    expect(() =>
      addThread(board, { fromCardId: a, toCardId: 'card_ghost00' }),
    ).toThrowError(/to-card/);
  });

  it('original board is not mutated', () => {
    const { board, a, b } = seedTwoCards();
    addThread(board, { fromCardId: a, toCardId: b });
    expect(board.threads).toEqual([]);
  });

  it('newId override is honoured for deterministic tests', () => {
    const { board, a, b } = seedTwoCards();
    const { threadId } = addThread(board, {
      fromCardId: a,
      toCardId: b,
      newId: () => 'thread_cafebabe',
    });
    expect(threadId).toBe('thread_cafebabe');
  });
});

describe('domain/board — deleteThread (TDD step 12)', () => {
  it('removes the thread by id', () => {
    const { board, a, b } = seedTwoCards();
    const { board: withThread, threadId } = addThread(board, {
      fromCardId: a,
      toCardId: b,
    });
    const after = deleteThread(withThread, threadId);
    expect(after.threads).toEqual([]);
  });

  it('throws when the thread id is unknown', () => {
    const { board } = seedTwoCards();
    expect(() => deleteThread(board, 'thread_ghost00')).toThrowError(
      /no thread/,
    );
  });

  it('original board is not mutated', () => {
    const { board, a, b } = seedTwoCards();
    const { board: withThread, threadId } = addThread(board, {
      fromCardId: a,
      toCardId: b,
    });
    deleteThread(withThread, threadId);
    expect(withThread.threads).toHaveLength(1);
  });
});
