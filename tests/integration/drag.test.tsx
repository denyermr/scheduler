import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import {
  addCard,
  addThread,
  createBoard,
} from '../../src/domain/board';
import type { Board, CardId, Day } from '../../src/domain/types';
import { InMemoryRepository } from '../../src/persistence/memory';
import {
  computeBoardMetrics,
  DRAG_LIFT_MS,
  DRAG_SNAP_MS,
} from '../../src/ui/tokens';

const SLUG = 'phase-4-drag-test';
const CONTAINER = 1440;
const METRICS = computeBoardMetrics(CONTAINER);
// Mocked bounding box for the board surface. Positioning the surface at
// (100, 100) gives us non-trivial offsets to verify cellAt math.
const SURFACE_LEFT = 100;
const SURFACE_TOP = 100;

function emptyBoard(): Board {
  return createBoard({ startMonday: '2024-05-27', weeks: 4 });
}

function makeClock(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 0;
    i += 1;
    return v;
  };
}

async function renderApp(board: Board, clockValues: number[] = [1000]): Promise<{
  repo: InMemoryRepository;
  saveSpy: ReturnType<typeof vi.spyOn>;
}> {
  const repo = new InMemoryRepository([[SLUG, board]]);
  const saveSpy = vi.spyOn(repo, 'save');
  render(
    <App
      repository={repo}
      slug={SLUG}
      clock={makeClock(clockValues)}
      containerWidth={CONTAINER}
    />,
  );
  await waitFor(() => {
    expect(screen.getByTestId('board-surface')).toBeInTheDocument();
  });

  // Mock the surface's bounding rect so cellAt math has a known origin.
  const surface = screen.getByTestId('board-surface');
  const W = METRICS.railW + 7 * METRICS.cellW;
  const H = METRICS.headerH + board.weeks * METRICS.cellH;
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    x: SURFACE_LEFT,
    y: SURFACE_TOP,
    left: SURFACE_LEFT,
    top: SURFACE_TOP,
    right: SURFACE_LEFT + W,
    bottom: SURFACE_TOP + H,
    width: W,
    height: H,
    toJSON: () => ({}),
  });

  // Switch to fake timers AFTER the initial load resolves — RTL's waitFor
  // polls via setInterval and won't run under fake timers.
  vi.useFakeTimers();

  return { repo, saveSpy };
}

function cardSlotFor(cardId: CardId): HTMLElement {
  const slot = document.querySelector(
    `[data-card-id="${cardId}"]`,
  ) as HTMLElement | null;
  if (!slot) throw new Error(`No card slot for id ${cardId}`);
  return slot;
}

function cellClientPx(week: number, day: Day): { x: number; y: number } {
  return {
    x:
      SURFACE_LEFT +
      METRICS.railW +
      day * METRICS.cellW +
      METRICS.cellW / 2,
    y:
      SURFACE_TOP +
      METRICS.headerH +
      week * METRICS.cellH +
      METRICS.cellH / 2,
  };
}

