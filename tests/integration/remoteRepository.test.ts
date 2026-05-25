import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, type ServerHandle } from '../../server/server';
import {
  POLL_INTERVAL_MS,
  RemoteRepository,
  intervalPollDriver,
  manualPollDriver,
} from '../../src/persistence/remote';
import { createBoard, addCard } from '../../src/domain/board';
import { deriveKey, randomSalt } from '../../src/persistence/crypto';
import type { Board } from '../../src/domain/types';

let handle: ServerHandle;
let baseUrl: string;

beforeEach(async () => {
  handle = await startServer({ dbPath: ':memory:', port: 0 });
  baseUrl = `http://127.0.0.1:${String(handle.port)}`;
});

afterEach(async () => {
  await handle.close();
  vi.restoreAllMocks();
});

function smallBoard(): Board {
  return createBoard({ startMonday: '2024-05-27', weeks: 6 });
}

const fixedClock = (t: number) => (): number => t;

describe('RemoteRepository — load / save / subscribe', () => {
  it('load on unknown slug returns a fresh empty board (invariant 1)', async () => {
    const repo = new RemoteRepository({ baseUrl, clock: fixedClock(100) });
    const board = await repo.load('never-existed-slug-0001');
    expect(board.cards).toEqual([]);
    expect(board.threads).toEqual([]);
    expect(board.weeks).toBe(26);
  });

  it('save → load round-trips the board through the wire envelope', async () => {
    const repo = new RemoteRepository({ baseUrl, clock: fixedClock(500) });
    const seed = addCard(smallBoard(), {
      week: 1,
      day: 2,
      color: 'mint',
      text: 'BLOCK',
      newId: () => 'card_one',
      clock: () => 100,
    });
    await repo.save('round-trip-slug', seed.board);
    const reloaded = await repo.load('round-trip-slug');
    expect(reloaded.cards.map((c) => c.id)).toEqual(['card_one']);
    expect(reloaded.cards[0]?.text).toBe('BLOCK');
  });

  it('save stamps envelope.updatedAt with the injected clock', async () => {
    const repo = new RemoteRepository({ baseUrl, clock: fixedClock(987_654) });
    await repo.save('clock-test', smallBoard());
    // Reach into the raw wire format to verify the stamped timestamp.
    const res = await fetch(`${baseUrl}/b/clock-test`);
    const envelope = (await res.json()) as { updatedAt: number; locked: boolean };
    expect(envelope.locked).toBe(false);
    expect(envelope.updatedAt).toBe(987_654);
  });

  it('subscribe — on each manual tick, GET happens and the callback fires with (board, updatedAt)', async () => {
    const repo = new RemoteRepository({
      baseUrl,
      clock: fixedClock(1234),
      pollDriver: undefined,
    });
    // First, write a board to the server.
    await repo.save('poll-target', smallBoard());

    // Now use a manual driver to control polling.
    const driver = manualPollDriver();
    const subRepo = new RemoteRepository({
      baseUrl,
      clock: fixedClock(1234),
      pollDriver: driver,
    });
    const calls: Array<{ board: Board; updatedAt: number }> = [];
    const unsub = subRepo.subscribe('poll-target', (board, updatedAt) => {
      calls.push({ board, updatedAt });
    });

    expect(calls).toHaveLength(0); // no auto-fire
    await driver.fire();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.updatedAt).toBe(1234);
    expect(calls[0]?.board.weeks).toBe(6);

    await driver.fire();
    expect(calls).toHaveLength(2);

    unsub();
    await driver.fire(); // unsubscribed; the stored tick is gone
    expect(calls).toHaveLength(2);
  });

  it('subscribe — 404 does not fire the callback', async () => {
    const driver = manualPollDriver();
    const repo = new RemoteRepository({
      baseUrl,
      clock: fixedClock(1),
      pollDriver: driver,
    });
    const calls: number[] = [];
    repo.subscribe('does-not-exist', (_b, u) => calls.push(u));
    await driver.fire();
    expect(calls).toHaveLength(0);
  });

  it('intervalPollDriver — fires once per POLL_INTERVAL_MS (10s)', async () => {
    vi.useFakeTimers();
    try {
      let ticks = 0;
      const cancel = intervalPollDriver(async () => {
        ticks += 1;
        return Promise.resolve();
      });
      expect(ticks).toBe(0);
      vi.advanceTimersByTime(POLL_INTERVAL_MS - 1);
      expect(ticks).toBe(0);
      vi.advanceTimersByTime(1);
      expect(ticks).toBe(1);
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      expect(ticks).toBe(2);
      cancel();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 5);
      expect(ticks).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('offline → save queues; reconnect via subscribe-tick flushes', async () => {
    // Custom fetcher we can flip offline.
    let online = false;
    const realFetch: typeof fetch = fetch;
    const fetcher: typeof fetch = (input, init) => {
      if (!online) return Promise.reject(new Error('offline'));
      return realFetch(input, init);
    };
    const driver = manualPollDriver();
    const repo = new RemoteRepository({
      baseUrl,
      clock: fixedClock(2222),
      pollDriver: driver,
      fetcher,
    });

    // Try to save while offline. It should NOT throw and SHOULD queue.
    await repo.save('offline-slug', smallBoard());
    expect(repo.hasPendingSave()).toBe(true);

    // Subscribe — but we're still offline. Tick: queued retry fails, GET fails.
    const calls: number[] = [];
    repo.subscribe('offline-slug', (_b, u) => calls.push(u));
    await driver.fire();
    expect(repo.hasPendingSave()).toBe(true); // still queued
    expect(calls).toHaveLength(0);

    // Reconnect. The next tick should flush the queue, then the GET will
    // succeed (since the flushed PATCH just landed).
    online = true;
    await driver.fire();
    expect(repo.hasPendingSave()).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(2222);

    // The board is now on the server.
    const reloaded = await repo.load('offline-slug');
    expect(reloaded.weeks).toBe(6);
  });

  it('a server returning a locked envelope WITHOUT a crypto context causes load() to throw', async () => {
    // Phase 7.5: a repo without crypto can't decrypt, so it must throw rather
    // than silently return an empty board (which would mask a missing key).
    await fetch(`${baseUrl}/b/locked-board-no-key`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locked: true,
        ciphertext: 'AAAA',
        iv: 'BBBB',
        kdfSalt: 'CCCC',
        kdfIters: 200_000,
        updatedAt: 1,
      }),
    });
    const repo = new RemoteRepository({ baseUrl, clock: fixedClock(1) });
    await expect(repo.load('locked-board-no-key')).rejects.toThrow(
      /locked|crypto|key/i,
    );
  });
});

