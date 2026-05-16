import type { Board } from '../domain/types';

export interface BoardRepository {
  load(slug: string): Promise<Board | null>;
}
