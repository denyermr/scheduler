import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Clock } from './domain/clock';
import { Board } from './ui/Board';
import { EditPopover } from './ui/EditPopover';
import { ResizeDialog } from './ui/ResizeDialog';
import { ShareDialog } from './ui/ShareDialog';
import { Toolbar } from './ui/Toolbar';
import {
  FONTS,
  PAGE_BG,
  URL_CHIP_BRIGHT,
  URL_CHIP_DIM,
} from './ui/tokens';
import { DEMO_SLUG } from './persistence/localStorage';
import { RemoteRepository } from './persistence/remote';
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
    () =>
      repositoryProp ??
      // Default to the remote backend at the same origin. The Vite dev server
      // proxies /b/* to the local Node server (see vite.config.ts); in prod
      // both share the same hostname under Phase 8.
      new RemoteRepository({ baseUrl: '' }),
    [repositoryProp],
  );
  const editorState = useBoardEditor({ repository, slug, clock, debounceMs });
  const {
    board,
    editor,
    selectedCardId,
    pendingResize,
    canUndo,
    canRedo,
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
    clearSelection,
    nudgeSelected,
    deleteSelected,
    undo,
    redo,
    mergeIncoming,
    requestResize,
    confirmPendingResize,
    cancelPendingResize,
  } = editorState;
  const [shareOpen, setShareOpen] = useState(false);

  // Subscribe the editor to remote-merge updates if the repository supports
  // polling (RemoteRepository does; InMemory / LocalStorage do not). Tests
  // that inject InMemoryRepository skip this branch.
  useEffect(() => {
    if (!(repository instanceof RemoteRepository)) return;
    return repository.subscribe(slug, mergeIncoming);
  }, [repository, slug, mergeIncoming]);

  useEffect(() => {
    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (target === null) return false;
      if (target instanceof HTMLInputElement) return true;
      if (target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLElement && target.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent): void => {
      // Suppress while a text input owns the keystroke. The popover's input,
      // for instance, must keep Enter/Esc/Backspace/arrows for itself.
      if (isTextInputTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        e.preventDefault();
        const dir =
          e.key === 'ArrowUp'
            ? 'up'
            : e.key === 'ArrowDown'
              ? 'down'
              : e.key === 'ArrowLeft'
                ? 'left'
                : 'right';
        nudgeSelected(dir);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return (): void => {
      window.removeEventListener('keydown', onKey);
    };
  }, [undo, redo, deleteSelected, nudgeSelected]);
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
        <div
          data-testid="toolbar-placeholder"
          style={{ position: 'relative', minWidth: 320, height: 36 }}
        >
          {board && (
            <Toolbar
              weeks={board.weeks}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onShare={() => {
                setShareOpen(true);
              }}
              onRequestResize={requestResize}
            />
          )}
        </div>
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
            selectedCardId={selectedCardId}
            onSurfaceClick={clearSelection}
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
      {pendingResize && (
        <ResizeDialog
          weeks={pendingResize.weeks}
          cutCount={pendingResize.cutCardIds.length}
          onConfirm={confirmPendingResize}
          onCancel={cancelPendingResize}
        />
      )}
      {shareOpen && board && (
        <ShareDialog
          url={`scheduleboard.app/b/${slug}`}
          cardCount={board.cards.filter((c) => c.week < board.weeks).length}
          threadCount={board.threads.length}
          onClose={() => {
            setShareOpen(false);
          }}
        />
      )}
    </main>
  );
}
