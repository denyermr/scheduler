import type { Board } from '../domain/types';

export interface BoardRepository {
  load(slug: string): Promise<Board | null>;
  save(slug: string, board: Board): Promise<void>;
}
