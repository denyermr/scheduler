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
