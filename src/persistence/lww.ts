import type { Board, Card, Thread } from '../domain/types';

export type MergeInput = {
  /** The client's current local board state. */
  local: Board;
  /** The board the server just sent us (already unwrapped from the envelope). */
  incoming: Board;
  /** The envelope's `updatedAt` — used as a card-level tiebreaker for the
   *  "both" case. Not used for asymmetric (local-only / incoming-only) cases
   *  in v1: those default to "trust the source" per the rules below. */
  envelopeUpdatedAt: number;
};

/**
 * Merge an incoming board (from a 10s poll) into the local board following
 * CLAUDE.md §5 invariant 4 ("last-writer-wins per card and per thread").
 *
 * Rules (v1 — simple, eventually-consistent):
 *
 *   Cards in both         → per-card LWW by `updatedAt` (tie → incoming).
 *   Card local-only       → KEEP (trust local).
 *   Card incoming-only    → ADD  (trust server).
 *
 *   Thread in both        → kept (immutable identity).
 *   Thread local-only     → KEEP (trust local).
 *   Thread incoming-only  → ADD  (trust server).
 *
 *   Cascade               → drop any thread whose endpoint card is no longer
 *                           present after the card merge (invariant 9 over
 *                           the wire).
 *
 *   Metadata              → `startMonday` and `weeks` come from `incoming`
 *                           (the server is authoritative for board-level
 *                           dimensions; resize goes through PATCH).
 *
 * Known v1 limitations (documented in reviews/phase-7.md):
 *  - Local-delete + stale poll: a poll that arrives between a local
 *    delete and the matching PATCH (i.e. inside the 250ms debounce window
 *    or while offline) will briefly re-introduce the deleted entity into
 *    the local view. The next PATCH-then-poll round (≤ 10s) corrects it.
 *  - Concurrent delete-vs-edit across tabs: with "trust local + trust
 *    server" both deletions can lose to a racing PATCH from the tab that
 *    only saw the entity. A v2 tombstone or CRDT layer would fix this;
 *    out of scope for v1.
 *
 * The earlier `lastLocalChangeAt`-gated rule was abandoned because it
 * dropped legitimate remote-adds whenever there was recent local activity
 * (e.g. user A edits one card while user B adds another — A's next poll
 * would silently drop B's new card). The simpler rule trades some
 * delete-convergence-window UX for never silently dropping remote work.
 */
export function mergeBoardFromIncoming(input: MergeInput): Board {
  const { local, incoming, envelopeUpdatedAt: _unused } = input;
  void _unused; // tiebreaker is per-card; envelopeUpdatedAt isn't used in v1.

  // ─── Cards ────────────────────────────────────────────────────────
  const incomingCardById = new Map<string, Card>();
  for (const c of incoming.cards) incomingCardById.set(c.id, c);

  const mergedCards: Card[] = [];
  const seenIds = new Set<string>();

  for (const localCard of local.cards) {
    const incomingCard = incomingCardById.get(localCard.id);
    if (incomingCard !== undefined) {
      // In both — per-card LWW. Tie goes to incoming (documented).
      mergedCards.push(
        incomingCard.updatedAt >= localCard.updatedAt ? incomingCard : localCard,
      );
    } else {
      // Local only — trust local.
      mergedCards.push(localCard);
    }
    seenIds.add(localCard.id);
  }

  for (const incomingCard of incoming.cards) {
    if (seenIds.has(incomingCard.id)) continue;
    // Incoming only — trust server.
    mergedCards.push(incomingCard);
  }

  // ─── Threads ──────────────────────────────────────────────────────
  const incomingThreadById = new Map<string, Thread>();
  for (const t of incoming.threads) incomingThreadById.set(t.id, t);

  const mergedThreads: Thread[] = [];
  const seenThreadIds = new Set<string>();

  for (const localThread of local.threads) {
    if (incomingThreadById.has(localThread.id)) {
      mergedThreads.push(localThread); // identity by id; either record works
    } else {
      // Local only — trust local.
      mergedThreads.push(localThread);
    }
    seenThreadIds.add(localThread.id);
  }

  for (const incomingThread of incoming.threads) {
    if (seenThreadIds.has(incomingThread.id)) continue;
    // Incoming only — trust server.
    mergedThreads.push(incomingThread);
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
