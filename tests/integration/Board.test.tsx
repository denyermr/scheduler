import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Board } from '../../src/ui/Board';
import { addCard, addThread, createBoard } from '../../src/domain/board';
import {
  CARD_PALETTE_FILLS,
  DAY_HEADER_LABELS,
  DAY_HEADER_BADGE,
  WEEKEND_DAY_INDICES,
  computeBoardMetrics,
  threadSag,
} from '../../src/ui/tokens';

const TEST_CONTAINER = 1440;
const METRICS = computeBoardMetrics(TEST_CONTAINER);

function makeBoard(weeks: number) {
  let board = createBoard({ startMonday: '2024-05-27', weeks });
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
  it('renders seven day headers (Mon..Sun)', () => {
    render(
      <Board
        board={createBoard({ startMonday: '2024-05-27', weeks: 4 })}
        containerWidth={TEST_CONTAINER}
      />,
    );
    for (const label of DAY_HEADER_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders one week-rail row per board week, numbered 1..N', () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 7 });
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
    const rail = screen.getByTestId('board-rail');
    const rows = within(rail).getAllByTestId('week-row');
    expect(rows).toHaveLength(7);
    expect(within(rows[0]!).getByText('1')).toBeInTheDocument();
    expect(within(rows[6]!).getByText('7')).toBeInTheDocument();
  });

  it('renders one card per board.cards entry at the correct cell center', () => {
    const board = makeBoard(6);
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(3);
    const slots = screen.getAllByTestId('card-slot');
    const { cellW, cellH, railW, headerH } = METRICS;
    expect(slots[0]!.style.left).toBe(`${String(railW + 1 * cellW + cellW / 2)}px`);
    expect(slots[0]!.style.top).toBe(`${String(headerH + 0 * cellH + cellH / 2)}px`);
    expect(slots[1]!.style.left).toBe(`${String(railW + 3 * cellW + cellW / 2)}px`);
    expect(slots[1]!.style.top).toBe(`${String(headerH + 2 * cellH + cellH / 2)}px`);
  });

  it('renders one path per board.threads entry with the canonical sag', () => {
    const board = makeBoard(6);
    const { container } = render(
      <Board board={board} containerWidth={TEST_CONTAINER} />,
    );
    const paths = container.querySelectorAll('[data-testid="thread-path"]');
    expect(paths).toHaveLength(1);
    const { cellW, cellH, railW, headerH } = METRICS;
    const ax = railW + 1 * cellW + cellW / 2;
    const ay = headerH + 0 * cellH + cellH / 2;
    const bx = railW + 3 * cellW + cellW / 2;
    const by = headerH + 2 * cellH + cellH / 2;
    const dist = Math.hypot(bx - ax, by - ay);
    const sag = threadSag(dist);
    const expected = `M ${String(ax)} ${String(ay)} Q ${String((ax + bx) / 2)} ${String((ay + by) / 2 + sag)} ${String(bx)} ${String(by)}`;
    expect(paths[0]!.getAttribute('d')).toBe(expected);
  });

  it('renders the threads layer ABOVE resting card slots so a vertical thread is visible between overlapping cards', () => {
    // At 1440 px containerWidth, computed cardSize = min(cellW/56, cellH/38) =
    // min(180/56, 99/38) = 2.6. Card rendered min-height (with paddingY×2) is
    // 42 × 2.6 ≈ 109 px — taller than the 99 px cell. Two vertically adjacent
    // cards (same day, consecutive weeks) overlap each other, and the thread
    // path between them is a straight vertical line that runs entirely inside
    // those two cards. The only way the thread can show is for its <svg>
    // layer to paint above the card slots.
    let board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const a = addCard(board, {
      week: 0,
      day: 3,
      color: 'peach',
      text: 'A',
      newId: () => 'card_a',
    });
    board = a.board;
    const b = addCard(board, {
      week: 1,
      day: 3,
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

    const { container } = render(
      <Board board={board} containerWidth={TEST_CONTAINER} />,
    );

    const threadSvg = container.querySelector(
      '[data-testid="thread-path"]',
    )?.closest('svg') as SVGElement | null;
    if (!threadSvg) throw new Error('no thread svg in DOM');
    const threadZ = Number(threadSvg.style.zIndex);
    const slot = container.querySelector(
      '[data-card-id="card_a"]',
    ) as HTMLElement | null;
    if (!slot) throw new Error('no card slot');
    const slotZ = Number(slot.style.zIndex);

    expect(Number.isFinite(threadZ)).toBe(true);
    expect(threadZ).toBeGreaterThan(slotZ);
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
    const { container } = render(
      <Board board={broken} containerWidth={TEST_CONTAINER} />,
    );
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
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
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
      const match = /rgb\(\s*\d+,\s*\d+,\s*\d+\)/.exec(bg);
      expect(match, `card background should be rgb(...): got ${bg}`).not.toBeNull();
      expect(allowed.has(match![0])).toBe(true);
    }
  });

  it('inner cork surface size is railW + 7*cellW × headerH + weeks*cellH (Amendment A)', () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 26 });
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
    const surface = screen.getByTestId('board-surface');
    const { cellW, cellH, railW, headerH } = METRICS;
    expect(surface.style.width).toBe(`${String(railW + 7 * cellW)}px`);
    expect(surface.style.height).toBe(`${String(headerH + 26 * cellH)}px`);
  });
});

