import { describe, expect, it } from 'vitest';
import {
  type Envelope,
  isUnlocked,
  unwrapUnlocked,
} from '../../../src/persistence/envelope';
import { createBoard } from '../../../src/domain/board';

const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });

describe('envelope discriminator', () => {
  it('isUnlocked narrows the locked: false arm', () => {
    const env: Envelope = { locked: false, board, updatedAt: 100 };
    expect(isUnlocked(env)).toBe(true);
    if (isUnlocked(env)) {
      // type narrows here — both fields accessible
      expect(env.board.weeks).toBe(4);
      expect(env.updatedAt).toBe(100);
    }
  });

  it('isUnlocked rejects the locked: true arm', () => {
    const env: Envelope = {
      locked: true,
      ciphertext: 'AAAA',
      iv: 'BBBB',
      kdfSalt: 'CCCC',
      kdfIters: 250_000,
      updatedAt: 100,
    };
    expect(isUnlocked(env)).toBe(false);
  });

  it('unwrapUnlocked returns { board, updatedAt } for the unlocked arm', () => {
    const env: Envelope = { locked: false, board, updatedAt: 200 };
    const result = unwrapUnlocked(env);
    expect(result.board).toBe(board);
    expect(result.updatedAt).toBe(200);
  });

  it('unwrapUnlocked throws on the locked arm (Phase 7.5 not implemented in Phase 7)', () => {
    const env: Envelope = {
      locked: true,
      ciphertext: 'AAAA',
      iv: 'BBBB',
      kdfSalt: 'CCCC',
      kdfIters: 250_000,
      updatedAt: 100,
    };
    expect(() => unwrapUnlocked(env)).toThrow(/locked/i);
  });
});
