import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { App } from '../../src/App';
import { addCard, createBoard } from '../../src/domain/board';
import type { Board, CardId } from '../../src/domain/types';
import { InMemoryRepository } from '../../src/persistence/memory';
import { DEFAULT_DEBOUNCE_MS } from '../../src/state/useBoardEditor';

const SLUG = 'phase-3-test';

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
  options: { board?: Board; clock?: () => number; debounceMs?: number } = {},
) {
  const repo = new InMemoryRepository([[SLUG, options.board ?? emptyBoard()]]);
  const saveSpy = vi.spyOn(repo, 'save');
  render(
    <App
      repository={repo}
      slug={SLUG}
      clock={options.clock ?? (() => 1700)}
      debounceMs={options.debounceMs}
    />,
  );
  await waitFor(() => {
    expect(screen.getByTestId('board-surface')).toBeInTheDocument();
  });
  return { repo, saveSpy };
}

function clickCell(week: number, day: number): void {
  fireEvent.click(screen.getByTestId(`cell-${String(week)}-${String(day)}`));
}

function getInput(): HTMLInputElement {
  return screen.getByTestId('edit-popover-input') as HTMLInputElement;
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Phase 3 — workflow 01 (add card)', () => {
  it('step 4 — clicking an empty cell mounts the popover, focuses the input, and adds an optimistic card', async () => {
    await renderApp();

    expect(screen.queryByTestId('edit-popover')).toBeNull();
    expect(screen.queryAllByTestId('card')).toHaveLength(0);

    clickCell(0, 0);

    const popover = screen.getByTestId('edit-popover');
    expect(popover).toBeInTheDocument();
    const input = within(popover).getByTestId(
      'edit-popover-input',
    ) as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input.value).toBe('');
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    // The optimistic card uses the default peach fill.
    expect(screen.getByTestId('card').style.background).toContain(
      'rgb(244, 181, 132)',
    );
  });

  it('step 5 — typing updates the rendered card live', async () => {
    await renderApp();
    clickCell(0, 0);
    const input = getInput();

    fireEvent.change(input, { target: { value: 'Dress + light' } });

    expect(input.value).toBe('Dress + light');
    expect(screen.getByTestId('card')).toHaveTextContent('Dress + light');
  });

  it('step 6 — Enter commits, closes the popover, and the repository sees one save after the 250ms debounce', async () => {
    const { saveSpy } = await renderApp();
    clickCell(0, 0);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'Dress + light' } });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('edit-popover')).toBeNull();

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 },
    );
    const [, persisted] = saveSpy.mock.calls[0]!;
    expect(persisted.cards).toHaveLength(1);
    expect(persisted.cards[0]?.text).toBe('Dress + light');
  });

  it('step 6 — the 250ms debounce window is exact (quality gate)', async () => {
    const { saveSpy } = await renderApp();

    vi.useFakeTimers();
    clickCell(0, 0);
    fireEvent.change(getInput(), { target: { value: 'x' } });

    vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS - 1);
    expect(saveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('step 7 — Esc on a newly created card removes it, and the repository sees no write', async () => {
    const { saveSpy } = await renderApp();
    clickCell(0, 0);
    fireEvent.change(getInput(), { target: { value: 'partial' } });

    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(screen.queryByTestId('edit-popover')).toBeNull();
    expect(screen.queryAllByTestId('card')).toHaveLength(0);

    // Wait beyond the debounce window to confirm no save fires.
    await new Promise((r) => setTimeout(r, DEFAULT_DEBOUNCE_MS + 50));
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('step 8 — typing all-caps switches the rendered font to Permanent Marker', async () => {
    await renderApp();
    clickCell(0, 0);
    const input = getInput();

    fireEvent.change(input, { target: { value: 'block' } });
    let card = screen.getByTestId('card');
    expect(card.style.fontFamily).toContain('Caveat');

    fireEvent.change(input, { target: { value: 'BLOCK' } });
    card = screen.getByTestId('card');
    expect(card.style.fontFamily).toContain('Permanent Marker');
  });

  it('step 13 — Sat (day=5) and Sun (day=6) cells are clickable and editable', async () => {
    const { saveSpy } = await renderApp();

    clickCell(0, 5);
    let input = getInput();
    fireEvent.change(input, { target: { value: 'OFF' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 },
    );

    clickCell(0, 6);
    input = getInput();
    fireEvent.change(input, { target: { value: 'Holiday' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalledTimes(2);
      },
      { timeout: 1000 },
    );

    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(2);
    const texts = cards.map((c) => c.textContent);
    expect(texts).toContain('OFF');
    expect(texts).toContain('Holiday');
  });
});

describe('Phase 3 — workflow 04 (edit / recolor / delete existing card)', () => {
  function seededBoardWithOneCard(): { board: Board; cardId: CardId } {
    let b = emptyBoard();
    const r = addCard(b, {
      week: 1,
      day: 2,
      color: 'peach',
      text: 'BLOCK',
      newId: () => 'card_seed',
      clock: () => 100,
    });
    b = r.board;
    return { board: b, cardId: r.cardId };
  }

  it('step 9 — clicking an existing card opens the popover with text pre-filled', async () => {
    const { board } = seededBoardWithOneCard();
    await renderApp({ board });

    fireEvent.click(screen.getByTestId('card-slot'));

    const input = getInput();
    expect(input.value).toBe('BLOCK');
  });

  it('step 10 — clicking a swatch updates the rendered color and the repository', async () => {
    const { board } = seededBoardWithOneCard();
    const { saveSpy } = await renderApp({ board });

    fireEvent.click(screen.getByTestId('card-slot'));
    fireEvent.click(screen.getByTestId('swatch-coral'));

    const card = screen.getByTestId('card');
    expect(card.style.background).toContain('rgb(242, 107, 134)'); // coral

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
    const persisted = saveSpy.mock.calls.at(-1)![1];
    expect(persisted.cards[0]?.color).toBe('coral');
  });

  it('step 11 — Delete removes the card from the DOM and from the repository', async () => {
    const { board } = seededBoardWithOneCard();
    const { saveSpy } = await renderApp({ board });

    fireEvent.click(screen.getByTestId('card-slot'));
    fireEvent.click(screen.getByTestId('edit-popover-delete'));

    expect(screen.queryAllByTestId('card')).toHaveLength(0);
    expect(screen.queryByTestId('edit-popover')).toBeNull();

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
    const persisted = saveSpy.mock.calls.at(-1)![1];
    expect(persisted.cards).toHaveLength(0);
  });

  it('step 11 — Delete also drops any thread referencing the card (invariant 9)', async () => {
    let b = emptyBoard();
    const a = addCard(b, {
      week: 0,
      day: 0,
      color: 'peach',
      text: 'A',
      newId: () => 'card_a',
      clock: () => 1,
    });
    b = a.board;
    const c = addCard(b, {
      week: 2,
      day: 2,
      color: 'sky',
      text: 'B',
      newId: () => 'card_b',
      clock: () => 2,
    });
    b = c.board;
    const withThread: Board = {
      ...b,
      threads: [
        { id: 'thread_x', fromCardId: 'card_a', toCardId: 'card_b' },
      ],
    };

    const { saveSpy } = await renderApp({ board: withThread });

    const slot = screen
      .getAllByTestId('card-slot')
      .find((el) => el.dataset.cardId === 'card_a');
    expect(slot).toBeDefined();
    fireEvent.click(slot!);
    fireEvent.click(screen.getByTestId('edit-popover-delete'));

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
    const persisted = saveSpy.mock.calls.at(-1)![1];
    expect(persisted.cards.map((c2) => c2.id)).toEqual(['card_b']);
    expect(persisted.threads).toHaveLength(0);
  });

  it('step 12 — rotation and pin are unchanged after edit and recolor (invariant 6)', async () => {
    const { board } = seededBoardWithOneCard();
    const originalCard = board.cards[0]!;
    const originalRotation = originalCard.rotation;
    const originalPin = originalCard.pin;
    const { saveSpy } = await renderApp({
      board,
      clock: makeClock([500, 700, 900]),
    });

    fireEvent.click(screen.getByTestId('card-slot'));
    fireEvent.change(getInput(), { target: { value: 'BUILD' } });
    fireEvent.click(screen.getByTestId('swatch-mint'));

    await waitFor(
      () => {
        expect(saveSpy).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
    const persisted = saveSpy.mock.calls.at(-1)![1];
    expect(persisted.cards[0]?.rotation).toBe(originalRotation);
    expect(persisted.cards[0]?.pin).toBe(originalPin);
    expect(persisted.cards[0]?.color).toBe('mint');
    expect(persisted.cards[0]?.text).toBe('BUILD');
    expect(persisted.cards[0]?.createdAt).toBe(originalCard.createdAt);
    expect(persisted.cards[0]?.updatedAt).toBeGreaterThan(
      originalCard.updatedAt,
    );
  });
});