describe('<Board /> — Amendment B visual refresh', () => {
  it('has no wood-frame wrapper — cork is the outer surface', () => {
    render(
      <Board
        board={createBoard({ startMonday: '2024-05-27', weeks: 4 })}
        containerWidth={TEST_CONTAINER}
      />,
    );
    expect(screen.queryByTestId('board-frame')).toBeNull();
    // The outermost board element is the cork surface itself.
    const surface = screen.getByTestId('board-surface');
    expect(surface.parentElement?.tagName).toBe('DIV'); // the test wrapper, not a frame
  });

  it('cork surface has the new v2 border-radius (3px) and floating drop shadow', () => {
    render(
      <Board
        board={createBoard({ startMonday: '2024-05-27', weeks: 4 })}
        containerWidth={TEST_CONTAINER}
      />,
    );
    const surface = screen.getByTestId('board-surface');
    expect(surface.style.borderRadius).toBe('3px');
    // jsdom doesn't normalise our literal rgba(40,30,15,.28); compare raw substring.
    const shadow = surface.style.boxShadow;
    expect(shadow).toContain('inset 0 0 28px rgba(60,30,10,.16)');
    expect(shadow).toContain('inset 0 0 0 1px rgba(40,30,15,.28)'); // hairline
    expect(shadow).toContain('-24px'); // outer float-shadow signature
  });

  it('weekday day-header badges (Mon..Fri) use the saturated peach + 18px + opacity 1', () => {
    render(
      <Board
        board={createBoard({ startMonday: '2024-05-27', weeks: 4 })}
        containerWidth={TEST_CONTAINER}
      />,
    );
    for (const label of ['MON', 'TUES', 'WED', 'THURS', 'FRI']) {
      const badge = screen.getByTestId(`day-header-badge-${label}`);
      const wrapper = screen.getByTestId(`day-header-${label}`);
      expect(badge.style.background).toContain('rgb(244, 181, 132)'); // #F4B584
      expect(wrapper.style.fontSize).toBe('18px');
      expect(wrapper.style.opacity).toBe('1');
    }
  });

  it('weekend day-header badges (Sat, Sun) use the muted lighter peach + 16px + opacity 0.78', () => {
    render(
      <Board
        board={createBoard({ startMonday: '2024-05-27', weeks: 4 })}
        containerWidth={TEST_CONTAINER}
      />,
    );
    for (const label of ['SAT', 'SUN']) {
      const badge = screen.getByTestId(`day-header-badge-${label}`);
      const wrapper = screen.getByTestId(`day-header-${label}`);
      expect(badge.style.background).toContain('rgb(233, 199, 154)'); // #e9c79a
      expect(wrapper.style.fontSize).toBe('16px');
      expect(wrapper.style.opacity).toBe('0.78');
    }
  });

  it('weekend day-header badge constants match the design tokens', () => {
    // Pin the values themselves so a regression in tokens.ts trips this too.
    expect(DAY_HEADER_BADGE.weekday.fill).toBe('#F4B584');
    expect(DAY_HEADER_BADGE.weekend.fill).toBe('#e9c79a');
    expect(DAY_HEADER_BADGE.weekend.opacity).toBe(0.78);
    expect(WEEKEND_DAY_INDICES).toEqual([5, 6]);
  });

  it('Sat (5) and Sun (6) cells have the same dimensions and grid lines as weekday cells', () => {
    let board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    // One card in every weekday + Sat + Sun column.
    for (const day of [0, 1, 2, 3, 4, 5, 6] as const) {
      board = addCard(board, {
        week: 0,
        day,
        color: 'peach',
        text: 'x',
        newId: () => `card_${String(day)}`,
      }).board;
    }
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
    const slots = screen.getAllByTestId('card-slot');
    expect(slots).toHaveLength(7);
    const { cellW, cellH, railW, headerH } = METRICS;
    // Slot left/top is purely a function of cellW/cellH/railW/headerH and the
    // day index — no weekend-specific offset.
    for (let day = 0; day < 7; day++) {
      expect(slots[day]!.style.left).toBe(
        `${String(railW + day * cellW + cellW / 2)}px`,
      );
      expect(slots[day]!.style.top).toBe(
        `${String(headerH + 0 * cellH + cellH / 2)}px`,
      );
    }
  });
});

