import type { CSSProperties } from 'react';
import type { Board as BoardModel, Card as CardModel } from '../domain/types';
import { Card } from './Card';
import { Thread, ThreadShadowDefs, THREAD_FILTER_ID } from './Thread';
import {
  BOARD_HERO_METRICS,
  CARD_PALETTE,
  CORK_TEXTURE_BG,
  CORK_TEXTURE_SIZE,
  DAY_HEADER_LABELS,
  FONTS,
  FRAME_PADDING,
  GRID_EDGE,
  GRID_HEADER_RULE,
  GRID_LINE,
  PIN_PALETTE,
  SURFACE,
} from './tokens';

export type BoardProps = {
  board: BoardModel;
  cellW?: number;
  cellH?: number;
  railW?: number;
  headerH?: number;
  frame?: boolean;
  showHoles?: boolean;
  showThreads?: boolean;
  weekLabels?: readonly string[];
  /** Inject deterministic pseudo-randomness for header tilt & pin holes (tests / SSR). */
  decorationSeed?: number;
};

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const DEFAULT_WEEK_LABELS = computeWeekLabels('2024-05-27', 60);

function computeWeekLabels(startMonday: string, count: number): readonly string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startMonday);
  if (!m) return [];
  const start = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 7 * 86_400_000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    out.push(`${dd} ${mm}`);
  }
  return out;
}

function cellCenter(
  card: Pick<CardModel, 'week' | 'day'>,
  metrics: { cellW: number; cellH: number; railW: number; headerH: number },
): { x: number; y: number } {
  return {
    x: metrics.railW + card.day * metrics.cellW + metrics.cellW / 2,
    y: metrics.headerH + card.week * metrics.cellH + metrics.cellH / 2,
  };
}

