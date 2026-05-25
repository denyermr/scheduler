import { createBoard } from '../domain/board';
import type { Board } from '../domain/types';
import { decryptEnvelope, encryptBoard } from './crypto';
import {
  type Envelope,
  type LockedEnvelope,
  isLocked,
  unwrapUnlocked,
} from './envelope';
import type { BoardRepository } from './repository';

/**
 * Phase 7.5 crypto context: everything a RemoteRepository needs to
 * encrypt outgoing saves and decrypt incoming envelopes for one slug.
 * Created once after the user successfully unlocks (or creates) a board,
 * cached in sessionStorage so reloads in the same tab don't re-prompt.
 */
export type CryptoContext = {
  key: CryptoKey;
  kdfSalt: string;
  kdfIters: number;
};

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
  /**
   * Phase 7.5: when set, save() encrypts the board into a locked envelope
   * and load/subscribe decrypt incoming envelopes. Without it, load()
   * throws on a locked envelope (Phase 7-style behavior preserved for the
   * splash/unlock peek path that must work before crypto is available).
   */
  crypto?: CryptoContext;
};

export class RemoteRepository implements BoardRepository {
  private readonly baseUrl: string;
  private readonly pollDriver: PollDriver;
  private readonly clock: () => number;
  private readonly fetcher: typeof fetch;
  private readonly crypto: CryptoContext | null;
  /** Single-board offline queue — the most recent unflushed (slug, board). */
  private pending: { slug: string; board: Board } | null = null;

  constructor(opts: RemoteRepositoryOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.pollDriver = opts.pollDriver ?? intervalPollDriver;
    this.clock = opts.clock ?? ((): number => Date.now());
    this.crypto = opts.crypto ?? null;
    // Browser `fetch` MUST be invoked with `window` as `this`. Storing the
    // bare reference on `this.fetcher` and calling via `this.fetcher(...)`
    // would lose the binding and throw "Illegal invocation". Wrap in a
    // closure so the call site is always a free function call.
    const providedFetcher = opts.fetcher;
    this.fetcher =
      providedFetcher ??
      ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        fetch(input, init));
  }

  /**
   * GET /b/:slug. On 200 with a locked envelope, decrypts with the
   * configured crypto context (throws if none / decrypt fails). On 200
   * with an unlocked envelope, returns the plaintext board (Phase 7
   * compat). On 404, returns a fresh empty board (invariant 1).
   */
  async load(slug: string): Promise<Board> {
    const env = await this.loadEnvelope(slug);
    if (env === null) return freshEmptyBoard();
    if (isLocked(env)) {
      if (this.crypto === null) {
        throw new Error(
          `load(${slug}): server returned a locked envelope but no crypto context is configured.`,
        );
      }
      const decrypted = await decryptEnvelope(env, this.crypto.key);
      if (decrypted === null) {
        throw new Error(
          `load(${slug}): decrypt failed — wrong key for this envelope.`,
        );
      }
      return decrypted;
    }
    return unwrapUnlocked(env).board;
  }

  /**
   * GET /b/:slug returning the raw envelope (or null for 404). Used by the
   * unlock screen to read `kdfSalt` + `kdfIters` before a key exists.
   */
  async loadEnvelope(slug: string): Promise<Envelope | null> {
    const res = await this.fetcher(this.url(slug));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`loadEnvelope(${slug}) failed: ${String(res.status)}`);
    return (await res.json()) as Envelope;
  }

  /**
   * PATCH /b/:slug. With a crypto context, encrypts the board into a
   * locked envelope. Without a crypto context, PATCHes the legacy unlocked
   * envelope — but if the slug already holds a LOCKED envelope, throws
   * rather than overwrite it (defensive: never silently downgrade a locked
   * board to unlocked).
   *
   * On any failure (network / non-2xx), enqueue (slug, board) for retry on
   * the next poll tick.
   */
  async save(slug: string, board: Board): Promise<void> {
    let body: string;
    if (this.crypto !== null) {
      const payload = await encryptBoard(board, this.crypto.key);
      const envelope: LockedEnvelope = {
        locked: true,
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        kdfSalt: this.crypto.kdfSalt,
        kdfIters: this.crypto.kdfIters,
        updatedAt: this.clock(),
      };
      body = JSON.stringify(envelope);
    } else {
      // No crypto context — check the slug isn't already locked before
      // overwriting with an unlocked envelope.
      const existing = await this.loadEnvelope(slug).catch(() => null);
      if (existing !== null && isLocked(existing)) {
        throw new Error(
          `save(${slug}): existing envelope is locked — refusing to overwrite without a crypto context.`,
        );
      }
      const envelope: Envelope = {
        locked: false,
        board,
        updatedAt: this.clock(),
      };
      body = JSON.stringify(envelope);
    }
    try {
      const res = await this.fetcher(this.url(slug), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
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
   * Splash-screen flow: encrypt an initial board, PATCH with the site
   * password header to create a new locked row. Returns `'ok'` on success,
   * `'unauthorized'` on 401 (wrong site password), `'error'` otherwise.
   * Does NOT enqueue on failure (the splash is interactive — let the user
   * retry).
   */
  async createLockedBoard(
    slug: string,
    board: Board,
    crypto: CryptoContext,
    sitePassword: string,
  ): Promise<'ok' | 'unauthorized' | 'error'> {
    const payload = await encryptBoard(board, crypto.key);
    const envelope: LockedEnvelope = {
      locked: true,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      kdfSalt: crypto.kdfSalt,
      kdfIters: crypto.kdfIters,
      updatedAt: this.clock(),
    };
    let res: Response;
    try {
      res = await this.fetcher(this.url(slug), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Site-Password': sitePassword,
        },
        body: JSON.stringify(envelope),
      });
    } catch {
      return 'error';
    }
    if (res.status === 401) return 'unauthorized';
    if (!res.ok) return 'error';
    return 'ok';
  }

  /**
   * Subscribe to remote changes for `slug`. Installs a `pollDriver` tick:
   *
   *   1. If there's a queued offline save for this slug, retry it first.
   *   2. GET /b/:slug; decrypt if needed; pass `(board, envelopeUpdatedAt)`
   *      to `callback`. Decryption failures are silently dropped (the next
   *      tick tries again).
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
      if (res.status === 404) return;
      if (!res.ok) return;
      let env: Envelope;
      try {
        env = (await res.json()) as Envelope;
      } catch {
        return;
      }
      if (isLocked(env)) {
        if (this.crypto === null) return;
        const decrypted = await decryptEnvelope(env, this.crypto.key);
        if (decrypted === null) return;
        callback(decrypted, env.updatedAt);
        return;
      }
      const { board, updatedAt } = unwrapUnlocked(env);
      callback(board, updatedAt);
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
