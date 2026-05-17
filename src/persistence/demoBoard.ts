import { addCard, addThread, createBoard } from '../domain/board';
import type { Board, CardId, Color, Day } from '../domain/types';

type DemoCard = { w: number; d: Day; c: Color; t: string };

const DEMO_CARDS: readonly DemoCard[] = [
  { w: 0, d: 1, c: 'coral', t: 'BLOCK' },
  { w: 1, d: 0, c: 'sky', t: 'DRESS' },
  { w: 1, d: 1, c: 'coral', t: 'RIG' },
  { w: 1, d: 2, c: 'coral', t: 'BLOCK' },
  { w: 1, d: 3, c: 'peach', t: 'BLOCK' },
  { w: 2, d: 2, c: 'peach', t: 'Dress + light' },
  { w: 3, d: 0, c: 'coral', t: 'RIG' },
  { w: 3, d: 1, c: 'orange', t: 'BLOCK' },
  { w: 4, d: 0, c: 'peach', t: 'Ian recs' },
  { w: 4, d: 4, c: 'coral', t: 'BLOCK' },
  { w: 5, d: 2, c: 'peach', t: 'Dress + light' },
  { w: 6, d: 0, c: 'sky', t: 'DRESS' },
  { w: 6, d: 2, c: 'lilac', t: 'LIGHT' },
  { w: 7, d: 0, c: 'orange', t: 'BLOCK' },
  { w: 7, d: 1, c: 'orange', t: 'BLOCK' },
  { w: 8, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 9, d: 3, c: 'coral', t: 'Claire McCarty' },
  { w: 10, d: 0, c: 'mint', t: 'Claire McCarty' },
  { w: 10, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 11, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 11, d: 3, c: 'peach', t: 'BLOCK' },
  { w: 12, d: 0, c: 'sky', t: 'BUILD' },
  { w: 12, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 12, d: 2, c: 'peach', t: 'Episode 1 Q 1350' },
  { w: 13, d: 1, c: 'peach', t: 'Dress + light' },
  { w: 14, d: 1, c: 'peach', t: '120-0250' },
  { w: 15, d: 1, c: 'peach', t: 'Symphony Holiday' },
  { w: 15, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 16, d: 0, c: 'peach', t: 'Dress + light' },
  { w: 16, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 16, d: 2, c: 'peach', t: '12-0050 Trolley AP' },
  { w: 18, d: 0, c: 'peach', t: 'Dress + light' },
  { w: 18, d: 1, c: 'peach', t: 'Block' },
  { w: 19, d: 0, c: 'coral', t: 'RIG' },
  { w: 19, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 19, d: 2, c: 'peach', t: 'BLOCK' },
  { w: 19, d: 3, c: 'peach', t: 'Dress + light' },
  { w: 20, d: 0, c: 'orange', t: 'PROG MOCO' },
  { w: 20, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 21, d: 0, c: 'orange', t: 'PROG MOCO' },
  { w: 21, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 22, d: 2, c: 'orange', t: 'PROG MOCO' },
  { w: 22, d: 3, c: 'peach', t: 'BLOCK' },
  { w: 23, d: 0, c: 'peach', t: 'BLOCK' },
  { w: 24, d: 1, c: 'peach', t: 'BLOCK' },
  { w: 25, d: 1, c: 'coral', t: 'BLOCK' },
  { w: 25, d: 2, c: 'peach', t: 'Dress + light' },
  // Weekend tags (Sat=5, Sun=6) — fewer, lighter. Added in spec v2.
  { w: 2, d: 5, c: 'mint', t: 'OFF' },
  { w: 5, d: 6, c: 'mint', t: 'OFF' },
  { w: 8, d: 5, c: 'coral', t: 'OT crew' },
  { w: 13, d: 5, c: 'mint', t: 'Holiday' },
  { w: 13, d: 6, c: 'mint', t: 'Holiday' },
  { w: 17, d: 6, c: 'yellow', t: 'Render Q' },
  { w: 22, d: 5, c: 'mint', t: 'OFF' },
];

const DEMO_THREADS: readonly [number, number][] = [
  [6, 11],
  [12, 17],
  [21, 28],
  [38, 41],
];

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function buildDemoBoard(seed = 0xdeadbeef): Board {
  const rng = seededRng(seed);
  let board = createBoard({ startMonday: '2024-05-27', weeks: 26 });
  const cardIds: CardId[] = [];
  DEMO_CARDS.forEach((c, idx) => {
    const r = addCard(board, {
      week: c.w,
      day: c.d,
      color: c.c,
      text: c.t,
      rng,
      newId: () => `card_demo_${String(idx).padStart(4, '0')}`,
    });
    board = r.board;
    cardIds.push(r.cardId);
  });
  DEMO_THREADS.forEach(([from, to], idx) => {
    const fromId = cardIds[from];
    const toId = cardIds[to];
    if (!fromId || !toId) return;
    const r = addThread(board, {
      fromCardId: fromId,
      toCardId: toId,
      newId: () => `thread_demo_${String(idx).padStart(4, '0')}`,
    });
    board = r.board;
  });
  return board;
}

export const DEMO_SLUG = 'oak-thread-942';