export function Board({
  board,
  cellW = BOARD_HERO_METRICS.cellW,
  cellH = BOARD_HERO_METRICS.cellH,
  railW = BOARD_HERO_METRICS.railW,
  headerH = BOARD_HERO_METRICS.headerH,
  frame = true,
  showHoles = true,
  showThreads = true,
  weekLabels,
  decorationSeed = 1234,
}: BoardProps): JSX.Element {
  const { weeks } = board;
  const W = railW + 5 * cellW;
  const H = headerH + weeks * cellH;
  const rand = seededRng(decorationSeed);

  const labels = weekLabels ?? computeWeekLabels(board.startMonday, weeks + 4);
  const labelsToUse = labels.length > 0 ? labels : DEFAULT_WEEK_LABELS;

  const cardSize = Math.min(cellW / 56, cellH / 38);
  const cardsById = new Map(board.cards.map((c) => [c.id, c]));

  const frameStyle: CSSProperties = {
    position: 'relative',
    width: W + (frame ? FRAME_PADDING.left + FRAME_PADDING.right : 0),
    height: H + (frame ? FRAME_PADDING.top + FRAME_PADDING.bottom : 0),
    padding: frame
      ? `${String(FRAME_PADDING.top)}px ${String(FRAME_PADDING.right)}px ${String(FRAME_PADDING.bottom)}px ${String(FRAME_PADDING.left)}px`
      : 0,
    background: frame ? SURFACE.wood : 'transparent',
    borderRadius: frame ? 6 : 0,
    boxShadow: frame
      ? '0 4px 14px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.18)'
      : 'none',
  };

  const surfaceStyle: CSSProperties = {
    position: 'relative',
    width: W,
    height: H,
    background: CORK_TEXTURE_BG,
    backgroundSize: CORK_TEXTURE_SIZE,
    boxShadow:
      'inset 0 0 24px rgba(60,30,10,.18), inset 0 0 0 1px rgba(0,0,0,.18)',
    overflow: 'hidden',
  };

  return (
    <div data-testid="board-frame" style={frameStyle}>
      <div data-testid="board-surface" style={surfaceStyle}>
        {/* Grid lines */}
        <svg
          width={W}
          height={H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          aria-hidden
        >
          {Array.from({ length: weeks + 1 }).map((_, i) => (
            <line
              key={`h${String(i)}`}
              x1={0}
              y1={headerH + i * cellH}
              x2={W}
              y2={headerH + i * cellH}
              stroke={GRID_LINE}
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`v${String(i)}`}
              x1={railW + i * cellW}
              y1={0}
              x2={railW + i * cellW}
              y2={H}
              stroke={GRID_LINE}
              strokeWidth="0.5"
            />
          ))}
          <rect
            x="0.5"
            y="0.5"
            width={W - 1}
            height={H - 1}
            fill="none"
            stroke={GRID_EDGE}
            strokeWidth="1"
          />
          <line
            x1={0}
            y1={headerH}
            x2={W}
            y2={headerH}
            stroke={GRID_HEADER_RULE}
            strokeWidth="1"
          />
          <line
            x1={railW}
            y1={0}
            x2={railW}
            y2={H}
            stroke={GRID_HEADER_RULE}
            strokeWidth="1"
          />
        </svg>

        {/* Day headers */}
        {DAY_HEADER_LABELS.map((label, i) => (
          <div
            key={label}
            data-testid="day-header"
            style={{
              position: 'absolute',
              top: 6,
              left: railW + i * cellW,
              width: cellW,
              height: headerH - 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.caveat,
              fontWeight: 700,
              fontSize: 18,
              color: '#3a2410',
              transform: `rotate(${String((rand() - 0.5) * 1.5)}deg)`,
            }}
          >
            <span
              style={{
                background: CARD_PALETTE.peach.fill,
                padding: '2px 8px',
                borderRadius: 1.5,
                boxShadow: '0 1px 2px rgba(0,0,0,.18)',
              }}
            >
              {label}
            </span>
          </div>
        ))}

        {/* Week rail */}
        <div data-testid="board-rail">
          {Array.from({ length: weeks }).map((_, i) => (
            <div
              key={`rail${String(i)}`}
              data-testid="week-row"
              style={{
                position: 'absolute',
                left: 0,
                top: headerH + i * cellH,
                width: railW,
                height: cellH,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 6,
                color: '#3a2410',
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.caveat,
                  fontSize: 18,
                  fontWeight: 700,
                  minWidth: 18,
                  textAlign: 'right',
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  fontFamily: FONTS.caveat,
                  fontSize: 12,
                  opacity: 0.7,
                  lineHeight: 1,
                }}
              >
                {labelsToUse[i] ?? ''}
              </span>
            </div>
          ))}
        </div>

        {/* Decorative pin holes around the edges */}
        {showHoles &&
          Array.from({ length: 18 }).map((_, i) => {
            const onLeft = i % 2 === 0;
            const x = onLeft ? 3 + rand() * 3 : W - 6 - rand() * 3;
            const y = headerH + rand() * (H - headerH - 6);
            const palette = Object.values(PIN_PALETTE);
            const c =
              palette[Math.floor(rand() * palette.length)] ?? PIN_PALETTE.white;
            return (
              <span
                key={`hole${String(i)}`}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 30%, #fff8 0 18%, ${c} 20% 100%)`,
                  boxShadow: '0 0.6px 1.2px rgba(0,0,0,.4)',
                }}
              />
            );
          })}

        {/* Cards */}
        {board.cards
          .filter((c) => c.week >= 0 && c.week < weeks)
          .map((card) => {
            const { x, y } = cellCenter(card, { cellW, cellH, railW, headerH });
            return (
              <div
                key={card.id}
                data-testid="card-slot"
                data-card-id={card.id}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Card card={card} size={cardSize} />
              </div>
            );
          })}

        {/* Threads */}
        {showThreads && (
          <svg
            width={W}
            height={H}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            aria-hidden
          >
            <ThreadShadowDefs />
            {board.threads.map((thread) => {
              const a = cardsById.get(thread.fromCardId);
              const b = cardsById.get(thread.toCardId);
              if (!a || !b) return null;
              const pa = cellCenter(a, { cellW, cellH, railW, headerH });
              const pb = cellCenter(b, { cellW, cellH, railW, headerH });
              return (
                <Thread
                  key={thread.id}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  threadId={thread.id}
                  filterId={THREAD_FILTER_ID}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
