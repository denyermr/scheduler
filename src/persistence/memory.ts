import type { Board } from '../domain/types';
import type { BoardRepository } from './repository';

export class InMemoryRepository implements BoardRepository {
  private readonly store = new Map<string, Board>();

  constructor(seed?: Iterable<readonly [string, Board]>) {
    if (seed) {
      for (const [slug, board] of seed) {
        this.store.set(slug, board);
      }
    }
  }

  load(slug: string): Promise<Board | null> {
    return Promise.resolve(this.store.get(slug) ?? null);
  }

  save(slug: string, board: Board): Promise<void> {
    this.store.set(slug, board);
    return Promise.resolve();
  }

  set(slug: string, board: Board): void {
    this.store.set(slug, board);
  }
}
