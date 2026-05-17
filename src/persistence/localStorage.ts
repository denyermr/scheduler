import type { Board } from '../domain/types';
import { buildDemoBoard, DEMO_SLUG } from './demoBoard';
import type { BoardRepository } from './repository';

/**
 * Persists each board JSON-encoded under `sb:board:<slug>`. A cache miss falls
 * back to a freshly-seeded demo board so the first-load experience is
 * unchanged across Phase 3. Phase 7 replaces this with real routing where
 * unknown slugs create an empty board.
 */
export class LocalStorageRepository implements BoardRepository {
  private static readonly PREFIX = 'sb:board:';
  private readonly storage: Storage;

  constructor(storage?: Storage) {
    this.storage = storage ?? window.localStorage;
  }

  private key(slug: string): string {
    return LocalStorageRepository.PREFIX + slug;
  }

  load(slug: string): Promise<Board | null> {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key(slug));
    } catch {
      // Storage unavailable (private mode quota, blocked, etc.) — fall back.
      return Promise.resolve(buildDemoBoard());
    }
    if (raw === null) {
      return Promise.resolve(buildDemoBoard());
    }
    try {
      const parsed = JSON.parse(raw) as Board;
      return Promise.resolve(parsed);
    } catch {
      return Promise.resolve(buildDemoBoard());
    }
  }

  save(slug: string, board: Board): Promise<void> {
    try {
      this.storage.setItem(this.key(slug), JSON.stringify(board));
    } catch {
      // Quota exceeded or storage blocked. Drop silently in Phase 3 — a real
      // backend in Phase 7 will surface failures via the network layer.
    }
    return Promise.resolve();
  }
}

export { DEMO_SLUG };
