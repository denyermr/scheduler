import { describe, expect, it } from 'vitest';
import { mergeBoardFromIncoming } from '../../../src/persistence/lww';
import type { Board, Card, Thread } from '../../../src/domain/types';

const baseBoard: Board = {
  startMonday: '2024-05-27',
  weeks: 4,
  cards: [],
  threads: [],
};

function card(id: string, fields: Partial<Card> = {}): Card {
  return {
    id,
    week: 0,
    day: 0,
    color: 'peach',
    text: '',
    rotation: 0,
    pin: '#d6463a',
    createdAt: 1000,
    updatedAt: 1000,
    z: 0,
    ...fields,
  };
}

function thread(id: string, from: string, to: string): Thread {
  return { id, fromCardId: from, toCardId: to };
}

describe('mergeBoardFromIncoming', () => {
  // ─── Edge cases ────────────────────────────────────────────────────
  it('empty local + empty incoming → empty', () => {
    const result = mergeBoardFromIncoming({
      local: baseBoard,
      incoming: baseBoard,
      envelopeUpdatedAt: 100,
      lastLocalChangeAt: 0,
    });
    expect(result.cards).toEqual([]);
    expect(result.threads).toEqual([]);
  });

  // ─── Cards in both: per-card LWW by updatedAt ──────────────────────
  it('card present in both — incoming newer wins (full record)', () => {
    const local = { ...baseBoard, cards: [card('c1', { text: 'local', updatedAt: 100 })] };
    const incoming = { ...baseBoard, cards: [card('c1', { text: 'remote', color: 'sky', updatedAt: 200 })] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 100,
    });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.text).toBe('remote');
    expect(result.cards[0]?.color).toBe('sky');
    expect(result.cards[0]?.updatedAt).toBe(200);
  });

  it('card present in both — local newer wins (full record)', () => {
    const local = { ...baseBoard, cards: [card('c1', { text: 'local', updatedAt: 300 })] };
    const incoming = { ...baseBoard, cards: [card('c1', { text: 'remote', updatedAt: 200 })] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 300,
    });
    expect(result.cards[0]?.text).toBe('local');
    expect(result.cards[0]?.updatedAt).toBe(300);
  });

  it('card present in both — equal updatedAt: incoming wins (tie-break documented)', () => {
    const local = { ...baseBoard, cards: [card('c1', { text: 'local', updatedAt: 200 })] };
    const incoming = { ...baseBoard, cards: [card('c1', { text: 'remote', updatedAt: 200 })] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 200,
    });
    expect(result.cards[0]?.text).toBe('remote');
  });

  // ─── Card local-only ───────────────────────────────────────────────
  it('local-only card kept when card.updatedAt > envelope.updatedAt (we added after snapshot)', () => {
    const local = { ...baseBoard, cards: [card('c_new', { updatedAt: 300 })] };
    const incoming = baseBoard;
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 300,
    });
    expect(result.cards.map((c) => c.id)).toEqual(['c_new']);
  });

  it('local-only card dropped when card.updatedAt < envelope.updatedAt (server deleted it)', () => {
    const local = { ...baseBoard, cards: [card('c_stale', { updatedAt: 100 })] };
    const incoming = baseBoard;
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 100,
    });
    expect(result.cards).toEqual([]);
  });

  // ─── Card incoming-only ────────────────────────────────────────────
  it('incoming-only card added when envelope.updatedAt > lastLocalChangeAt', () => {
    const local = baseBoard;
    const incoming = { ...baseBoard, cards: [card('c_remote', { updatedAt: 300 })] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 300,
      lastLocalChangeAt: 100,
    });
    expect(result.cards.map((c) => c.id)).toEqual(['c_remote']);
  });

  it('incoming-only card dropped when envelope.updatedAt < lastLocalChangeAt (we deleted it locally)', () => {
    const local = baseBoard;
    const incoming = { ...baseBoard, cards: [card('c_deleted_locally', { updatedAt: 100 })] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 100,
      lastLocalChangeAt: 200,
    });
    expect(result.cards).toEqual([]);
  });

  // ─── Threads (set-diff by id, no per-entity timestamp) ─────────────
  it('thread present in both — kept', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t1', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 100,
      lastLocalChangeAt: 100,
    });
    expect(result.threads.map((th) => th.id)).toEqual(['t1']);
  });

  it('thread local-only kept when lastLocalChangeAt > envelope.updatedAt (we added it)', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t_new', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 100,
      lastLocalChangeAt: 200,
    });
    expect(result.threads.map((th) => th.id)).toEqual(['t_new']);
  });

  it('thread local-only dropped when lastLocalChangeAt < envelope.updatedAt (server deleted it)', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t_stale', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 100,
    });
    expect(result.threads).toEqual([]);
  });

  it('thread incoming-only added when envelope.updatedAt > lastLocalChangeAt', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t_remote', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 100,
    });
    expect(result.threads.map((th) => th.id)).toEqual(['t_remote']);
  });

  it('thread incoming-only dropped when envelope.updatedAt < lastLocalChangeAt (we deleted it)', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t_we_deleted', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 100,
      lastLocalChangeAt: 200,
    });
    expect(result.threads).toEqual([]);
  });

  // ─── Cascade: invariant 9 over the wire ────────────────────────────
  it('cascade — thread whose endpoint is dropped during merge is also dropped', () => {
    const c1 = card('c1', { updatedAt: 100 });
    const c2 = card('c2', { updatedAt: 100 });
    const t = thread('t1', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    // Incoming: c2 has been deleted server-side. envelope.updatedAt > all local timestamps.
    const incoming = { ...baseBoard, cards: [c1], threads: [t] };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 300,
      lastLocalChangeAt: 100,
    });
    expect(result.cards.map((c) => c.id)).toEqual(['c1']);
    // t referenced c2 which is gone → cascade-removed even though incoming still listed t.
    expect(result.threads).toEqual([]);
  });

  // ─── Top-level metadata preserved ──────────────────────────────────
  it('startMonday and weeks come from incoming (server is authoritative for board metadata)', () => {
    const local: Board = { ...baseBoard, weeks: 4, startMonday: '2024-05-27' };
    const incoming: Board = { ...baseBoard, weeks: 30, startMonday: '2024-06-03' };
    const result = mergeBoardFromIncoming({
      local,
      incoming,
      envelopeUpdatedAt: 200,
      lastLocalChangeAt: 100,
    });
    expect(result.weeks).toBe(30);
    expect(result.startMonday).toBe('2024-06-03');
  });
});
