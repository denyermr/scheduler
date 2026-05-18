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
import { computeBoardMetrics } from '../../src/ui/tokens';

const SLUG = 'phase-5-thread-test';
const CONTAINER = 1440;
const METRICS = computeBoardMetrics(CONTAINER);
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

async function renderApp(
  board: Board,
  clockValues: number[] = [1000],
): Promise<{
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

function seedThread(
  board: Board,
  fromCardId: CardId,
  toCardId: CardId,
  id: string,
): { board: Board; id: string } {
  const r = addThread(board, {
    fromCardId,
    toCardId,
    newId: () => id,
  });
  return { board: r.board, id: r.threadId };
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

describe('Phase 5 — workflow 03 (threads create / delete / follow)', () => {
  it('step 1 — hovering a card reveals the thread handle; pointer-leave hides it', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);

    // No handles visible before hover.
    expect(screen.queryAllByTestId('thread-handle')).toHaveLength(0);

    fireEvent.pointerEnter(slot, { pointerType: 'mouse' });

    const handle = screen.getByTestId('thread-handle');
    expect(handle.getAttribute('data-card-id')).toBe(seeded.id);

    fireEvent.pointerLeave(slot, { pointerType: 'mouse' });

    expect(screen.queryAllByTestId('thread-handle')).toHaveLength(0);
  });

  it('step 3 — releasing on a different card commits the thread; one save fires', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    const b = seedCard(a.board, 2, 3, 'card_tgt', 200);
    const { repo, saveSpy } = await renderApp(b.board);
    const slotA = cardSlotFor(a.id);
    fireEvent.pointerEnter(slotA, { pointerType: 'mouse' });
    const handle = screen.getByTestId('thread-handle');
    const origin = cellClientPx(0, 0);
    const target = cellClientPx(2, 3);

    fireEvent.pointerDown(handle, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
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

    // Commit is immediate; persistence is debounced.
    advanceMs(250);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const persisted = await repo.load(SLUG);
    expect(persisted?.threads).toHaveLength(1);
    expect(persisted?.threads[0]?.fromCardId).toBe(a.id);
    expect(persisted?.threads[0]?.toCardId).toBe(b.id);

    // Drawing arm cleaned up.
    expect(screen.queryByTestId('thread-drawing-path')).toBeNull();
  });

  it('step 4a — releasing on empty cork discards the in-progress thread; no save', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    const { repo, saveSpy } = await renderApp(a.board);
    const slotA = cardSlotFor(a.id);
    fireEvent.pointerEnter(slotA, { pointerType: 'mouse' });
    const handle = screen.getByTestId('thread-handle');
    const origin = cellClientPx(0, 0);
    // Aim somewhere on cork with no card under it.
    const empty = cellClientPx(3, 5);

    fireEvent.pointerDown(handle, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.pointerMove(window, {
      clientX: empty.x,
      clientY: empty.y,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: empty.x,
      clientY: empty.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    advanceMs(300);
    expect(saveSpy).not.toHaveBeenCalled();
    const persisted = await repo.load(SLUG);
    expect(persisted?.threads).toHaveLength(0);
    expect(screen.queryByTestId('thread-drawing-path')).toBeNull();
  });

  it('step 4b — releasing on the source card discards (no self-thread); no save', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    const { repo, saveSpy } = await renderApp(a.board);
    const slotA = cardSlotFor(a.id);
    fireEvent.pointerEnter(slotA, { pointerType: 'mouse' });
    const handle = screen.getByTestId('thread-handle');
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(handle, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    // Drag a tiny bit and release still over the source card.
    fireEvent.pointerMove(window, {
      clientX: origin.x + 4,
      clientY: origin.y + 3,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(window, {
      clientX: origin.x + 4,
      clientY: origin.y + 3,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    advanceMs(300);
    expect(saveSpy).not.toHaveBeenCalled();
    const persisted = await repo.load(SLUG);
    expect(persisted?.threads).toHaveLength(0);
  });

  it('target card highlights while drawing a thread over it', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    const b = seedCard(a.board, 2, 3, 'card_tgt', 200);
    await renderApp(b.board);
    const slotA = cardSlotFor(a.id);
    fireEvent.pointerEnter(slotA, { pointerType: 'mouse' });
    const handle = screen.getByTestId('thread-handle');
    const origin = cellClientPx(0, 0);
    const target = cellClientPx(2, 3);

    fireEvent.pointerDown(handle, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const slotB = cardSlotFor(b.id);
    expect(slotB.getAttribute('data-thread-target')).toBe('true');
    expect(slotA.getAttribute('data-thread-target')).toBeNull();

    // Pointer drifts to empty cork — highlight clears.
    const empty = cellClientPx(3, 5);
    fireEvent.pointerMove(window, {
      clientX: empty.x,
      clientY: empty.y,
      pointerId: 1,
      pointerType: 'mouse',
    });
    expect(slotB.getAttribute('data-thread-target')).toBeNull();
  });

  it('step 7 — deleting an endpoint card removes any thread referencing it (invariant 9)', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_a', 100);
    const b = seedCard(a.board, 2, 3, 'card_b', 200);
    const t = seedThread(b.board, a.id, b.id, 'thread_t');
    const { repo, saveSpy } = await renderApp(t.board);

    // Open the edit popover for card A and click Delete.
    fireEvent.click(cardSlotFor(a.id));
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    advanceMs(250);
    expect(saveSpy).toHaveBeenCalled();
    const persisted = await repo.load(SLUG);
    expect(persisted?.cards.find((c) => c.id === a.id)).toBeUndefined();
    expect(persisted?.threads).toHaveLength(0);
    expect(
      document.querySelector(`[data-thread-id="${t.id}"]`),
    ).toBeNull();
  });

  it('step 6 — clicking a thread flashes #d6463a for 100 ms then deletes it', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_a', 100);
    const b = seedCard(a.board, 2, 3, 'card_b', 200);
    const t = seedThread(b.board, a.id, b.id, 'thread_t');
    const { repo, saveSpy } = await renderApp(t.board);

    // Sanity: thread is visible at start.
    const visible = document.querySelector(
      `[data-thread-id="${t.id}"][data-testid="thread-path"]`,
    ) as SVGPathElement | null;
    expect(visible).not.toBeNull();

    const hit = document.querySelector(
      `[data-thread-id="${t.id}"][data-testid="thread-hit"]`,
    ) as SVGPathElement | null;
    expect(hit).not.toBeNull();

    fireEvent.click(hit!);

    // During the flash window, the thread stroke is the delete-flash color.
    const flashing = document.querySelector(
      `[data-thread-id="${t.id}"][data-testid="thread-path"]`,
    ) as SVGPathElement | null;
    expect(flashing?.getAttribute('stroke')).toBe('#d6463a');

    // Before the flash elapses, the thread is still in the persisted board.
    advanceMs(99);
    expect(saveSpy).not.toHaveBeenCalled();

    advanceMs(1);
    // Debounce.
    advanceMs(250);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const persisted = await repo.load(SLUG);
    expect(persisted?.threads).toHaveLength(0);
    expect(
      document.querySelector(
        `[data-thread-id="${t.id}"][data-testid="thread-path"]`,
      ),
    ).toBeNull();
  });

  it('step 5 — Escape during thread-drawing cancels (no thread; drawing path gone)', async () => {
    const a = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    const b = seedCard(a.board, 2, 3, 'card_tgt', 200);
    const { saveSpy } = await renderApp(b.board);
    const slotA = cardSlotFor(a.id);
    fireEvent.pointerEnter(slotA, { pointerType: 'mouse' });
    const handle = screen.getByTestId('thread-handle');
    const origin = cellClientPx(0, 0);
    const target = cellClientPx(2, 3);

    fireEvent.pointerDown(handle, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.pointerMove(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(screen.getByTestId('thread-drawing-path')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('thread-drawing-path')).toBeNull();

    // Even if a stray pointerup arrives after Esc, no thread should commit.
    fireEvent.pointerUp(window, {
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    advanceMs(300);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('step 2 — pointerdown on the handle + pointer-move opens a dashed in-progress path', async () => {
    const seeded = seedCard(emptyBoard(), 0, 0, 'card_src', 100);
    await renderApp(seeded.board);
    const slot = cardSlotFor(seeded.id);
    fireEvent.pointerEnter(slot, { pointerType: 'mouse' });
    const handle = screen.getByTestId('thread-handle');
    const origin = cellClientPx(0, 0);

    fireEvent.pointerDown(handle, {
      clientX: origin.x,
      clientY: origin.y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    // Until the pointer moves, the in-progress path is not yet rendered —
    // a click on the handle alone should not create a stray dashed line.
    expect(screen.queryByTestId('thread-drawing-path')).toBeNull();

    fireEvent.pointerMove(window, {
      clientX: origin.x + 120,
      clientY: origin.y + 80,
      pointerId: 1,
      pointerType: 'mouse',
    });

    const path = screen.getByTestId('thread-drawing-path');
    expect(path.getAttribute('stroke-dasharray')).not.toBeNull();
    // The path starts at the source card's centre and ends at the pointer's
    // surface-local coordinates. cellAt(0,0) centre is `railW + cellW/2`,
    // `headerH + cellH/2`. The pointer is offset by (+120, +80) from that
    // in client space, which after subtracting the surface origin lands at
    // the same offset in surface space.
    const d = path.getAttribute('d') ?? '';
    expect(d).toMatch(/^M /);
    // First point should be the source-card centre in surface coords.
    const startX = METRICS.railW + METRICS.cellW / 2;
    const startY = METRICS.headerH + METRICS.cellH / 2;
    expect(d).toContain(`M ${String(startX)} ${String(startY)}`);
    // End point should be the source centre + (120, 80).
    expect(d).toContain(`${String(startX + 120)} ${String(startY + 80)}`);
  });
});
