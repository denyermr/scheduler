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

const SLUG = 'phase-6-toolbar';
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

function seed(
  board: Board,
  opts: { week: number; day: Day; id: string; createdAt?: number },
): { board: Board; id: CardId } {
  const r = addCard(board, {
    week: opts.week,
    day: opts.day,
    color: 'peach',
    text: opts.id,
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
  return { repo, saveSpy };
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe('Phase 6 — Toolbar', () => {
  it('renders Weeks N · Undo · Redo · Share', async () => {
    await renderApp(emptyBoard());
    const toolbar = screen.getByTestId('toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-weeks-display')).toHaveTextContent(
      'Weeks 6',
    );
    expect(screen.getByTestId('toolbar-undo')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-redo')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-share')).toBeInTheDocument();
  });

  it('Undo and Redo buttons disable when their stacks are empty', async () => {
    await renderApp(emptyBoard());
    expect(screen.getByTestId('toolbar-undo')).toBeDisabled();
    expect(screen.getByTestId('toolbar-redo')).toBeDisabled();
  });

  it('Undo / Redo buttons fire the editor actions', async () => {
    const a = seed(emptyBoard(), { week: 1, day: 2 as Day, id: 'card_A' });
    await renderApp(a.board);

    // Trigger a mutation through the UI: open popover, delete the card.
    fireEvent.click(
      document.querySelector(`[data-card-id="${a.id}"]`) as HTMLElement,
    );
    fireEvent.click(screen.getByTestId('edit-popover-delete'));
    expect(document.querySelector(`[data-card-id="${a.id}"]`)).toBeNull();

    expect(screen.getByTestId('toolbar-undo')).toBeEnabled();
    fireEvent.click(screen.getByTestId('toolbar-undo'));
    expect(
      document.querySelector(`[data-card-id="${a.id}"]`),
    ).not.toBeNull();

    expect(screen.getByTestId('toolbar-redo')).toBeEnabled();
    fireEvent.click(screen.getByTestId('toolbar-redo'));
    expect(document.querySelector(`[data-card-id="${a.id}"]`)).toBeNull();
  });

  it('Weeks stepper: clicking Weeks N reveals the stepper input', async () => {
    await renderApp(emptyBoard());
    fireEvent.click(screen.getByTestId('toolbar-weeks-display'));
    const input = screen.getByTestId('toolbar-weeks-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.min).toBe('4');
    expect(input.max).toBe('52');
    expect(input.value).toBe('6');
  });

  it('Weeks stepper: shrinking with no cut-off cards commits immediately', async () => {
    await renderApp(emptyBoard());
    fireEvent.click(screen.getByTestId('toolbar-weeks-display'));
    const input = screen.getByTestId('toolbar-weeks-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('toolbar-weeks-apply'));
    expect(screen.getByTestId('toolbar-weeks-display')).toHaveTextContent(
      'Weeks 4',
    );
    // Stepper closed after apply.
    expect(screen.queryByTestId('toolbar-weeks-input')).toBeNull();
  });

  it('Weeks stepper: shrinking that would cut cards opens the resize dialog', async () => {
    // Card in week 5 of a 6-week board.
    const seeded = seed(emptyBoard(), {
      week: 5,
      day: 0 as Day,
      id: 'tail',
    });
    await renderApp(seeded.board);

    fireEvent.click(screen.getByTestId('toolbar-weeks-display'));
    const input = screen.getByTestId('toolbar-weeks-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('toolbar-weeks-apply'));

    // Dialog visible; board NOT yet shrunk.
    expect(screen.getByTestId('resize-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-weeks-display')).toHaveTextContent(
      'Weeks 6',
    );
  });

  it('Resize dialog: cancel reverts; board unchanged', async () => {
    const seeded = seed(emptyBoard(), {
      week: 5,
      day: 0 as Day,
      id: 'tail',
    });
    await renderApp(seeded.board);

    fireEvent.click(screen.getByTestId('toolbar-weeks-display'));
    fireEvent.change(screen.getByTestId('toolbar-weeks-input'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByTestId('toolbar-weeks-apply'));

    fireEvent.click(screen.getByTestId('resize-dialog-cancel'));
    expect(screen.queryByTestId('resize-dialog')).toBeNull();
    expect(screen.getByTestId('toolbar-weeks-display')).toHaveTextContent(
      'Weeks 6',
    );
  });

  it('Resize dialog: confirm commits the shrink; off-board card preserved; regrow restores it', async () => {
    const seeded = seed(emptyBoard(), {
      week: 5,
      day: 0 as Day,
      id: 'tail',
    });
    await renderApp(seeded.board);

    fireEvent.click(screen.getByTestId('toolbar-weeks-display'));
    fireEvent.change(screen.getByTestId('toolbar-weeks-input'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByTestId('toolbar-weeks-apply'));

    // Dialog shows the cut count.
    expect(
      screen.getByTestId('resize-dialog-message'),
    ).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('resize-dialog-confirm'));
    expect(screen.queryByTestId('resize-dialog')).toBeNull();
    expect(screen.getByTestId('toolbar-weeks-display')).toHaveTextContent(
      'Weeks 4',
    );
    // Card is off-board (not rendered) but preserved in the model — regrow brings it back.
    expect(document.querySelector('[data-card-id="tail"]')).toBeNull();

    fireEvent.click(screen.getByTestId('toolbar-weeks-display'));
    fireEvent.change(screen.getByTestId('toolbar-weeks-input'), {
      target: { value: '6' },
    });
    fireEvent.click(screen.getByTestId('toolbar-weeks-apply'));
    expect(
      document.querySelector('[data-card-id="tail"]'),
    ).not.toBeNull();
  });

  it('Share dialog: opens with URL + Copy + cards / threads summary', async () => {
    const a = seed(emptyBoard(), { week: 0, day: 0 as Day, id: 'card_A' });
    await renderApp(a.board);

    fireEvent.click(screen.getByTestId('toolbar-share'));
    const dialog = screen.getByTestId('share-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('share-dialog-url')).toHaveTextContent(SLUG);
    expect(screen.getByTestId('share-dialog-summary')).toHaveTextContent(
      '1 card',
    );
    expect(screen.getByTestId('share-dialog-summary')).toHaveTextContent(
      '0 threads',
    );
  });

  it('Share dialog: Copy button writes the URL to navigator.clipboard', async () => {
    await renderApp(emptyBoard());

    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    fireEvent.click(screen.getByTestId('toolbar-share'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('share-dialog-copy'));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const calledWith = writeText.mock.calls[0]?.[0] ?? '';
    expect(calledWith).toContain(SLUG);
  });

  it('Share dialog: Esc / close button dismisses', async () => {
    await renderApp(emptyBoard());
    fireEvent.click(screen.getByTestId('toolbar-share'));
    expect(screen.getByTestId('share-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('share-dialog-close'));
    expect(screen.queryByTestId('share-dialog')).toBeNull();
  });
});
