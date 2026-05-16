import { describe, it, expect } from 'vitest';
import { createBoard } from '../../../src/domain/board';
import { DEFAULT_WEEKS } from '../../../src/domain/weeks';

describe('domain/board — createBoard (TDD steps 2 + 3)', () => {
  it('default weeks is 26, with 0 cards and 0 threads', () => {
    const board = createBoard({ startMonday: '2026-05-18' });
    expect(board.weeks).toBe(DEFAULT_WEEKS);
    expect(board.weeks).toBe(26);
    expect(board.cards).toEqual([]);
    expect(board.threads).toEqual([]);
    expect(board.startMonday).toBe('2026-05-18');
  });

  it('explicit weeks override the default', () => {
    expect(createBoard({ startMonday: '2026-05-18', weeks: 10 }).weeks).toBe(10);
  });

  it('rejects weeks below MIN_WEEKS (4)', () => {
    expect(() =>
      createBoard({ startMonday: '2026-05-18', weeks: 3 }),
    ).toThrowError(/weeks must be in \[4, 52\]/);
  });

  it('rejects weeks above MAX_WEEKS (52)', () => {
    expect(() =>
      createBoard({ startMonday: '2026-05-18', weeks: 60 }),
    ).toThrowError(/weeks must be in \[4, 52\]/);
  });

  it('rejects non-integer weeks', () => {
    expect(() =>
      createBoard({ startMonday: '2026-05-18', weeks: 5.5 }),
    ).toThrowError(/integer/);
  });

  it('rejects a non-ISO startMonday', () => {
    expect(() => createBoard({ startMonday: 'tomorrow' })).toThrowError(
      /YYYY-MM-DD/,
    );
    expect(() =>
      createBoard({ startMonday: '2026-5-1' }),
    ).toThrowError(/YYYY-MM-DD/);
  });
});
