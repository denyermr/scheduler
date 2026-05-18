import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { DAYS, type Day } from '../domain/types';
import type {
  Board as BoardModel,
  Card as CardModel,
  CardId,
  Week,
} from '../domain/types';
import { stackOffsets } from '../domain/stacking';
import { Card } from './Card';
import { Thread, ThreadShadowDefs, THREAD_FILTER_ID } from './Thread';
import {
  BOARD_FIXED_METRICS,
  BOARD_FLOAT_SHADOW,
  CORK_INSET_SHADOW,
  CORK_RADIUS,
  CORK_TEXTURE_BG,
  CORK_TEXTURE_SIZE,
  DAY_HEADER_BADGE,
  DAY_HEADER_LABELS,
  DRAG_LIFT_MS,
  DRAG_LIFT_SCALE,
  DRAG_LIFT_SHADOW,
  DRAG_SNAP_MS,
  FONTS,
  GRID_EDGE,
  GRID_HEADER_RULE,
  GRID_LINE,
  PIN_PALETTE,
  WEEKEND_DAY_INDICES,
  cellAt,
  cellCenter,
  computeBoardMetrics,
} from './tokens';

export type BoardProps = {
  board: BoardModel;
  /** Width of the host container in CSS pixels. Drives the fluid cellW math. */
  containerWidth?: number;
  showHoles?: boolean;
  showThreads?: boolean;
  weekLabels?: readonly string[];
  /** Inject deterministic pseudo-randomness for header tilt & pin holes (tests / SSR). */
  decorationSeed?: number;
  onCellClick?: (week: Week, day: Day) => void;
  onCardClick?: (cardId: CardId) => void;
  /** Fires after a successful drag → drop. The drag state machine handles the
   * press-hold gate, hit-testing via `cellAt`, and the snap animation. */
  onCardDrop?: (cardId: CardId, week: Week, day: Day) => void;
  /** Fires when the user Cmd/Ctrl-clicks a stacked cell — cycles z-order. */
  onCellCycle?: (week: Week, day: Day) => void;
  /** Optional overlay (e.g. EditPopover) positioned below the given card. */
  popoverForCard?: CardId;
  popover?: ReactNode;
};

type DragState =
  | { kind: 'idle' }
  | {
      kind: 'pressing';
      cardId: CardId;
      originClientX: number;
      originClientY: number;
    }
  | {
      kind: 'lifted';
      cardId: CardId;
      originClientX: number;
      originClientY: number;
      deltaX: number;
      deltaY: number;
      targetCell: { week: number; day: Day } | null;
    }
  | { kind: 'snapping'; cardId: CardId };

const DAYS_PER_WEEK = 7;
const WEEKEND_SET = new Set<number>(WEEKEND_DAY_INDICES);
const POPOVER_WIDTH = 220;
const POPOVER_GAP = 8;

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

const DEFAULT_CONTAINER_WIDTH = 1440;

