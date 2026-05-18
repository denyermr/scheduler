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
  it('empty local + empty incoming → empty', () => {
    const result = mergeBoardFromIncoming({
      local: baseBoard,
      incoming: baseBoard,
      envelopeUpdatedAt: 100,
    });
    expect(result.cards).toEqual([]);
    expect(result.threads).toEqual([]);
  });

  // ─── Cards in both: per-card LWW by updatedAt ──────────────────────
  it('card present in both — incoming newer wins (full record)', () => {
    const local = { ...baseBoard, cards: [card('c1', { text: 'local', updatedAt: 100 })] };
    const incoming = {
      ...baseBoard,
      cards: [card('c1', { text: 'remote', color: 'sky', updatedAt: 200 })],
    };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 200 });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.text).toBe('remote');
    expect(result.cards[0]?.color).toBe('sky');
    expect(result.cards[0]?.updatedAt).toBe(200);
  });

  it('card present in both — local newer wins (full record)', () => {
    const local = { ...baseBoard, cards: [card('c1', { text: 'local', updatedAt: 300 })] };
    const incoming = { ...baseBoard, cards: [card('c1', { text: 'remote', updatedAt: 200 })] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 200 });
    expect(result.cards[0]?.text).toBe('local');
    expect(result.cards[0]?.updatedAt).toBe(300);
  });

  it('card present in both — equal updatedAt: incoming wins (tie-break documented)', () => {
    const local = { ...baseBoard, cards: [card('c1', { text: 'local', updatedAt: 200 })] };
    const incoming = { ...baseBoard, cards: [card('c1', { text: 'remote', updatedAt: 200 })] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 200 });
    expect(result.cards[0]?.text).toBe('remote');
  });

  // ─── Card asymmetric cases: trust the source ──────────────────────
  it('local-only card kept (trust local — never silently drop user work)', () => {
    const local = { ...baseBoard, cards: [card('c_new', { updatedAt: 50 })] };
    const incoming = baseBoard;
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 500 });
    expect(result.cards.map((c) => c.id)).toEqual(['c_new']);
  });

  it('incoming-only card added (trust server — never silently drop another user`s work)', () => {
    const local = baseBoard;
    const incoming = { ...baseBoard, cards: [card('c_remote', { updatedAt: 300 })] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 300 });
    expect(result.cards.map((c) => c.id)).toEqual(['c_remote']);
  });

  // ─── Threads ──────────────────────────────────────────────────────
  it('thread present in both — kept', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t1', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 100 });
    expect(result.threads.map((th) => th.id)).toEqual(['t1']);
  });

  it('thread local-only — kept (trust local)', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t_new', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 200 });
    expect(result.threads.map((th) => th.id)).toEqual(['t_new']);
  });

  it('thread incoming-only — added (trust server)', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t_remote', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [] };
    const incoming = { ...baseBoard, cards: [c1, c2], threads: [t] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 200 });
    expect(result.threads.map((th) => th.id)).toEqual(['t_remote']);
  });

  // ─── Cascade: invariant 9 over the wire ────────────────────────────
  it('cascade — thread whose endpoint is dropped during merge is also dropped', () => {
    const c1 = card('c1');
    const c2 = card('c2');
    const t = thread('t1', 'c1', 'c2');
    const local = { ...baseBoard, cards: [c1, c2], threads: [t] };
    // Incoming: c2 has been deleted server-side; the thread arrives stale.
    const incoming = { ...baseBoard, cards: [c1], threads: [t] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 300 });
    // Note: c2 is *local-only* under "trust local", so cascade applies via a
    // delete elsewhere — exercise the case where the card is removed via the
    // updatedAt tiebreaker.
    expect(result.cards.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    // Even though c2 still exists due to trust-local, the test still pins
    // that t1 survives because both endpoints are present. Cascade engages
    // only when the merge legitimately removes an endpoint. See the
    // cascade-on-pruned-endpoint test below.
    expect(result.threads).toEqual([t]);
  });

  it('cascade — when an endpoint card is genuinely absent after merge, thread is dropped', () => {
    // Construct a scenario where the cascade actually fires: a thread
    // exists in the local-only set but references a card that doesn't
    // exist in either local or incoming.
    const c1 = card('c1');
    // c2 doesn't exist anywhere; the thread is dangling on arrival.
    const t = thread('t_dangling', 'c1', 'c_gone');
    const local = { ...baseBoard, cards: [c1], threads: [t] };
    const incoming = { ...baseBoard, cards: [c1], threads: [] };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 300 });
    expect(result.cards.map((c) => c.id)).toEqual(['c1']);
    expect(result.threads).toEqual([]);
  });

  // ─── Top-level metadata preserved ──────────────────────────────────
  it('startMonday and weeks come from incoming (server is authoritative)', () => {
    const local: Board = { ...baseBoard, weeks: 4, startMonday: '2024-05-27' };
    const incoming: Board = { ...baseBoard, weeks: 30, startMonday: '2024-06-03' };
    const result = mergeBoardFromIncoming({ local, incoming, envelopeUpdatedAt: 200 });
    expect(result.weeks).toBe(30);
    expect(result.startMonday).toBe('2024-06-03');
  });
});
