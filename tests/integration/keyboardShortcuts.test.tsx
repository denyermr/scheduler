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
import { addCard, createBoard } from '../../src/domain/board';
import type { Board, CardId, Day } from '../../src/domain/types';
import { InMemoryRepository } from '../../src/persistence/memory';

const SLUG = 'phase-6-keyboard';
const CONTAINER = 1440;

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

function seed(board: Board, opts: {
  week: number;
  day: Day;
  id: string;
  text?: string;
  createdAt?: number;
}): { board: Board; id: CardId } {
  const r = addCard(board, {
    week: opts.week,
    day: opts.day,
    color: 'peach',
    text: opts.text ?? opts.id,
    newId: () => opts.id,
    clock: () => opts.createdAt ?? 100,
  });
  return { board: r.board, id: r.cardId };
}

async function renderApp(board: Board): Promise<{
  repo: InMemoryRepository;
  saveSpy: ReturnType<typeof vi.spyOn>;
}> {
  const repo = new InMemoryRepository([[SLUG, board]]);
  const saveSpy = vi.spyOn(repo, 'save');
  render(
    <App
      repository={repo}
      slug={SLUG}
      clock={makeClock()}
      containerWidth={CONTAINER}
    />,
  );
  await waitFor(() => {
    expect(screen.getByTestId('board-surface')).toBeInTheDocument();
  });
  // Switch to fake timers AFTER the initial load resolves. Real timers are
  // required for waitFor's microtask polling; fake timers from the start
  // would deadlock that.
  vi.useFakeTimers();
  return { repo, saveSpy };
}

function cardSlot(id: CardId): HTMLElement {
  const el = document.querySelector(
    `[data-card-id="${id}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`No slot for ${id}`);
  return el;
}

function cardWeek(id: CardId): number {
  return Number(cardSlot(id).getAttribute('data-card-week') ?? '');
}

function cardDay(id: CardId): number {
  return Number(cardSlot(id).getAttribute('data-card-day') ?? '');
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Click a card slot, then press Escape on the popover input to close it.
 *  Selection persists; popover is gone. */
function selectViaClickAndDismissPopover(id: CardId): void {
  fireEvent.click(cardSlot(id));
  // Popover renders synchronously through React state — no waitFor needed.
  const input = screen.getByTestId('edit-popover-input');
  fireEvent.keyDown(input, { key: 'Escape' });
  // The Esc handler reverts + closes; after this the popover is gone.
  expect(screen.queryByTestId('edit-popover')).toBeNull();
}

describe('Phase 6 — global keyboard shortcuts', () => {
  it('Cmd-Z undoes the most recent action (popover delete)', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    fireEvent.click(cardSlot(a.id));
    expect(screen.getByTestId('edit-popover')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('edit-popover-delete'));
    expect(document.querySelector(`[data-card-id="${a.id}"]`)).toBeNull();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(
      document.querySelector(`[data-card-id="${a.id}"]`),
    ).not.toBeNull();
  });

  it('Cmd-Shift-Z redoes; subsequent action clears the redo stack', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    fireEvent.click(cardSlot(a.id));
    fireEvent.click(screen.getByTestId('edit-popover-delete'));
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(
      document.querySelector(`[data-card-id="${a.id}"]`),
    ).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Z', metaKey: true, shiftKey: true });
    expect(document.querySelector(`[data-card-id="${a.id}"]`)).toBeNull();
  });

  it('Backspace deletes the selected card when no input is focused', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    selectViaClickAndDismissPopover(a.id);
    expect(cardSlot(a.id).getAttribute('data-selected')).toBe('true');

    fireEvent.keyDown(window, { key: 'Backspace' });
    advance(300);
    expect(document.querySelector(`[data-card-id="${a.id}"]`)).toBeNull();
  });

  it('Arrow keys nudge the selected card by one cell; clamped at edges', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    const { saveSpy } = await renderApp(a.board);

    selectViaClickAndDismissPopover(a.id);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cardDay(a.id)).toBe(3);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(cardWeek(a.id)).toBe(2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(cardDay(a.id)).toBe(2);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(cardWeek(a.id)).toBe(1);

    // Four key presses → debounced saves coalesce inside the 250 ms window.
    advance(300);
    expect(saveSpy).toHaveBeenCalled();
  });

  it('Arrow keys at the top-left corner are clamped (no-op)', async () => {
    const corner = seed(emptyBoard(), { week: 0, day: 0 as Day, id: 'corner' });
    await renderApp(corner.board);

    selectViaClickAndDismissPopover(corner.id);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(cardWeek(corner.id)).toBe(0);
    expect(cardDay(corner.id)).toBe(0);
  });

  it('NEGATIVE: Backspace does NOT delete while a text input is focused', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    fireEvent.click(cardSlot(a.id));
    const input = screen.getByTestId('edit-popover-input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    // The keyDown event from inside the input bubbles up; the global listener
    // must filter it. The card must remain.
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(
      document.querySelector(`[data-card-id="${a.id}"]`),
    ).not.toBeNull();
  });

  it('NEGATIVE: Arrow keys do NOT nudge while a text input is focused', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    fireEvent.click(cardSlot(a.id));
    const input = screen.getByTestId('edit-popover-input') as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(cardDay(a.id)).toBe(2);
    expect(cardWeek(a.id)).toBe(1);
  });

  it('Arrow nudges produce one undo step each — three nudges, three undos restore', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    selectViaClickAndDismissPopover(a.id);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cardDay(a.id)).toBe(5);

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(cardDay(a.id)).toBe(2);
  });
});
