import type { Board } from '../domain/types';
import { buildDemoBoard, DEMO_SLUG } from './demoBoard';
import type { BoardRepository } from './repository';

/**
 * Phase 2 stub. Returns a hard-coded demo board for every slug so the read-only
 * renderer has something to draw. Writes and real persistence land in Phase 3.
 */
export class LocalStorageRepository implements BoardRepository {
  load(slug: string): Promise<Board | null> {
    void slug;
    return Promise.resolve(buildDemoBoard());
  }
}

export { DEMO_SLUG };