function seedCard(
  board: Board,
  week: number,
  day: Day,
  id: string,
  createdAt: number,
): { board: Board; id: CardId } {
  const r = addCard(board, {
    week,
    day,
    color: 'peach',
    text: id,
    newId: () => id,
    clock: () => createdAt,
  });
  return { board: r.board, id: r.cardId };
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

function advanceMs(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Phase 4 — workflow 02 (drag a card)', () => {
  it('step 4 — pointer-down for >= 80ms enters the lifted state (scale 1.05, rotation reset)', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_drag', 100);
    await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    // Before the lift threshold elapses, nothing transient-visible.
    expect(slot.getAttribute('data-dragging')).toBeNull();

    advanceMs(DRAG_LIFT_MS);

    expect(slot.getAttribute('data-dragging')).toBe('lifted');
    expect(slot.style.transform).toContain('scale(1.05)');
    expect(slot.style.transform).toContain('rotate(0deg)');
  });

  it('step 5 — pointer-up before 80ms is treated as a click (opens the popover)', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_tap', 100);
    await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS - 10);
    fireEvent.pointerUp(window, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    // Tap path falls through to the existing click handler that opens the popover.
    fireEvent.click(slot);

    expect(screen.getByTestId('edit-popover')).toBeInTheDocument();
  });

  it('step 6 — dragging over a cell highlights it as the drop target', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_drag', 100);
    await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);

    const target = cellClientPx(2, 3);
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const highlight = screen.getByTestId('drop-target-highlight');
    expect(highlight.getAttribute('data-target-week')).toBe('2');
    expect(highlight.getAttribute('data-target-day')).toBe('3');
  });

  it('step 7 — drop on an empty cell moves the card; one save fires; updatedAt is bumped', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_drag', 100);
    const { saveSpy } = await renderApp(seeded.board, [9999]);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);
    const target = cellClientPx(2, 3);
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    // Move is committed immediately; persistence is debounced.
    advanceMs(250);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const persisted = saveSpy.mock.calls[0]?.[1] as Board;
    expect(persisted.cards[0]?.week).toBe(2);
    expect(persisted.cards[0]?.day).toBe(3);
    expect(persisted.cards[0]?.updatedAt).toBe(9999);
  });

  it('step 8 — drop on the same cell is a no-op (no save)', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_drag', 100);
    const { saveSpy } = await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);
    fireEvent.pointerMove(window, {
      clientX: origin.x + 5,
      clientY: origin.y + 5,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: origin.x + 5,
      clientY: origin.y + 5,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    advanceMs(300);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('step 9 — dropping onto an already-occupied cell stacks both cards', async () => {
    let board = emptyBoard();
    const a = seedCard(board, 0, 0, 'card_a', 100);
    board = a.board;
    const b = seedCard(board, 1, 1, 'card_b', 101);
    board = b.board;
    const { saveSpy } = await renderApp(board);

    const slotB = cardSlotFor(b.id);
    const originB = cellClientPx(1, 1);

    fireEvent.pointerDown(slotB, {
      clientX: originB.x,
      clientY: originB.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);
    const target = cellClientPx(0, 0);
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(300);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const persisted = saveSpy.mock.calls[0]?.[1] as Board;
    const inTargetCell = persisted.cards.filter(
      (c) => c.week === 0 && c.day === 0,
    );
    expect(inTargetCell).toHaveLength(2);
    const aPersisted = inTargetCell.find((c) => c.id === 'card_a');
    const bPersisted = inTargetCell.find((c) => c.id === 'card_b');
    expect(aPersisted?.z).toBe(0);
    expect(bPersisted?.z).toBe(1);
  });

  it('step 10 — dropping into the Sunday column (day=6) works identically to weekdays', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_sun', 100);
    const { saveSpy } = await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);
    const target = cellClientPx(1, 6);
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(300);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const persisted = saveSpy.mock.calls[0]?.[1] as Board;
    expect(persisted.cards[0]?.day).toBe(6);
    expect(persisted.cards[0]?.week).toBe(1);
  });

  it('step 11 — while dragging, a thread anchored to the dragged card follows the pointer', async () => {
    let board = emptyBoard();
    const a = seedCard(board, 0, 0, 'card_anchor', 100);
    board = a.board;
    const b = seedCard(board, 2, 2, 'card_drag', 101);
    board = b.board;
    const t = addThread(board, {
      fromCardId: a.id,
      toCardId: b.id,
      newId: () => 'thread_live',
    });
    board = t.board;

    await renderApp(board);
    const slot = cardSlotFor(b.id);
    const origin = cellClientPx(2, 2);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);
    fireEvent.pointerMove(window, {
      clientX: origin.x + 80,
      clientY: origin.y + 30,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const path = document.querySelector(
      'path[data-thread-id="thread_live"]',
    );
    expect(path).not.toBeNull();
    const d = path?.getAttribute('d') ?? '';
    const match = /\s([\d.-]+)\s([\d.-]+)$/.exec(d);
    expect(match).not.toBeNull();
    const expectedEndX =
      METRICS.railW + 2 * METRICS.cellW + METRICS.cellW / 2 + 80;
    const expectedEndY =
      METRICS.headerH + 2 * METRICS.cellH + METRICS.cellH / 2 + 30;
    expect(Number(match?.[1])).toBeCloseTo(expectedEndX, 1);
    expect(Number(match?.[2])).toBeCloseTo(expectedEndY, 1);
  });

  it('step 12 — the dropped card carries a 120ms ease-out transition for the snap', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_drag', 100);
    await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(slot, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(DRAG_LIFT_MS);
    const target = cellClientPx(1, 2);
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    // After the drop, the card slot for the *new* position is in snap state.
    const moved = cardSlotFor(seeded.id);
    expect(moved.getAttribute('data-dragging')).toBe('snapping');
    expect(moved.style.transition).toContain(`${String(DRAG_SNAP_MS)}ms`);
    expect(moved.style.transition).toContain('ease-out');

    advanceMs(DRAG_SNAP_MS);
    expect(moved.getAttribute('data-dragging')).toBeNull();
  });

  it('step 13 — Cmd/Ctrl-click on a stacked cell cycles the visible top card', async () => {
    let board = emptyBoard();
    const a = seedCard(board, 0, 0, 'card_bot', 100);
    board = a.board;
    const b = seedCard(board, 0, 0, 'card_mid', 101);
    board = b.board;
    const c = seedCard(board, 0, 0, 'card_top', 102);
    board = c.board;
    const { saveSpy } = await renderApp(board, [1000, 2000]);

    // Initially card_top has the highest z (= 2). Cmd-click on the top card
    // promotes the bottom (card_bot) to be on top.
    const slotTop = cardSlotFor(c.id);

    fireEvent.click(slotTop, { metaKey: true });

    advanceMs(300);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const persisted = saveSpy.mock.calls[0]?.[1] as Board;
    const byId = Object.fromEntries(
      persisted.cards.map((card) => [card.id, card]),
    );
    expect(byId['card_bot']?.z).toBeGreaterThan(byId['card_mid']?.z ?? -1);
    expect(byId['card_bot']?.z).toBeGreaterThan(byId['card_top']?.z ?? -1);
  });
});
