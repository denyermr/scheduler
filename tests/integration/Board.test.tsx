import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Board } from '../../src/ui/Board';
import { addCard, addThread, createBoard } from '../../src/domain/board';
import {
  BOARD_HERO_METRICS,
  CARD_PALETTE_FILLS,
  DAY_HEADER_LABELS,
  threadSag,
} from '../../src/ui/tokens';

function makeBoard(weeks: number) {
  let board = createBoard({ startMonday: '2024-05-27', weeks });
  // Add a few deterministic cards.
  const a = addCard(board, {
    week: 0,
    day: 1,
    color: 'coral',
    text: 'BLOCK',
    newId: () => 'card_a',
  });
  board = a.board;
  const b = addCard(board, {
    week: 2,
    day: 3,
    color: 'sky',
    text: 'BUILD',
    newId: () => 'card_b',
  });
  board = b.board;
  const c = addCard(board, {
    week: 4,
    day: 2,
    color: 'peach',
    text: 'Dress + light',
    newId: () => 'card_c',
  });
  board = c.board;
  const t = addThread(board, {
    fromCardId: a.cardId,
    toCardId: b.cardId,
    newId: () => 'thread_ab',
  });
  return t.board;
}

describe('<Board />', () => {
  it('renders five day headers (Mon..Fri)', () => {
    render(<Board board={createBoard({ startMonday: '2024-05-27', weeks: 4 })} />);
    for (const label of DAY_HEADER_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders one week-rail row per board week, numbered 1..N', () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 7 });
    render(<Board board={board} />);
    const rail = screen.getByTestId('board-rail');
    const rows = within(rail).getAllByTestId('week-row');
    expect(rows).toHaveLength(7);
    expect(within(rows[0]!).getByText('1')).toBeInTheDocument();
    expect(within(rows[6]!).getByText('7')).toBeInTheDocument();
  });

  it('renders one card per board.cards entry at the correct cell center', () => {
    const board = makeBoard(6);
    render(<Board board={board} />);
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
    const slots = screen.getAllByTestId('card-slot');
    const { cellW, cellH, railW, headerH } = BOARD_HERO_METRICS;
    // Card a — week 0, day 1
    expect(slots[0]!.style.left).toBe(`${String(railW + 1 * cellW + cellW / 2)}px`);
    expect(slots[0]!.style.top).toBe(`${String(headerH + 0 * cellH + cellH / 2)}px`);
    // Card b — week 2, day 3
    expect(slots[1]!.style.left).toBe(`${String(railW + 3 * cellW + cellW / 2)}px`);
    expect(slots[1]!.style.top).toBe(`${String(headerH + 2 * cellH + cellH / 2)}px`);
  });

  it('renders one path per board.threads entry with the canonical sag', () => {
    const board = makeBoard(6);
    const { container } = render(<Board board={board} />);
    const paths = container.querySelectorAll('[data-testid="thread-path"]');
    expect(paths).toHaveLength(1);
    const { cellW, cellH, railW, headerH } = BOARD_HERO_METRICS;
    const ax = railW + 1 * cellW + cellW / 2;
    const ay = headerH + 0 * cellH + cellH / 2;
    const bx = railW + 3 * cellW + cellW / 2;
    const by = headerH + 2 * cellH + cellH / 2;
    const dist = Math.hypot(bx - ax, by - ay);
    const sag = threadSag(dist);
    const expected = `M ${String(ax)} ${String(ay)} Q ${String((ax + bx) / 2)} ${String((ay + by) / 2 + sag)} ${String(bx)} ${String(by)}`;
    expect(paths[0]!.getAttribute('d')).toBe(expected);
  });

  it('skips threads whose endpoint cards no longer exist', () => {
    let board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const a = addCard(board, {
      week: 0,
      day: 0,
      color: 'peach',
      text: 'A',
      newId: () => 'card_a',
    });
    board = a.board;
    const b = addCard(board, {
      week: 1,
      day: 1,
      color: 'peach',
      text: 'B',
      newId: () => 'card_b',
    });
    board = b.board;
    board = addThread(board, {
      fromCardId: a.cardId,
      toCardId: b.cardId,
      newId: () => 'thread_ab',
    }).board;
    const broken = {
      ...board,
      threads: [
        ...board.threads,
        { id: 'thread_orphan', fromCardId: 'ghost', toCardId: b.cardId },
      ],
    };
    const { container } = render(<Board board={broken} />);
    expect(container.querySelectorAll('[data-testid="thread-path"]')).toHaveLength(1);
  });

  it('uses only the 8-color palette for card fills', () => {
    let board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    for (const color of [
      'peach',
      'coral',
      'orange',
      'salmon',
      'yellow',
      'mint',
      'sky',
      'lilac',
    ] as const) {
      const r = addCard(board, {
        week: 0,
        day: 0,
        color,
        text: 'x',
      });
      board = r.board;
    }
    render(<Board board={board} />);
    const allowed = new Set(
      CARD_PALETTE_FILLS.map((hex) => {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
      }),
    );
    for (const card of screen.getAllByTestId('card')) {
      const bg = card.style.background;
      // The CSS background string starts with rgb(...)
      const match = /rgb\(\s*\d+,\s*\d+,\s*\d+\)/.exec(bg);
      expect(match, `card background should be rgb(...): got ${bg}`).not.toBeNull();
      expect(allowed.has(match![0])).toBe(true);
    }
  });

  it('exposes the inner surface size derived from the metrics', () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 26 });
    render(<Board board={board} />);
    const surface = screen.getByTestId('board-surface');
    const { cellW, cellH, railW, headerH } = BOARD_HERO_METRICS;
    expect(surface.style.width).toBe(`${String(railW + 5 * cellW)}px`);
    expect(surface.style.height).toBe(`${String(headerH + 26 * cellH)}px`);
  });
});