// Phase 7.5 — RemoteRepository with a CryptoContext encrypts on save and
// decrypts on load + subscribe. The Phase 7 unlocked path is preserved for
// the no-crypto case (used by the existing tests above).
describe('RemoteRepository — crypto mode (Phase 7.5)', () => {
  const TEST_ITERS = 1_000;
  const SITE_PASSWORD = 'site-pw-7.5';

  // A gated server so create() can be tested end-to-end.
  let gatedHandle: ServerHandle;
  let gatedUrl: string;

  beforeEach(async () => {
    gatedHandle = await startServer({
      dbPath: ':memory:',
      port: 0,
      sitePassword: SITE_PASSWORD,
    });
    gatedUrl = `http://127.0.0.1:${String(gatedHandle.port)}`;
  });

  afterEach(async () => {
    await gatedHandle.close();
  });

  async function makeCrypto(passphrase = 'board-pw') {
    const kdfSalt = randomSalt();
    const key = await deriveKey(passphrase, kdfSalt, TEST_ITERS);
    return { key, kdfSalt, kdfIters: TEST_ITERS };
  }

  function seededBoard() {
    const b = addCard(createBoard({ startMonday: '2026-05-04', weeks: 4 }), {
      week: 0,
      day: 0,
      color: 'mint',
      text: 'SECRET',
      newId: () => 'card_x',
      clock: () => 1,
    });
    return b.board;
  }

  it('createLockedBoard with the correct site password returns ok and persists ciphertext', async () => {
    const crypto = await makeCrypto();
    const repo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(100),
    });
    const result = await repo.createLockedBoard(
      'fresh-slug-seven-five',
      seededBoard(),
      crypto,
      SITE_PASSWORD,
    );
    expect(result).toBe('ok');
    // Raw fetch to verify what landed
    const res = await fetch(`${gatedUrl}/b/fresh-slug-seven-five`);
    const env = (await res.json()) as {
      locked: boolean;
      ciphertext: string;
      kdfIters: number;
    };
    expect(env.locked).toBe(true);
    expect(env.kdfIters).toBe(TEST_ITERS);
    expect(env.ciphertext).not.toContain('SECRET');
  });

  it('createLockedBoard with the wrong site password returns unauthorized', async () => {
    const crypto = await makeCrypto();
    const repo = new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(1) });
    const result = await repo.createLockedBoard(
      'fresh-slug-wrong',
      seededBoard(),
      crypto,
      'WRONG',
    );
    expect(result).toBe('unauthorized');
    const get = await fetch(`${gatedUrl}/b/fresh-slug-wrong`);
    expect(get.status).toBe(404);
  });

  it('save (with crypto context) encrypts the board — server never sees plaintext', async () => {
    const crypto = await makeCrypto();
    const repo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(200),
      crypto,
    });
    // First create the slug
    await new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(100) })
      .createLockedBoard('crypto-save-test', seededBoard(), crypto, SITE_PASSWORD);
    // Then save updates via the crypto-mode repo
    const board2 = addCard(seededBoard(), {
      week: 1,
      day: 1,
      color: 'coral',
      text: 'ALSO-SECRET',
      newId: () => 'card_y',
      clock: () => 2,
    });
    await repo.save('crypto-save-test', board2.board);
    const res = await fetch(`${gatedUrl}/b/crypto-save-test`);
    const env = (await res.json()) as { locked: boolean; ciphertext: string };
    expect(env.locked).toBe(true);
    expect(env.ciphertext).not.toContain('ALSO-SECRET');
    expect(env.ciphertext).not.toContain('SECRET');
  });

  it('load (with the right crypto context) decrypts back to the original board', async () => {
    const crypto = await makeCrypto();
    const repo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(100),
      crypto,
    });
    const seed = seededBoard();
    await repo.createLockedBoard('roundtrip', seed, crypto, SITE_PASSWORD);
    const loaded = await repo.load('roundtrip');
    expect(loaded).toEqual(seed);
  });

  it('load (with the WRONG crypto context) throws — decrypt returned null', async () => {
    const writer = await makeCrypto('right-pw');
    const reader = await makeCrypto('wrong-pw');
    const writeRepo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(100),
      crypto: writer,
    });
    await writeRepo.createLockedBoard('wrong-key', seededBoard(), writer, SITE_PASSWORD);
    const readRepo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(100),
      crypto: reader,
    });
    await expect(readRepo.load('wrong-key')).rejects.toThrow(/decrypt|wrong|key/i);
  });

  it('loadEnvelope returns the raw locked envelope so the unlock screen can read kdfSalt/kdfIters', async () => {
    const crypto = await makeCrypto();
    const writeRepo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(100),
      crypto,
    });
    await writeRepo.createLockedBoard('inspect', seededBoard(), crypto, SITE_PASSWORD);
    const peekRepo = new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(1) });
    const env = await peekRepo.loadEnvelope('inspect');
    expect(env).not.toBeNull();
    expect(env?.locked).toBe(true);
    if (env?.locked === true) {
      expect(env.kdfIters).toBe(TEST_ITERS);
      expect(env.kdfSalt).toBe(crypto.kdfSalt);
    }
  });

  it('loadEnvelope returns null for an unknown slug', async () => {
    const repo = new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(1) });
    expect(await repo.loadEnvelope('not-here')).toBeNull();
  });

  it('subscribe (with crypto) decrypts the polled envelope before firing the callback', async () => {
    const crypto = await makeCrypto();
    await new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(100) })
      .createLockedBoard('poll-locked', seededBoard(), crypto, SITE_PASSWORD);
    const driver = manualPollDriver();
    const repo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(1),
      pollDriver: driver,
      crypto,
    });
    const seen: Array<{ board: Board; updatedAt: number }> = [];
    repo.subscribe('poll-locked', (b, u) => seen.push({ board: b, updatedAt: u }));
    await driver.fire();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.board.cards.map((c) => c.text)).toEqual(['SECRET']);
  });

  it('subscribe (with WRONG crypto) does not fire the callback — decryption failure is swallowed', async () => {
    const writer = await makeCrypto('right');
    const reader = await makeCrypto('wrong');
    await new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(100) })
      .createLockedBoard('poll-wrong-key', seededBoard(), writer, SITE_PASSWORD);
    const driver = manualPollDriver();
    const repo = new RemoteRepository({
      baseUrl: gatedUrl,
      clock: fixedClock(1),
      pollDriver: driver,
      crypto: reader,
    });
    const seen: unknown[] = [];
    repo.subscribe('poll-wrong-key', (b) => seen.push(b));
    await driver.fire();
    expect(seen).toHaveLength(0);
  });

  it('save without a crypto context PATCHing an existing locked slug also gets gated/handled — ciphertext stays locked', async () => {
    // Defensive: a save() call from a misconfigured repo (no crypto, but
    // server has a locked envelope) should not silently overwrite with an
    // unlocked envelope. We expect either an explicit throw or no write.
    const crypto = await makeCrypto();
    await new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(100) })
      .createLockedBoard('defensive', seededBoard(), crypto, SITE_PASSWORD);
    const repo = new RemoteRepository({ baseUrl: gatedUrl, clock: fixedClock(200) });
    // No crypto context. save() of plaintext to a locked slug would either
    // (a) throw outright, or (b) PATCH the unlocked envelope. The Phase 7.5
    // contract says: it MUST NOT replace the locked envelope with an unlocked
    // one. (a) is the cleanest signal of misconfiguration.
    await expect(repo.save('defensive', seededBoard())).rejects.toThrow(
      /crypto|locked/i,
    );
    // Verify the server still holds the original locked envelope.
    const res = await fetch(`${gatedUrl}/b/defensive`);
    const env = (await res.json()) as { locked: boolean };
    expect(env.locked).toBe(true);
  });
});
