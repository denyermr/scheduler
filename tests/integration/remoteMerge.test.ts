import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCard, createBoard } from '../../src/domain/board';
import type { Board, CardId, Day } from '../../src/domain/types';
import { InMemoryRepository } from '../../src/persistence/memory';
import { useBoardEditor } from '../../src/state/useBoardEditor';

const SLUG = 'phase-7-remote-merge';

function emptyBoard(): Board {
  return createBoard({ startMonday: '2024-05-27', weeks: 4 });
}

function makeClock(): () => number {
  let t = 1000;
  return () => {
    t += 1;
    return t;
  };
}

async function mountEditor(board: Board): Promise<{
  result: { current: ReturnType<typeof useBoardEditor> };
  saveSpy: ReturnType<typeof vi.spyOn>;
  unmount: () => void;
}> {
  const repo = new InMemoryRepository([[SLUG, board]]);
  const saveSpy = vi.spyOn(repo, 'save');
  const hook = renderHook(() =>
    useBoardEditor({
      repository: repo,
      slug: SLUG,
      clock: makeClock(),
      debounceMs: 250,
    }),
  );
  await act(async () => {
    await Promise.resolve();
  });
  return { result: hook.result, saveSpy, unmount: hook.unmount };
}

function seedOneCard(board: Board): { board: Board; id: CardId } {
  const r = addCard(board, {
    week: 0,
    day: 0 as Day,
    color: 'peach',
    text: 'original',
    newId: () => 'card_seed',
    clock: () => 100,
  });
  return { board: r.board, id: r.cardId };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useBoardEditor.commitFromRemote — poll merges do not enter undo', () => {
  it('incoming card CHANGE: text updates, undo stack is unchanged, no save scheduled', async () => {
    const seed = seedOneCard(emptyBoard());
    const { result, saveSpy } = await mountEditor(seed.board);

    // Establish a baseline of "no undo, no saves yet".
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoStackSize).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();

    // Simulate a poll that returns the same board with the card's text changed
    // (someone else's edit).
    const incoming: Board = {
      ...result.current.board!,
      cards: result.current.board!.cards.map((c) =>
        c.id === seed.id ? { ...c, text: 'updated by another tab', updatedAt: 5000 } : c,
      ),
    };

    act(() => {
      result.current.commitFromRemote(incoming);
    });

    // The board reflects the incoming change.
    const updated = result.current.board?.cards.find((c) => c.id === seed.id);
    expect(updated?.text).toBe('updated by another tab');

    // Undo stack is unchanged — Cmd-Z must NOT roll back another user's edit.
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoStackSize).toBe(0);

    // The merge result is already on the server; no need to PATCH it back.
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('incoming card DELETE: card removed, undo stack is unchanged, no save scheduled', async () => {
    const seed = seedOneCard(emptyBoard());
    const { result, saveSpy } = await mountEditor(seed.board);

    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoStackSize).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();

    // Simulate a poll where the card was deleted server-side.
    const incoming: Board = {
      ...result.current.board!,
      cards: result.current.board!.cards.filter((c) => c.id !== seed.id),
    };

    act(() => {
      result.current.commitFromRemote(incoming);
    });

    expect(result.current.board?.cards.find((c) => c.id === seed.id)).toBeUndefined();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoStackSize).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('mergeIncoming: incoming card added; existing local card kept (LWW); no undo entry', async () => {
    const seed = seedOneCard(emptyBoard());
    const { result } = await mountEditor(seed.board);

    expect(result.current.canUndo).toBe(false);

    // Incoming board has a brand-new card we haven't seen, AND a stale copy
    // of our seed card (older updatedAt → local wins).
    const incoming: Board = {
      ...result.current.board!,
      cards: [
        ...result.current.board!.cards.map((c) =>
          c.id === seed.id ? { ...c, updatedAt: 50 } : c, // older than local
        ),
        {
          id: 'remote_card',
          week: 1,
          day: 2 as Day,
          color: 'sky' as const,
          text: 'from another tab',
          rotation: 0,
          pin: '#3a7ed6' as const,
          createdAt: 5000,
          updatedAt: 5000,
          z: 0,
        },
      ],
    };

    act(() => {
      result.current.mergeIncoming(incoming, 5000);
    });

    const ids = result.current.board?.cards.map((c) => c.id).sort();
    expect(ids).toEqual(['card_seed', 'remote_card']);
    // The local card kept its identity (we passed an older updatedAt for it
    // in incoming, so LWW picks local).
    const seedCard = result.current.board?.cards.find((c) => c.id === seed.id);
    expect(seedCard?.text).toBe('original');
    // The merge MUST NOT enter the undo stack.
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoStackSize).toBe(0);
  });

  it('mergeIncoming: if a save is queued, the pending board is updated to include merge result', async () => {
    // Scenario: user mutates locally (save queued), then a poll arrives that
    // adds someone else's card. The merge folds in the remote add. When the
    // queued save fires, it MUST PATCH the merged board (not the pre-merge
    // local) — otherwise the remote add gets clobbered server-side.
    const seed = seedOneCard(emptyBoard());
    const { result, saveSpy } = await mountEditor(seed.board);

    // Local mutation: move the card. This queues a save.
    act(() => {
      result.current.moveCardTo(seed.id, 2, 3 as Day);
    });
    expect(saveSpy).not.toHaveBeenCalled(); // not yet — debounced

    // Poll arrives with a new remote card before our save fires.
    const incoming: Board = {
      ...result.current.board!,
      cards: [
        ...result.current.board!.cards,
        {
          id: 'remote_card',
          week: 0,
          day: 6 as Day,
          color: 'mint' as const,
          text: 'concurrent add',
          rotation: 0,
          pin: '#3aa15a' as const,
          createdAt: 6000,
          updatedAt: 6000,
          z: 0,
        },
      ],
    };
    act(() => {
      result.current.mergeIncoming(incoming, 6000);
    });

    // Wait for the debounce timer (250ms) to fire the save.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // The save MUST have been called with the MERGED board (containing both
    // the moved seed card AND the remote_card) — not the pre-merge local
    // (which lacked remote_card).
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const savedBoard = saveSpy.mock.calls[0]?.[1] as Board;
    const savedIds = savedBoard.cards.map((c) => c.id).sort();
    expect(savedIds).toEqual(['card_seed', 'remote_card']);
  });

  it('a remote merge after a local mutation preserves the local mutation in undo', async () => {
    // Setup: a local mutation puts something on the undo stack. A subsequent
    // remote merge MUST NOT pop / push anything that disturbs that snapshot.
    const seed = seedOneCard(emptyBoard());
    const { result } = await mountEditor(seed.board);

    // Local mutation: move the card. This pushes one undo snapshot.
    act(() => {
      result.current.moveCardTo(seed.id, 2, 3 as Day);
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoStackSize).toBe(1);

    // Now a poll arrives changing the card's color (someone else recolored).
    const incoming: Board = {
      ...result.current.board!,
      cards: result.current.board!.cards.map((c) =>
        c.id === seed.id ? { ...c, color: 'sky' as const, updatedAt: 9000 } : c,
      ),
    };

    act(() => {
      result.current.commitFromRemote(incoming);
    });

    // The merge applied (color updated)…
    const merged = result.current.board?.cards.find((c) => c.id === seed.id);
    expect(merged?.color).toBe('sky');
    // …but the undo stack still has exactly the one local snapshot from the
    // move. A second Cmd-Z would have nothing to revert.
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoStackSize).toBe(1);
  });
});
