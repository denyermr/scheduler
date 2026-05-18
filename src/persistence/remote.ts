import { createBoard } from '../domain/board';
import type { Board } from '../domain/types';
import { type Envelope, isUnlocked, unwrapUnlocked } from './envelope';
import type { BoardRepository } from './repository';

/**
 * A polling driver — the seam that lets tests advance the 10s poll cycle
 * synchronously without `vi.useFakeTimers` (which deadlocks RTL waitFor).
 *
 * Mirror of the `Clock` injection pattern from `src/domain/clock.ts`.
 *
 * The driver receives a `tick` callback and returns an unsubscribe fn.
 * `intervalPollDriver` (the production driver) fires `tick` every 10s
 * via `setInterval`. `manualPollDriver()` (tests) returns `.fire()` so a
 * test can drive the poll cadence by hand.
 */
export type PollDriver = (tick: () => Promise<void>) => () => void;

export const POLL_INTERVAL_MS = 10_000;

export const intervalPollDriver: PollDriver = (tick) => {
  const handle = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
  return () => {
    clearInterval(handle);
  };
};

/** Test-only manual driver: caller invokes `.fire()` to advance one tick. */
export function manualPollDriver(): PollDriver & { fire: () => Promise<void> } {
  let stored: (() => Promise<void>) | null = null;
  const driver: PollDriver = (tick) => {
    stored = tick;
    return () => {
      stored = null;
    };
  };
  return Object.assign(driver, {
    fire: (): Promise<void> => (stored ? stored() : Promise.resolve()),
  });
}

/** Default board emitted on a 404 (CLAUDE.md §5 invariant 1: unknown slug → empty board, no error). */
function freshEmptyBoard(): Board {
  return createBoard({ startMonday: '2024-05-27', weeks: 26 });
}

export type RemoteRepositoryOptions = {
  /** Base URL of the backend, e.g. `http://localhost:8787` or `''` for same-origin (Vite proxy). */
  baseUrl: string;
  /** Inject for tests. Default is `intervalPollDriver`. */
  pollDriver?: PollDriver;
  /** Inject for tests. Default is `Date.now`. Used to stamp envelope.updatedAt on writes. */
  clock?: () => number;
  /** Inject for tests. Default is the global `fetch`. */
  fetcher?: typeof fetch;
};

export class RemoteRepository implements BoardRepository {
  private readonly baseUrl: string;
  private readonly pollDriver: PollDriver;
  private readonly clock: () => number;
  private readonly fetcher: typeof fetch;
  /** Single-board offline queue — the most recent unflushed (slug, board). */
  private pending: { slug: string; board: Board } | null = null;

  constructor(opts: RemoteRepositoryOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.pollDriver = opts.pollDriver ?? intervalPollDriver;
    this.clock = opts.clock ?? ((): number => Date.now());
    this.fetcher = opts.fetcher ?? fetch;
  }

  /**
   * GET /b/:slug. On 200, returns the board from the envelope. On 404,
   * returns a fresh empty board (invariant 1). On network failure, throws.
   */
  async load(slug: string): Promise<Board> {
    const res = await this.fetcher(this.url(slug));
    if (res.status === 404) return freshEmptyBoard();
    if (!res.ok) throw new Error(`load(${slug}) failed: ${String(res.status)}`);
    const env = (await res.json()) as Envelope;
    if (!isUnlocked(env)) {
      throw new Error(
        `load(${slug}): server returned a locked envelope; Phase 7.5 not yet implemented client-side.`,
      );
    }
    return unwrapUnlocked(env).board;
  }

  /**
   * PATCH /b/:slug with the envelope `{ locked: false, board, updatedAt }`.
   * On any failure (network / non-2xx), enqueue the (slug, board) for retry
   * on the next poll tick. Saves are fire-and-forget from the editor's POV —
   * the editor doesn't await this promise's resolution semantics.
   */
  async save(slug: string, board: Board): Promise<void> {
    const envelope: Envelope = {
      locked: false,
      board,
      updatedAt: this.clock(),
    };
    try {
      const res = await this.fetcher(this.url(slug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      if (!res.ok) {
        this.pending = { slug, board };
        return;
      }
      if (this.pending?.slug === slug) {
        this.pending = null;
      }
    } catch {
      this.pending = { slug, board };
    }
  }

  /**
   * Subscribe to remote changes for `slug`. Installs a `pollDriver` tick:
   *
   *   1. If there's a queued offline save for this slug, retry it first
   *      (so a reconnect flushes our writes before reading server state).
   *   2. GET /b/:slug; pass `(board, envelopeUpdatedAt)` to `callback`.
   *
   * Returns an unsubscribe fn. 404 / non-2xx / network errors are
   * swallowed — the next tick tries again.
   */
  subscribe(
    slug: string,
    callback: (board: Board, envelopeUpdatedAt: number) => void,
  ): () => void {
    const tick = async (): Promise<void> => {
      if (this.pending !== null && this.pending.slug === slug) {
        await this.save(this.pending.slug, this.pending.board);
      }
      let res: Response;
      try {
        res = await this.fetcher(this.url(slug));
      } catch {
        return;
      }
      if (res.status === 404) return; // no row yet; nothing to merge
      if (!res.ok) return;
      let env: Envelope;
      try {
        env = (await res.json()) as Envelope;
      } catch {
        return;
      }
      if (!isUnlocked(env)) return; // Phase 7.5; skip in v1
      callback(env.board, env.updatedAt);
    };
    return this.pollDriver(tick);
  }

  /** Test/diagnostic helper. */
  hasPendingSave(): boolean {
    return this.pending !== null;
  }

  private url(slug: string): string {
    return `${this.baseUrl}/b/${slug}`;
  }
}
