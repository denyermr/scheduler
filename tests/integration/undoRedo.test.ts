import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCard, addThread, createBoard } from '../../src/domain/board';
import type { Board, CardId, Day, ThreadId } from '../../src/domain/types';
import { InMemoryRepository } from '../../src/persistence/memory';
import { useBoardEditor } from '../../src/state/useBoardEditor';

const SLUG = 'phase-6-undo-redo';

function emptyBoard(): Board {
  return createBoard({ startMonday: '2024-05-27', weeks: 6 });
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
  repo: InMemoryRepository;
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
  // Initial load is async; flush microtasks.
  await act(async () => {
    await Promise.resolve();
  });
  return { result: hook.result, saveSpy, repo, unmount: hook.unmount };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seedTwoCards(board: Board): {
  board: Board;
  a: CardId;
  b: CardId;
} {
  const r1 = addCard(board, {
    week: 0,
    day: 0 as Day,
    color: 'peach',
    text: 'A',
    newId: () => 'card_A',
    clock: () => 100,
  });
  const r2 = addCard(r1.board, {
    week: 1,
    day: 2 as Day,
    color: 'peach',
    text: 'B',
    newId: () => 'card_B',
    clock: () => 200,
  });
  return { board: r2.board, a: r1.cardId, b: r2.cardId };
}

describe('Phase 6 — useBoardEditor snapshot / undo / redo / select / nudge / resize', () => {
  it('step 1 — every mutating action produces one undo step (add, edit, move, thread create, delete)', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    expect(result.current.canUndo).toBe(false);

    // 1. Add: create a brand-new card via the editing flow.
    act(() => {
      result.current.beginNew(2, 1);
    });
    act(() => {
      result.current.setEditingText('hello');
    });
    act(() => {
      result.current.commitEdit();
    });
    expect(result.current.canUndo).toBe(true);
    // 2. Edit: change text on an existing card.
    act(() => {
      result.current.beginEdit(seed.a);
    });
    act(() => {
      result.current.setEditingText('A2');
    });
    act(() => {
      result.current.commitEdit();
    });
    // 3. Move
    act(() => {
      result.current.moveCardTo(seed.b, 3, 4);
    });
    // 4. Thread create
    act(() => {
      result.current.createThread(seed.a, seed.b);
    });
    // 5. Delete (via popover delete)
    act(() => {
      result.current.beginEdit(seed.a);
    });
    act(() => {
      result.current.deleteEditing();
    });

    // 5 actions → 5 undo entries.
    expect(result.current.undoStackSize).toBe(5);
    expect(result.current.canRedo).toBe(false);
  });

  it('step 1b — typing in the popover does NOT produce one snapshot per keystroke', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    act(() => {
      result.current.beginEdit(seed.a);
    });
    for (const ch of 'abcdefgh') {
      act(() => {
        result.current.setEditingText(`A2-${ch}`);
      });
    }
    act(() => {
      result.current.commitEdit();
    });

    expect(result.current.undoStackSize).toBe(1);
  });

  it('step 1c — cancelling an edit leaves the stack unchanged (cancel reverts in-place)', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    // First, a real mutation so the stack has one entry.
    act(() => {
      result.current.moveCardTo(seed.b, 3, 4);
    });
    expect(result.current.undoStackSize).toBe(1);

    // Begin editing, type, then cancel — net no-op.
    act(() => {
      result.current.beginEdit(seed.a);
    });
    act(() => {
      result.current.setEditingText('throwaway');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(result.current.undoStackSize).toBe(1);
    expect(result.current.board?.cards.find((c) => c.id === seed.a)?.text).toBe('A');
  });

  it('step 1d — cancelling a beginNew (Esc on a new card) leaves the stack unchanged', async () => {
    const { result } = await mountEditor(emptyBoard());

    act(() => {
      result.current.beginNew(0, 0);
    });
    act(() => {
      result.current.setEditingText('throwaway');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(result.current.undoStackSize).toBe(0);
    expect(result.current.board?.cards).toHaveLength(0);
  });

  it('step 2 — undo reverts the last action', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    act(() => {
      result.current.moveCardTo(seed.b, 3, 4);
    });
    expect(result.current.board?.cards.find((c) => c.id === seed.b)?.week).toBe(3);
    act(() => {
      result.current.undo();
    });
    expect(result.current.board?.cards.find((c) => c.id === seed.b)?.week).toBe(1);
    expect(result.current.canRedo).toBe(true);
  });

  it('step 3 — redo re-applies; a fresh mutation clears the redo stack', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    act(() => {
      result.current.moveCardTo(seed.b, 3, 4);
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.redo();
    });
    expect(result.current.board?.cards.find((c) => c.id === seed.b)?.week).toBe(3);
    expect(result.current.canRedo).toBe(false);

    // Undo once more, then a fresh mutation should clear redo.
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.moveCardTo(seed.a, 2, 2);
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('step 4 — undo stack is capped at 50; oldest snapshot dropped', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    // 60 alternating moves on card B between two cells.
    for (let i = 0; i < 60; i++) {
      const week = i % 2 === 0 ? 1 : 2;
      const day = (i % 7) as Day;
      act(() => {
        result.current.moveCardTo(seed.b, week, day);
      });
    }

    // 60 pushes capped at 50 — undo stack must report 50.
    expect(result.current.undoStackSize).toBe(50);
  });

  it('arrow nudge — moves selected card by one cell, clamped at edges, one undo step per call', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    act(() => {
      result.current.selectCard(seed.a);
    });
    // Card A is at (week=0, day=0). Nudge up clamps — stays at week=0.
    act(() => {
      result.current.nudgeSelected('up');
    });
    expect(result.current.board?.cards.find((c) => c.id === seed.a)?.week).toBe(0);
    expect(result.current.undoStackSize).toBe(0);

    act(() => {
      result.current.nudgeSelected('right');
    });
    expect(result.current.board?.cards.find((c) => c.id === seed.a)?.day).toBe(1);
    expect(result.current.undoStackSize).toBe(1);

    act(() => {
      result.current.nudgeSelected('down');
    });
    const cA = result.current.board?.cards.find((c) => c.id === seed.a);
    expect(cA?.week).toBe(1);
    expect(cA?.day).toBe(1);
    expect(result.current.undoStackSize).toBe(2);

    act(() => {
      result.current.nudgeSelected('left');
    });
    expect(result.current.board?.cards.find((c) => c.id === seed.a)?.day).toBe(0);
    expect(result.current.undoStackSize).toBe(3);
  });

  it('arrow nudge — bumps updatedAt and triggers one save per keypress', async () => {
    vi.useFakeTimers();
    const seed = seedTwoCards(emptyBoard());
    const { result, saveSpy } = await mountEditor(seed.board);

    act(() => {
      result.current.selectCard(seed.a);
    });
    const beforeUpdated = result.current.board?.cards.find((c) => c.id === seed.a)
      ?.updatedAt;

    act(() => {
      result.current.nudgeSelected('right');
    });
    const afterUpdated = result.current.board?.cards.find((c) => c.id === seed.a)
      ?.updatedAt;
    expect(afterUpdated ?? 0).toBeGreaterThan(beforeUpdated ?? 0);

    // Debounced save fires once for the single nudge.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('deleteSelected — removes the selected card, one undo step, clears selection', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    act(() => {
      result.current.selectCard(seed.a);
    });
    expect(result.current.selectedCardId).toBe(seed.a);

    act(() => {
      result.current.deleteSelected();
    });

    expect(result.current.board?.cards.some((c) => c.id === seed.a)).toBe(false);
    expect(result.current.selectedCardId).toBeNull();
    expect(result.current.undoStackSize).toBe(1);
  });

  it('resizeBoard — shrinking with no cut-off cards commits immediately, one undo step', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    act(() => {
      result.current.requestResize(5);
    });
    expect(result.current.board?.weeks).toBe(5);
    expect(result.current.pendingResize).toBeNull();
    expect(result.current.undoStackSize).toBe(1);
  });

  it('resizeBoard — shrinking that would cut cards sets pendingResize; cancel reverts without mutation', async () => {
    const seed = seedTwoCards(emptyBoard());
    // Add a card on the LAST week.
    const tail = addCard(seed.board, {
      week: 5,
      day: 0 as Day,
      color: 'peach',
      text: 'tail',
      newId: () => 'card_tail',
      clock: () => 300,
    });
    const { result } = await mountEditor(tail.board);

    act(() => {
      result.current.requestResize(4);
    });

    // No mutation yet.
    expect(result.current.board?.weeks).toBe(6);
    expect(result.current.pendingResize).not.toBeNull();
    expect(result.current.pendingResize?.weeks).toBe(4);
    expect(result.current.pendingResize?.cutCardIds).toContain('card_tail');
    expect(result.current.undoStackSize).toBe(0);

    act(() => {
      result.current.cancelPendingResize();
    });
    expect(result.current.pendingResize).toBeNull();
    expect(result.current.board?.weeks).toBe(6);
    expect(result.current.undoStackSize).toBe(0);
  });

  it('resizeBoard — confirm commits the shrink; off-board card preserved and restored on regrow', async () => {
    const seed = seedTwoCards(emptyBoard());
    const tail = addCard(seed.board, {
      week: 5,
      day: 0 as Day,
      color: 'peach',
      text: 'tail',
      newId: () => 'card_tail',
      clock: () => 300,
    });
    const { result } = await mountEditor(tail.board);

    act(() => {
      result.current.requestResize(4);
    });
    act(() => {
      result.current.confirmPendingResize();
    });

    expect(result.current.board?.weeks).toBe(4);
    expect(result.current.pendingResize).toBeNull();
    // Card is preserved in the model but off-board (week >= weeks).
    expect(result.current.board?.cards.some((c) => c.id === 'card_tail')).toBe(true);
    expect(result.current.undoStackSize).toBe(1);

    // Regrow restores the card to on-board.
    act(() => {
      result.current.requestResize(6);
    });
    expect(result.current.board?.weeks).toBe(6);
    expect(
      result.current.board?.cards.find((c) => c.id === 'card_tail')?.week,
    ).toBe(5);
  });

  it('selectCard / clearSelection — drives selectedCardId state', async () => {
    const seed = seedTwoCards(emptyBoard());
    const { result } = await mountEditor(seed.board);

    expect(result.current.selectedCardId).toBeNull();
    act(() => {
      result.current.selectCard(seed.a);
    });
    expect(result.current.selectedCardId).toBe(seed.a);
    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedCardId).toBeNull();
  });

  it('undo restores threads (thread-create / thread-delete are undoable)', async () => {
    const seed = seedTwoCards(emptyBoard());
    const seeded = addThread(seed.board, {
      fromCardId: seed.a,
      toCardId: seed.b,
      newId: () => 'thread_AB',
    });
    const { result } = await mountEditor(seeded.board);

    act(() => {
      result.current.deleteThreadById('thread_AB' as ThreadId);
    });
    expect(result.current.board?.threads).toHaveLength(0);

    act(() => {
      result.current.undo();
    });
    expect(result.current.board?.threads).toHaveLength(1);
    expect(result.current.board?.threads[0]?.id).toBe('thread_AB');
  });
});