export function Board({
  board,
  containerWidth = DEFAULT_CONTAINER_WIDTH,
  showHoles = true,
  showThreads = true,
  weekLabels,
  decorationSeed = 1234,
  onCellClick,
  onCardClick,
  onCardDrop,
  onCellCycle,
  popoverForCard,
  popover,
}: BoardProps): JSX.Element {
  const { weeks } = board;
  const { cellW, cellH, railW, headerH } = computeBoardMetrics(containerWidth);
  const W = railW + DAYS_PER_WEEK * cellW;
  const H = headerH + weeks * cellH;
  const rand = seededRng(decorationSeed);

  // ─── Drag state machine ────────────────────────────────────────────────
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>({ kind: 'idle' });
  const dragRef = useRef<DragState>(drag);
  useEffect(() => {
    dragRef.current = drag;
  });
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a drag completes, the synthetic click on the slot would re-open the
  // popover. We mark the next click as a no-op to suppress it.
  const suppressNextClick = useRef(false);

  const clearLiftTimer = useCallback(() => {
    if (liftTimer.current !== null) {
      clearTimeout(liftTimer.current);
      liftTimer.current = null;
    }
  }, []);

  const pointerToBoardXY = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const surface = surfaceRef.current;
      if (!surface) return null;
      const r = surface.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    },
    [],
  );

  const onCardPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, cardId: CardId): void => {
      if (e.button !== 0) return;
      // Cmd/Ctrl-click is a separate gesture (stack cycle) — let onClick handle it.
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      setDrag({
        kind: 'pressing',
        cardId,
        originClientX: e.clientX,
        originClientY: e.clientY,
      });
      clearLiftTimer();
      liftTimer.current = setTimeout(() => {
        liftTimer.current = null;
        setDrag((d) =>
          d.kind === 'pressing' && d.cardId === cardId
            ? {
                kind: 'lifted',
                cardId,
                originClientX: d.originClientX,
                originClientY: d.originClientY,
                deltaX: 0,
                deltaY: 0,
                targetCell: null,
              }
            : d,
        );
      }, DRAG_LIFT_MS);
    },
    [clearLiftTimer],
  );

  useEffect(() => {
    if (drag.kind !== 'pressing' && drag.kind !== 'lifted') return undefined;

    const handleMove = (e: PointerEvent): void => {
      const cur = dragRef.current;
      if (cur.kind !== 'lifted') return;
      const deltaX = e.clientX - cur.originClientX;
      const deltaY = e.clientY - cur.originClientY;
      const xy = pointerToBoardXY(e.clientX, e.clientY);
      const target = xy
        ? cellAt(xy.x, xy.y, { cellW, cellH, railW, headerH }, weeks)
        : null;
      setDrag({
        ...cur,
        deltaX,
        deltaY,
        targetCell: target,
      });
    };

    const handleUp = (): void => {
      const cur = dragRef.current;
      clearLiftTimer();
      if (cur.kind === 'pressing') {
        // Released before lift: a tap. Let the click handler do the work.
        setDrag({ kind: 'idle' });
        return;
      }
      if (cur.kind !== 'lifted') return;
      // Suppress the synthetic click that follows pointerup-on-card.
      suppressNextClick.current = true;
      if (cur.targetCell && onCardDrop) {
        onCardDrop(cur.cardId, cur.targetCell.week, cur.targetCell.day);
      }
      setDrag({ kind: 'snapping', cardId: cur.cardId });
      if (snapTimer.current !== null) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        snapTimer.current = null;
        setDrag({ kind: 'idle' });
      }, DRAG_SNAP_MS);
    };

    const handleCancel = (): void => {
      clearLiftTimer();
      setDrag({ kind: 'idle' });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return (): void => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [
    drag.kind,
    pointerToBoardXY,
    cellW,
    cellH,
    railW,
    headerH,
    weeks,
    onCardDrop,
    clearLiftTimer,
  ]);

  useEffect(() => {
    return (): void => {
      clearLiftTimer();
      if (snapTimer.current !== null) {
        clearTimeout(snapTimer.current);
        snapTimer.current = null;
      }
    };
  }, [clearLiftTimer]);
  // ─── End drag state machine ────────────────────────────────────────────

  const labels = weekLabels ?? computeWeekLabels(board.startMonday, weeks + 4);
  const labelsToUse = labels.length > 0 ? labels : DEFAULT_WEEK_LABELS;

  // Card visual scale tracks both dimensions so cards never overflow a cell.
  // CLAUDE.md §4 names `cellW/56` for shorthand; design/handoff/Build Spec.md
  // makes the constraint explicit: `min(cellW/56, cellH/38)`.
  const cardSize = Math.min(cellW / 56, cellH / 38);

  // Resolve each card's render position: cell centre + the deterministic
  // in-cell offset from stackOffsets(N) at its createdAt-sorted index.
  const cellGroups = new Map<string, CardModel[]>();
  for (const c of board.cards) {
    const key = `${String(c.week)}:${String(c.day)}`;
    const bucket = cellGroups.get(key) ?? [];
    bucket.push(c);
    cellGroups.set(key, bucket);
  }
  const positionById = new Map<CardId, { x: number; y: number }>();
  for (const [, group] of cellGroups) {
    group.sort((a, b) => a.createdAt - b.createdAt);
    const offsets = stackOffsets(group.length);
    group.forEach((c, i) => {
      const centre = cellCenter(c, { cellW, cellH, railW, headerH });
      const off = offsets[i] ?? { x: 0, y: 0 };
      positionById.set(c.id, { x: centre.x + off.x, y: centre.y + off.y });
    });
  }
  // While a card is lifted, override its position with origin + pointer delta
  // so both the card slot AND any attached threads follow the pointer live.
  if (drag.kind === 'lifted') {
    const base = positionById.get(drag.cardId);
    if (base) {
      positionById.set(drag.cardId, {
        x: base.x + drag.deltaX,
        y: base.y + drag.deltaY,
      });
    }
  }

  /**
   * v2: there is no wood frame. The cork is the outer board element and
   * carries both the inset hairline edge and the elevated drop shadow that
   * floats it above the page background.
   */
  const surfaceStyle: CSSProperties = {
    position: 'relative',
    width: W,
    height: H,
    background: CORK_TEXTURE_BG,
    backgroundSize: CORK_TEXTURE_SIZE,
    borderRadius: CORK_RADIUS,
    boxShadow: `${CORK_INSET_SHADOW}, ${BOARD_FLOAT_SHADOW}`,
    overflow: 'hidden',
  };

  return (
    <div data-testid="board-surface" ref={surfaceRef} style={surfaceStyle}>
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
        {Array.from({ length: DAYS_PER_WEEK + 1 }).map((_, i) => (
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

      {/* Day headers (Mon..Sun). Weekend muting is the ONLY weekend-specific styling. */}
      {DAY_HEADER_LABELS.map((label, i) => {
        const weekend = WEEKEND_SET.has(i);
        const cfg = weekend ? DAY_HEADER_BADGE.weekend : DAY_HEADER_BADGE.weekday;
        return (
          <div
            key={label}
            data-testid={`day-header-${label}`}
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
              fontSize: cfg.fontSize,
              color: '#3a2410',
              opacity: cfg.opacity,
              transform: `rotate(${String((rand() - 0.5) * 1.5)}deg)`,
            }}
          >
            <span
              data-testid={`day-header-badge-${label}`}
              style={{
                background: cfg.fill,
                padding: '2px 8px',
                borderRadius: 1.5,
                boxShadow: '0 1px 2px rgba(0,0,0,.18)',
              }}
            >
              {label}
            </span>
          </div>
        );
      })}

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
                pointerEvents: 'none',
              }}
            />
          );
        })}

      {/* Cell click overlay (Phase 3 — empty-cell clicks fire onCellClick).
          Cards render after this so their clicks take precedence. */}
      {onCellClick &&
        Array.from({ length: weeks }).flatMap((_, week) =>
          DAYS.map((day) => (
            <div
              key={`cell-${String(week)}-${String(day)}`}
              data-testid={`cell-${String(week)}-${String(day)}`}
              data-cell-week={week}
              data-cell-day={day}
              onClick={() => {
                onCellClick(week, day);
              }}
              style={{
                position: 'absolute',
                left: railW + day * cellW,
                top: headerH + week * cellH,
                width: cellW,
                height: cellH,
                cursor: 'cell',
                background: 'transparent',
              }}
            />
          )),
        )}

      {/* Drop-target highlight (visible during drag-lift). */}
      {drag.kind === 'lifted' && drag.targetCell && (
        <div
          data-testid="drop-target-highlight"
          data-target-week={drag.targetCell.week}
          data-target-day={drag.targetCell.day}
          aria-hidden
          style={{
            position: 'absolute',
            left: railW + drag.targetCell.day * cellW,
            top: headerH + drag.targetCell.week * cellH,
            width: cellW,
            height: cellH,
            background: 'rgba(255, 244, 220, 0.18)',
            outline: '1.5px dashed rgba(60, 30, 10, 0.4)',
            outlineOffset: -2,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}

      {/* Cards */}
      {board.cards
        .filter((c) => c.week >= 0 && c.week < weeks)
        .map((card) => {
          const pos = positionById.get(card.id);
          if (!pos) return null;
          const isLifted =
            (drag.kind === 'lifted' || drag.kind === 'pressing') &&
            drag.cardId === card.id;
          const isSnapping =
            drag.kind === 'snapping' && drag.cardId === card.id;
          const liftedVisual = drag.kind === 'lifted' && drag.cardId === card.id;

          const transformParts = ['translate(-50%, -50%)'];
          if (liftedVisual) {
            transformParts.push(
              `scale(${String(DRAG_LIFT_SCALE)})`,
              'rotate(0deg)',
            );
          }

          const onSlotClick = (e: React.MouseEvent): void => {
            if (suppressNextClick.current) {
              suppressNextClick.current = false;
              e.stopPropagation();
              return;
            }
            // Cmd/Ctrl-click on a stacked cell rotates the z-order.
            if ((e.metaKey || e.ctrlKey) && onCellCycle) {
              const inCell = board.cards.filter(
                (c) => c.week === card.week && c.day === card.day,
              );
              if (inCell.length > 1) {
                e.stopPropagation();
                onCellCycle(card.week, card.day);
                return;
              }
            }
            if (onCardClick) {
              e.stopPropagation();
              onCardClick(card.id);
            }
          };

          return (
            <div
              key={card.id}
              data-testid="card-slot"
              data-card-id={card.id}
              data-dragging={
                liftedVisual ? 'lifted' : isSnapping ? 'snapping' : null
              }
              onPointerDown={
                onCardDrop
                  ? (e): void => {
                      onCardPointerDown(e, card.id);
                    }
                  : undefined
              }
              onClick={onSlotClick}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                transform: transformParts.join(' '),
                transition: isSnapping
                  ? `transform ${String(DRAG_SNAP_MS)}ms ease-out`
                  : undefined,
                cursor:
                  onCardClick || onCardDrop
                    ? isLifted
                      ? 'grabbing'
                      : 'pointer'
                    : 'default',
                zIndex: liftedVisual ? 1000 : card.z,
                boxShadow: liftedVisual ? DRAG_LIFT_SHADOW : undefined,
                touchAction: onCardDrop ? 'none' : undefined,
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
            const pa = positionById.get(thread.fromCardId);
            const pb = positionById.get(thread.toCardId);
            if (!pa || !pb) return null;
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

      {/* Edit popover positioned beneath the editing card. */}
      {popoverForCard !== undefined &&
        popover !== undefined &&
        (() => {
          const pos = positionById.get(popoverForCard);
          if (!pos) return null;
          const topRaw = pos.y + cellH / 2 + POPOVER_GAP;
          const leftRaw = pos.x - POPOVER_WIDTH / 2;
          const left = Math.max(
            4,
            Math.min(W - POPOVER_WIDTH - 4, leftRaw),
          );
          return (
            <div
              data-testid="popover-anchor"
              style={{
                position: 'absolute',
                top: topRaw,
                left,
                zIndex: 30,
              }}
            >
              {popover}
            </div>
          );
        })()}
    </div>
  );
}

export { BOARD_FIXED_METRICS };
