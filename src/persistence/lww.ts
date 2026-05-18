import type { Board, Card, Thread } from '../domain/types';

export type MergeInput = {
  /** The client's current board state. */
  local: Board;
  /** The board the server just sent us (already unwrapped from the envelope). */
  incoming: Board;
  /** The envelope's `updatedAt` — the wall-clock at which the server snapshot was taken. */
  envelopeUpdatedAt: number;
  /**
   * The client's most recent local mutation timestamp. The repository tracks
   * this; it bumps on every local change (add / edit / move / delete card,
   * add / delete thread, resize). Used to decide whether local-only entities
   * survive a poll: if we changed something locally AFTER the server
   * snapshot, our local-only entities are real adds and should be kept.
   */
  lastLocalChangeAt: number;
};

/**
 * Merge an incoming board (from a 10s poll) into the local board following
 * CLAUDE.md §5 invariant 4 ("last-writer-wins per card and per thread").
 *
 * Cards (per-card LWW by `updatedAt`):
 *   - in both                → max updatedAt wins (whole record replaces)
 *   - local only             → kept iff card.updatedAt > envelopeUpdatedAt
 *                              (we added/edited it after the server snapshot)
 *   - incoming only          → added iff envelopeUpdatedAt > lastLocalChangeAt
 *                              (else we just deleted it locally)
 *
 * Threads (set-diff by id; threads are immutable, no per-thread timestamp):
 *   - in both                → kept
 *   - local only             → kept iff lastLocalChangeAt > envelopeUpdatedAt
 *   - incoming only          → added iff envelopeUpdatedAt > lastLocalChangeAt
 *
 * Cascade: after the card merge, any thread whose endpoint card is no
 * longer present is dropped (invariant 9 over the wire).
 *
 * Top-level metadata (`startMonday`, `weeks`) is taken from `incoming` —
 * the server is authoritative for board-level dimensions because resize
 * goes through `PATCH` and the merge runs on the response.
 */
export function mergeBoardFromIncoming(input: MergeInput): Board {
  const { local, incoming, envelopeUpdatedAt, lastLocalChangeAt } = input;

  // ─── Cards ────────────────────────────────────────────────────────
  const incomingCardById = new Map<string, Card>();
  for (const c of incoming.cards) incomingCardById.set(c.id, c);
  const localCardById = new Map<string, Card>();
  for (const c of local.cards) localCardById.set(c.id, c);

  const mergedCards: Card[] = [];
  const seenIds = new Set<string>();

  // Cards present in both, or local-only.
  for (const localCard of local.cards) {
    const incomingCard = incomingCardById.get(localCard.id);
    if (incomingCard !== undefined) {
      // In both — per-card LWW. Tie goes to incoming (documented).
      mergedCards.push(
        incomingCard.updatedAt >= localCard.updatedAt ? incomingCard : localCard,
      );
    } else {
      // Local only.
      if (localCard.updatedAt > envelopeUpdatedAt) {
        mergedCards.push(localCard);
      }
      // else: dropped (server has authoritatively deleted it)
    }
    seenIds.add(localCard.id);
  }

  // Cards in incoming only.
  for (const incomingCard of incoming.cards) {
    if (seenIds.has(incomingCard.id)) continue;
    if (envelopeUpdatedAt > lastLocalChangeAt) {
      mergedCards.push(incomingCard);
    }
    // else: we deleted it locally; don't resurrect it
  }

  // ─── Threads ──────────────────────────────────────────────────────
  const incomingThreadById = new Map<string, Thread>();
  for (const t of incoming.threads) incomingThreadById.set(t.id, t);
  const localThreadById = new Map<string, Thread>();
  for (const t of local.threads) localThreadById.set(t.id, t);

  const mergedThreads: Thread[] = [];
  const seenThreadIds = new Set<string>();

  for (const localThread of local.threads) {
    const incomingThread = incomingThreadById.get(localThread.id);
    if (incomingThread !== undefined) {
      mergedThreads.push(localThread); // identical-by-id; either works
    } else {
      if (lastLocalChangeAt > envelopeUpdatedAt) {
        mergedThreads.push(localThread);
      }
    }
    seenThreadIds.add(localThread.id);
  }

  for (const incomingThread of incoming.threads) {
    if (seenThreadIds.has(incomingThread.id)) continue;
    if (envelopeUpdatedAt > lastLocalChangeAt) {
      mergedThreads.push(incomingThread);
    }
  }

  // ─── Cascade: drop threads whose endpoints are no longer present ──
  const finalCardIds = new Set(mergedCards.map((c) => c.id));
  const survivingThreads = mergedThreads.filter(
    (t) => finalCardIds.has(t.fromCardId) && finalCardIds.has(t.toCardId),
  );

  return {
    startMonday: incoming.startMonday,
    weeks: incoming.weeks,
    cards: mergedCards,
    threads: survivingThreads,
  };
}
