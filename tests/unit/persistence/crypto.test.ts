import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createBoard, addCard, addThread } from '../../../src/domain/board';
import {
  deriveKey,
  encryptBoard,
  decryptEnvelope,
  randomSalt,
  KDF_ITERS_DEFAULT,
  SALT_BYTES,
  IV_BYTES,
} from '../../../src/persistence/crypto';

// Tests use 1_000 iterations to keep the suite fast (PBKDF2 with 200_000
// iters takes ~200 ms on a laptop — multiplied by N tests it dominates).
// The 200_000 default is pinned by KDF_ITERS_DEFAULT below.
const TEST_ITERS = 1_000;

function emptyBoard() {
  return createBoard({ startMonday: '2026-05-04', weeks: 26 });
}

function populatedBoard() {
  let board = emptyBoard();
  const add1 = addCard(board, {
    week: 0,
    day: 0,
    color: 'peach',
    text: 'first',
    clock: () => 1000,
  });
  board = add1.board;
  const add2 = addCard(board, {
    week: 2,
    day: 3,
    color: 'sky',
    text: 'second',
    clock: () => 2000,
  });
  board = add2.board;
  const t = addThread(board, {
    fromCardId: add1.cardId,
    toCardId: add2.cardId,
  });
  board = t.board;
  return board;
}

describe('crypto — defaults', () => {
  it('KDF_ITERS_DEFAULT is at the OWASP 2026 floor for PBKDF2-SHA-256', () => {
    expect(KDF_ITERS_DEFAULT).toBeGreaterThanOrEqual(200_000);
  });

  it('SALT_BYTES = 16 and IV_BYTES = 12 (standard for AES-GCM)', () => {
    expect(SALT_BYTES).toBe(16);
    expect(IV_BYTES).toBe(12);
  });
});

describe('crypto — randomSalt', () => {
  it('returns a base64 string that decodes to SALT_BYTES bytes', () => {
    const salt = randomSalt();
    expect(typeof salt).toBe('string');
    const decoded = atob(salt);
    expect(decoded.length).toBe(SALT_BYTES);
  });

  it('successive calls return different salts', () => {
    const a = randomSalt();
    const b = randomSalt();
    expect(a).not.toBe(b);
  });
});

describe('crypto — deriveKey', () => {
  it('returns a CryptoKey usable for AES-GCM', async () => {
    const salt = randomSalt();
    const key = await deriveKey('pw1', salt, TEST_ITERS);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('same passphrase + salt + iters produces a key that decrypts the same ciphertext', async () => {
    const salt = randomSalt();
    const key1 = await deriveKey('pw1', salt, TEST_ITERS);
    const key2 = await deriveKey('pw1', salt, TEST_ITERS);
    const board = populatedBoard();
    const payload = await encryptBoard(board, key1);
    const decrypted = await decryptEnvelope(payload, key2);
    expect(decrypted).toEqual(board);
  });

  it('different salts produce keys that cannot decrypt each other', async () => {
    const saltA = randomSalt();
    const saltB = randomSalt();
    const keyA = await deriveKey('same-pw', saltA, TEST_ITERS);
    const keyB = await deriveKey('same-pw', saltB, TEST_ITERS);
    const board = populatedBoard();
    const payload = await encryptBoard(board, keyA);
    const decrypted = await decryptEnvelope(payload, keyB);
    expect(decrypted).toBeNull();
  });
});

describe('crypto — encryptBoard + decryptEnvelope', () => {
  it('roundtrips an empty board', async () => {
    const salt = randomSalt();
    const key = await deriveKey('hello', salt, TEST_ITERS);
    const board = emptyBoard();
    const payload = await encryptBoard(board, key);
    const decrypted = await decryptEnvelope(payload, key);
    expect(decrypted).toEqual(board);
  });

  it('roundtrips a populated board', async () => {
    const salt = randomSalt();
    const key = await deriveKey('hello', salt, TEST_ITERS);
    const board = populatedBoard();
    const payload = await encryptBoard(board, key);
    const decrypted = await decryptEnvelope(payload, key);
    expect(decrypted).toEqual(board);
  });

  it('uses a fresh IV per encrypt — two encrypts of the same board produce different ciphertexts', async () => {
    const salt = randomSalt();
    const key = await deriveKey('hello', salt, TEST_ITERS);
    const board = populatedBoard();
    const a = await encryptBoard(board, key);
    const b = await encryptBoard(board, key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('IV decodes to IV_BYTES bytes', async () => {
    const salt = randomSalt();
    const key = await deriveKey('hello', salt, TEST_ITERS);
    const payload = await encryptBoard(emptyBoard(), key);
    expect(atob(payload.iv).length).toBe(IV_BYTES);
  });

  it('decryptEnvelope with the wrong key returns null (not throw)', async () => {
    const salt = randomSalt();
    const rightKey = await deriveKey('right', salt, TEST_ITERS);
    const wrongKey = await deriveKey('wrong', salt, TEST_ITERS);
    const payload = await encryptBoard(populatedBoard(), rightKey);
    const decrypted = await decryptEnvelope(payload, wrongKey);
    expect(decrypted).toBeNull();
  });

  it('tampered ciphertext (single byte flipped) returns null', async () => {
    const salt = randomSalt();
    const key = await deriveKey('hello', salt, TEST_ITERS);
    const payload = await encryptBoard(populatedBoard(), key);
    const bytes = Uint8Array.from(atob(payload.ciphertext), (c) =>
      c.charCodeAt(0),
    );
    bytes[0] = (bytes[0] ?? 0) ^ 0x01;
    let tampered = '';
    for (const b of bytes) tampered += String.fromCharCode(b);
    const tamperedB64 = btoa(tampered);
    const decrypted = await decryptEnvelope(
      { ciphertext: tamperedB64, iv: payload.iv },
      key,
    );
    expect(decrypted).toBeNull();
  });

  it('property: any small board with a card roundtrips', async () => {
    const salt = randomSalt();
    const key = await deriveKey('pw', salt, TEST_ITERS);
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          text: fc.string({ minLength: 0, maxLength: 40 }),
          week: fc.integer({ min: 0, max: 25 }),
          day: fc.integer({ min: 0, max: 6 }),
          color: fc.constantFrom('peach', 'coral', 'sky', 'mint'),
          now: fc.integer({ min: 1, max: 1_000_000 }),
        }),
        async (params) => {
          const { board } = addCard(emptyBoard(), {
            week: params.week,
            day: params.day as 0,
            color: params.color as 'peach',
            text: params.text,
            clock: () => params.now,
          });
          const payload = await encryptBoard(board, key);
          const decrypted = await decryptEnvelope(payload, key);
          expect(decrypted).toEqual(board);
        },
      ),
      { numRuns: 20 },
    );
  }, 30_000);
});
