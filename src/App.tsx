import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Clock } from './domain/clock';
import { Board } from './ui/Board';
import { EditPopover } from './ui/EditPopover';
import {
  FONTS,
  PAGE_BG,
  URL_CHIP_BRIGHT,
  URL_CHIP_DIM,
} from './ui/tokens';
import {
  DEMO_SLUG,
  LocalStorageRepository,
} from './persistence/localStorage';
import type { BoardRepository } from './persistence/repository';
import { useBoardEditor } from './state/useBoardEditor';

const DEFAULT_CONTAINER_WIDTH = 1440;
// Production-side wall clock. The domain stays pure: it never calls Date.now()
// directly; App injects the real clock here at the system boundary.
const realClock: Clock = () => Date.now();

function useContainerWidth(): {
  ref: React.RefObject<HTMLDivElement>;
  width: number;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_CONTAINER_WIDTH);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      setWidth(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return (): void => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return (): void => ro.disconnect();
  }, []);

  return { ref, width };
}

export type AppProps = {
  repository?: BoardRepository;
  slug?: string;
  clock?: Clock;
  debounceMs?: number;
  /** Pin the container width — bypasses the ResizeObserver. Used by tests
   * where jsdom has no layout, so `clientWidth` would collapse to 0. */
  containerWidth?: number;
};

export function App({
  repository: repositoryProp,
  slug = DEMO_SLUG,
  clock = realClock,
  debounceMs,
  containerWidth: containerWidthOverride,
}: AppProps = {}) {
  const repository = useMemo<BoardRepository>(
    () => repositoryProp ?? new LocalStorageRepository(),
    [repositoryProp],
  );
  const {
    board,
    editor,
    beginNew,
    beginEdit,
    setEditingText,
    setEditingColor,
    commitEdit,
    cancelEdit,
    deleteEditing,
    moveCardTo,
    cycleCellStack,
    createThread,
    deleteThreadById,
  } = useBoardEditor({ repository, slug, clock, debounceMs });
  const { ref: stageRef, width: measuredWidth } = useContainerWidth();
  const stageWidth = containerWidthOverride ?? measuredWidth;

  const editingCard =
    editor.kind === 'editing' && board !== null
      ? board.cards.find((c) => c.id === editor.cardId)
      : undefined;

  return (
    <main
      data-testid="page"
      style={{
        flex: 1,
        minHeight: '100vh',
        backgroundImage: PAGE_BG,
        backgroundColor: '#eef0f4',
        padding: '24px 28px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          <span
            data-testid="url-chip-dim"
            style={{ color: URL_CHIP_DIM, opacity: 0.7 }}
          >
            scheduleboard.app /{' '}
          </span>
          <span
            data-testid="url-chip-bright"
            style={{ fontFamily: FONTS.mono, color: URL_CHIP_BRIGHT }}
          >
            {slug}
          </span>
        </div>
        {/* Toolbar lands in Phase 6 — placeholder reserves the row height. */}
        <div
          data-testid="toolbar-placeholder"
          aria-hidden
          style={{ width: 1, height: 36 }}
        />
      </header>
      <div
        ref={stageRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        {board && (
          <Board
            board={board}
            containerWidth={stageWidth}
            onCellClick={beginNew}
            onCardClick={beginEdit}
            onCardDrop={moveCardTo}
            onCellCycle={cycleCellStack}
            onThreadCreate={createThread}
            onThreadDelete={deleteThreadById}
            popoverForCard={
              editor.kind === 'editing' ? editor.cardId : undefined
            }
            popover={
              editingCard ? (
                <EditPopover
                  text={editingCard.text}
                  color={editingCard.color}
                  onTextChange={setEditingText}
                  onColorChange={setEditingColor}
                  onCommit={commitEdit}
                  onCancel={cancelEdit}
                  onDelete={deleteEditing}
                />
              ) : null
            }
          />
        )}
      </div>
    </main>
  );
}
