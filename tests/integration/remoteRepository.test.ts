import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, type ServerHandle } from '../../server/server';
import {
  POLL_INTERVAL_MS,
  RemoteRepository,
  intervalPollDriver,
  manualPollDriver,
} from '../../src/persistence/remote';
import { createBoard, addCard } from '../../src/domain/board';
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

  it('a server returning a locked envelope causes load() to throw (Phase 7.5 not implemented)', async () => {
    // Write a "locked" envelope directly via raw fetch (bypassing repo.save).
    await fetch(`${baseUrl}/b/locked-board`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locked: true,
        ciphertext: 'AAAA',
        iv: 'BBBB',
        kdfSalt: 'CCCC',
        kdfIters: 250_000,
        updatedAt: 1,
      }),
    });
    const repo = new RemoteRepository({ baseUrl, clock: fixedClock(1) });
    await expect(repo.load('locked-board')).rejects.toThrow(/locked|Phase 7.5/i);
  });
});