describe('<Board /> — Phase 4 in-cell stacking', () => {
  function makeStackBoard(n: number) {
    let board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = addCard(board, {
        week: 1,
        day: 2,
        color: 'peach',
        text: `c${String(i)}`,
        newId: () => `card_stack_${String(i)}`,
        clock: () => 1000 + i,
      });
      board = r.board;
      ids.push(r.cardId);
    }
    return { board, ids };
  }

  it('a single card in a cell renders at the cell centre (no offset)', () => {
    const { board, ids } = makeStackBoard(1);
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
    const slot = document.querySelector(
      `[data-card-id="${ids[0] ?? ''}"]`,
    ) as HTMLElement | null;
    expect(slot).not.toBeNull();
    const expectedX = METRICS.railW + 2 * METRICS.cellW + METRICS.cellW / 2;
    const expectedY =
      METRICS.headerH + 1 * METRICS.cellH + METRICS.cellH / 2;
    expect(slot?.style.left).toBe(`${String(expectedX)}px`);
    expect(slot?.style.top).toBe(`${String(expectedY)}px`);
  });

  it('4 cards in a cell offset deterministically per stackOffsets(4)', () => {
    const { board, ids } = makeStackBoard(4);
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);

    const centreX = METRICS.railW + 2 * METRICS.cellW + METRICS.cellW / 2;
    const centreY = METRICS.headerH + 1 * METRICS.cellH + METRICS.cellH / 2;

    // Order is createdAt-ascending: ids[0] = i=0, ids[1] = i=1, ...
    const expected = [
      { x: centreX + 4, y: centreY + 3 },
      { x: centreX - 7, y: centreY - 5.5 },
      { x: centreX + 10, y: centreY + 8 },
      { x: centreX - 13, y: centreY - 10.5 },
    ];

    expected.forEach((exp, i) => {
      const slot = document.querySelector(
        `[data-card-id="${ids[i] ?? ''}"]`,
      ) as HTMLElement | null;
      expect(slot, `card index ${String(i)}`).not.toBeNull();
      expect(slot?.style.left).toBe(`${String(exp.x)}px`);
      expect(slot?.style.top).toBe(`${String(exp.y)}px`);
    });
  });

  it('renders the higher-z card on top via CSS zIndex', () => {
    const { board, ids } = makeStackBoard(3);
    render(<Board board={board} containerWidth={TEST_CONTAINER} />);
    const z0 = (
      document.querySelector(`[data-card-id="${ids[0] ?? ''}"]`) as HTMLElement
    )?.style.zIndex;
    const z1 = (
      document.querySelector(`[data-card-id="${ids[1] ?? ''}"]`) as HTMLElement
    )?.style.zIndex;
    const z2 = (
      document.querySelector(`[data-card-id="${ids[2] ?? ''}"]`) as HTMLElement
    )?.style.zIndex;
    expect(Number(z2)).toBeGreaterThan(Number(z1));
    expect(Number(z1)).toBeGreaterThan(Number(z0));
  });

  it('threads attaching to a stacked card terminate at the rendered (offset) position', () => {
    const { board, ids } = makeStackBoard(2);
    let withThread = board;
    // Anchor card in a different cell so we can pin one endpoint.
    const anchor = addCard(withThread, {
      week: 0,
      day: 0,
      color: 'mint',
      text: 'anchor',
      newId: () => 'card_anchor',
      clock: () => 500,
    });
    withThread = anchor.board;
    const thread = addThread(withThread, {
      fromCardId: 'card_anchor',
      toCardId: ids[1] ?? '',
      newId: () => 'thread_stack',
    });
    withThread = thread.board;

    render(<Board board={withThread} containerWidth={TEST_CONTAINER} />);

    // Expected endpoint on the stacked card side: cell-centre + the
    // i=1 offset for stackOffsets(2) → (-7, -5.5).
    const stackedX =
      METRICS.railW + 2 * METRICS.cellW + METRICS.cellW / 2 - 7;
    const stackedY =
      METRICS.headerH + 1 * METRICS.cellH + METRICS.cellH / 2 - 5.5;

    const path = document.querySelector(
      `path[data-thread-id="thread_stack"]`,
    );
    expect(path).not.toBeNull();
    const d = path?.getAttribute('d') ?? '';
    // Path shape: M x1 y1 Q midX (midY + sag) x2 y2 — extract the trailing endpoint.
    const match = /\s([\d.-]+)\s([\d.-]+)$/.exec(d);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeCloseTo(stackedX, 1);
    expect(Number(match?.[2])).toBeCloseTo(stackedY, 1);
  });
});

describe('<Board /> — fluid sizing (Amendment A + B)', () => {
  it('at containerWidth = 1440 the rendered cork width follows computeBoardMetrics', () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    render(<Board board={board} containerWidth={1440} />);
    const surface = screen.getByTestId('board-surface');
    const m = computeBoardMetrics(1440);
    expect(surface.style.width).toBe(`${String(m.railW + 7 * m.cellW)}px`);
  });

  it('at containerWidth = 600 cellW floors at 120', () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    render(<Board board={board} containerWidth={600} />);
    const surface = screen.getByTestId('board-surface');
    const m = computeBoardMetrics(600);
    expect(m.cellW).toBe(120);
    expect(surface.style.width).toBe(`${String(m.railW + 7 * m.cellW)}px`);
  });
});
