import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addCard,
  addThread,
  deleteCard,
  deleteThread,
  moveCard,
  resizeWeeks,
  updateCard,
} from '../domain/board';
import { cycleStack } from '../domain/stacking';
import type { Clock } from '../domain/clock';
import type {
  Board,
  Card,
  CardId,
  Color,
  Day,
  ThreadId,
  Week,
} from '../domain/types';
import { DAYS } from '../domain/types';
import { MAX_WEEKS, MIN_WEEKS, clampWeeks } from '../domain/weeks';
import { mergeBoardFromIncoming } from '../persistence/lww';
import type { BoardRepository } from '../persistence/repository';
import { History } from './history';

export const DEFAULT_DEBOUNCE_MS = 250;
export const HISTORY_CAPACITY = 50;

export type EditorState =
  | { kind: 'idle' }
  | {
      kind: 'editing';
      cardId: CardId;
      /** True when the card was just created via the popover (Esc removes it). */
      isNew: boolean;
      /** Snapshot of the card at the moment editing began; used to revert on Esc. */
      original: Card | null;
    };

export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

export type PendingResize = {
  weeks: number;
  cutCardIds: readonly CardId[];
};

export type UseBoardEditorOptions = {
  repository: BoardRepository;
  slug: string;
  clock: Clock;
  debounceMs?: number;
  historyCapacity?: number;
};

export type UseBoardEditorResult = {
  board: Board | null;
  editor: EditorState;
  selectedCardId: CardId | null;
  pendingResize: PendingResize | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Test/diagnostic: current size of the undo stack. */
  undoStackSize: number;

  beginNew: (week: Week, day: Day) => void;
  beginEdit: (cardId: CardId) => void;
  setEditingText: (text: string) => void;
  setEditingColor: (color: Color) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  deleteEditing: () => void;
  /**
   * Replace the board with the result of a remote-merge (10s poll → LWW).
   *
   * Unlike `commit`, this path:
   *   - does NOT push the previous board onto the undo stack
   *     (Cmd-Z must never roll back another user's edit), and
   *   - does NOT call `scheduleSave` (the change is already on the server
   *     as of `envelopeUpdatedAt`; re-writing it would overwrite fresher
   *     local writes that haven't been flushed yet).
   *
   * Pinned by tests/integration/remoteMerge.test.ts.
   */
  commitFromRemote: (next: Board) => void;
  /**
   * Run LWW merge of an incoming board (from a poll) against local state,
   * then commitFromRemote with the result. If a save is already queued,
   * update its pending board so the eventual PATCH carries the merge
   * (otherwise the pending save would overwrite remote adds).
   */
  mergeIncoming: (incomingBoard: Board, envelopeUpdatedAt: number) => void;
  /** Move a card to (week, day). Bumps updatedAt + assigns z. No-op if same cell. */
  moveCardTo: (cardId: CardId, week: Week, day: Day) => void;
  /** Rotate the z-order of cards in (week, day). No-op if 0 or 1 cards there. */
  cycleCellStack: (week: Week, day: Day) => void;
  /** Create a thread from one card to another. No-op on self-thread / duplicate. */
  createThread: (fromCardId: CardId, toCardId: CardId) => void;
  /** Delete a thread by id. No-op if the id is unknown. */
  deleteThreadById: (threadId: ThreadId) => void;

  // ── Phase 6 surface ────────────────────────────────────────────────
  selectCard: (cardId: CardId) => void;
  clearSelection: () => void;
  /** Move the selected card by one cell, clamped to board bounds. No-op if no selection. */
  nudgeSelected: (direction: NudgeDirection) => void;
  /** Delete the selected card (when no popover is active). No-op if no selection. */
  deleteSelected: () => void;

  undo: () => void;
  redo: () => void;

  /** Request a board resize. If shrink would cut cards, sets pendingResize for the UI. */
  requestResize: (weeks: number) => void;
  confirmPendingResize: () => void;
  cancelPendingResize: () => void;
};

/**
 * Owns the board state, the editor state, undo/redo history, selection, and
 * the debounced repository write. Components do not call `localStorage` or the
 * repository directly — every persisted mutation flows through here.
 *
 * Snapshot rule (Phase 6):
 *   - Non-editing actions (move / cycle / thread / nudge / delete-selected /
 *     resize) push the pre-mutation board onto the undo stack.
 *   - An editing session (beginEdit/beginNew → commitEdit/deleteEditing)
 *     pushes the pre-session board at most once, and only if the board
 *     actually changed by session end. Typing in the popover doesn't
 *     produce one undo per keystroke.
 *   - cancelEdit reverts in-place and pushes nothing.
 *   - undo / redo themselves do not push.
 */
export function useBoardEditor(
  options: UseBoardEditorOptions,
): UseBoardEditorResult {
  const { repository, slug, clock } = options;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const historyCapacity = options.historyCapacity ?? HISTORY_CAPACITY;

  const [board, setBoard] = useState<Board | null>(null);
  const [editor, setEditor] = useState<EditorState>({ kind: 'idle' });
  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);
  const [pendingResize, setPendingResize] = useState<PendingResize | null>(null);
  // History lives in a ref so it isn't recreated on every render. canUndo /
  // canRedo / undoStackSize are mirrored into state so render can read them
  // without accessing the ref's `current` (the React 19 compiler lint rule
  // `react-hooks/refs` rejects ref reads during render).
  const historyRef = useRef<History<Board>>(new History<Board>(historyCapacity));
  const [historyMeta, setHistoryMeta] = useState<{
    canUndo: boolean;
    canRedo: boolean;
    undoStackSize: number;
  }>({ canUndo: false, canRedo: false, undoStackSize: 0 });
  const bumpHistory = useCallback(() => {
    const h = historyRef.current;
    setHistoryMeta({
      canUndo: h.canUndo(),
      canRedo: h.canRedo(),
      undoStackSize: h.size().undo,
    });
  }, []);

  // Track whether the current editing session has already taken a snapshot,
  // and the board state at the moment editing began (for cancelEdit's revert).
  const sessionStartBoardRef = useRef<Board | null>(null);

  const editorRef = useRef<EditorState>(editor);
  const boardRef = useRef<Board | null>(board);
  const selectedCardIdRef = useRef<CardId | null>(selectedCardId);
  useEffect(() => {
    editorRef.current = editor;
    boardRef.current = board;
    selectedCardIdRef.current = selectedCardId;
  });

  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBoard = useRef<Board | null>(null);

  const cancelPendingSave = useCallback(() => {
    if (pendingSave.current !== null) {
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
    }
    pendingBoard.current = null;
  }, []);

  const scheduleSave = useCallback(
    (nextBoard: Board) => {
      pendingBoard.current = nextBoard;
      if (pendingSave.current !== null) {
        clearTimeout(pendingSave.current);
      }
      pendingSave.current = setTimeout(() => {
        const toSave = pendingBoard.current;
        pendingSave.current = null;
        pendingBoard.current = null;
        if (toSave !== null) {
          void repository.save(slug, toSave);
        }
      }, debounceMs);
    },
    [repository, slug, debounceMs],
  );

  const commit = useCallback((next: Board) => {
    boardRef.current = next;
    setBoard(next);
  }, []);

  const commitFromRemote = useCallback((next: Board) => {
    // Replace the board WITHOUT pushing onto undo and WITHOUT scheduling a
    // save. The merge result is already what the server holds; pushing
    // undo would let Cmd-Z roll back a collaborator's edit (wrong UX), and
    // saving would overwrite any locally-unflushed writes with the older
    // server snapshot.
    boardRef.current = next;
    setBoard(next);
  }, []);

  const mergeIncoming = useCallback(
    (incomingBoard: Board, envelopeUpdatedAt: number) => {
      const current = boardRef.current;
      if (current === null) return;
      const merged = mergeBoardFromIncoming({
        local: current,
        incoming: incomingBoard,
        envelopeUpdatedAt,
      });
      if (merged === current) return;
      // commitFromRemote without restarting the save timer.
      boardRef.current = merged;
      setBoard(merged);
      // If a save is queued (the user mutated locally before this poll
      // arrived), make sure the pending PATCH carries the merge result —
      // otherwise it would overwrite any remote-adds the merge folded in.
      if (pendingBoard.current !== null) {
        pendingBoard.current = merged;
      }
    },
    [],
  );

  const pushUndo = useCallback(
    (snapshot: Board) => {
      historyRef.current.push(snapshot);
      bumpHistory();
    },
    [bumpHistory],
  );

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    repository.load(slug).then(
      (loaded) => {
        if (cancelled) return;
        boardRef.current = loaded;
        setBoard(loaded);
      },
      () => {
        // Network failures / decrypt failures here mean we either lost the
        // server (test teardown, transient) or the user's key drifted. The
        // 10s poll will recover on a transient; nothing to do but swallow.
      },
    );
    return (): void => {
      cancelled = true;
    };
  }, [repository, slug]);

  // Flush any pending save on unmount.
  useEffect(() => {
    return (): void => {
      if (pendingSave.current !== null && pendingBoard.current !== null) {
        clearTimeout(pendingSave.current);
        const toSave = pendingBoard.current;
        pendingSave.current = null;
        pendingBoard.current = null;
        void repository.save(slug, toSave);
      }
    };
  }, [repository, slug]);

  // ─── Editing-session actions ────────────────────────────────────────
  const beginNew = useCallback(
    (week: Week, day: Day) => {
      const current = boardRef.current;
      if (current === null) return;
      sessionStartBoardRef.current = current;
      const { board: next, cardId } = addCard(current, {
        week,
        day,
        clock,
      });
      commit(next);
      const editing: EditorState = {
        kind: 'editing',
        cardId,
        isNew: true,
        original: null,
      };
      editorRef.current = editing;
      setEditor(editing);
      setSelectedCardId(cardId);
      scheduleSave(next);
    },
    [clock, commit, scheduleSave],
  );

  const beginEdit = useCallback((cardId: CardId) => {
    const current = boardRef.current;
    if (current === null) return;
    const card = current.cards.find((c) => c.id === cardId);
    if (!card) return;
    sessionStartBoardRef.current = current;
    const editing: EditorState = {
      kind: 'editing',
      cardId,
      isNew: false,
      original: card,
    };
    editorRef.current = editing;
    setEditor(editing);
    setSelectedCardId(cardId);
  }, []);

  const setEditingText = useCallback(
    (text: string) => {
      const ed = editorRef.current;
      const current = boardRef.current;
      if (ed.kind !== 'editing' || current === null) return;
      const next = updateCard(current, ed.cardId, { text }, { clock });
      commit(next);
      scheduleSave(next);
    },
    [clock, commit, scheduleSave],
  );

  const setEditingColor = useCallback(
    (color: Color) => {
      const ed = editorRef.current;
      const current = boardRef.current;
      if (ed.kind !== 'editing' || current === null) return;
      const next = updateCard(current, ed.cardId, { color }, { clock });
      commit(next);
      scheduleSave(next);
    },
    [clock, commit, scheduleSave],
  );

  /** Push the session-start snapshot iff the board changed during the session. */
  const endEditingSessionWithSnapshot = useCallback(() => {
    const start = sessionStartBoardRef.current;
    const current = boardRef.current;
    sessionStartBoardRef.current = null;
    if (start !== null && current !== null && start !== current) {
      pushUndo(start);
    }
  }, [pushUndo]);

  const commitEdit = useCallback(() => {
    endEditingSessionWithSnapshot();
    editorRef.current = { kind: 'idle' };
    setEditor({ kind: 'idle' });
  }, [endEditingSessionWithSnapshot]);

  const cancelEdit = useCallback(() => {
    const ed = editorRef.current;
    const start = sessionStartBoardRef.current;
    if (ed.kind !== 'editing') return;

    // Revert to the session-start board in-place. cancelEdit never pushes.
    if (ed.isNew) {
      cancelPendingSave();
    }
    if (start !== null) {
      commit(start);
      // If this was a real edit on an existing card, persist the revert so the
      // user's reload doesn't show the abandoned in-progress text.
      if (!ed.isNew) {
        scheduleSave(start);
      }
    }
    sessionStartBoardRef.current = null;
    editorRef.current = { kind: 'idle' };
    setEditor({ kind: 'idle' });
    if (ed.isNew) {
      // Don't keep the just-removed card selected.
      setSelectedCardId(null);
    }
  }, [cancelPendingSave, commit, scheduleSave]);

  const deleteEditing = useCallback(() => {
    const ed = editorRef.current;
    const current = boardRef.current;
    if (ed.kind !== 'editing' || current === null) return;
    const next = deleteCard(current, ed.cardId);
    commit(next);
    scheduleSave(next);
    // The deletion ends the session; push the pre-session snapshot.
    endEditingSessionWithSnapshot();
    editorRef.current = { kind: 'idle' };
    setEditor({ kind: 'idle' });
    setSelectedCardId(null);
  }, [commit, endEditingSessionWithSnapshot, scheduleSave]);

  // ─── Non-editing mutations ──────────────────────────────────────────
  const moveCardTo = useCallback(
    (cardId: CardId, week: Week, day: Day) => {
      const current = boardRef.current;
      if (current === null) return;
      const next = moveCard(current, cardId, { week, day }, { clock });
      if (next === current) return;
      pushUndo(current);
      commit(next);
      scheduleSave(next);
    },
    [clock, commit, pushUndo, scheduleSave],
  );

  const cycleCellStack = useCallback(
    (week: Week, day: Day) => {
      const current = boardRef.current;
      if (current === null) return;
      const next = cycleStack(current, week, day, { clock });
      if (next === current) return;
      pushUndo(current);
      commit(next);
      scheduleSave(next);
    },
    [clock, commit, pushUndo, scheduleSave],
  );

  const createThread = useCallback(
    (fromCardId: CardId, toCardId: CardId) => {
      const current = boardRef.current;
      if (current === null) return;
      if (fromCardId === toCardId) return;
      const exists = current.threads.some(
        (t) =>
          (t.fromCardId === fromCardId && t.toCardId === toCardId) ||
          (t.fromCardId === toCardId && t.toCardId === fromCardId),
      );
      if (exists) return;
      const next = addThread(current, { fromCardId, toCardId });
      pushUndo(current);
      commit(next.board);
      scheduleSave(next.board);
    },
    [commit, pushUndo, scheduleSave],
  );

  const deleteThreadById = useCallback(
    (threadId: ThreadId) => {
      const current = boardRef.current;
      if (current === null) return;
      if (!current.threads.some((t) => t.id === threadId)) return;
      const next = deleteThread(current, threadId);
      pushUndo(current);
      commit(next);
      scheduleSave(next);
    },
    [commit, pushUndo, scheduleSave],
  );

  // ─── Selection + keyboard-driven mutations ─────────────────────────
  const selectCard = useCallback((cardId: CardId) => {
    setSelectedCardId(cardId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCardId(null);
  }, []);

  const nudgeSelected = useCallback(
    (direction: NudgeDirection) => {
      const current = boardRef.current;
      if (current === null) return;
      const id = selectedCardIdRef.current;
      if (id === null) return;
      const card = current.cards.find((c) => c.id === id);
      if (!card) return;
      let nextWeek = card.week;
      let nextDay: number = card.day;
      if (direction === 'up') nextWeek -= 1;
      else if (direction === 'down') nextWeek += 1;
      else if (direction === 'left') nextDay -= 1;
      else if (direction === 'right') nextDay += 1;
      // Clamp to board bounds.
      if (nextWeek < 0) nextWeek = 0;
      if (nextWeek > current.weeks - 1) nextWeek = current.weeks - 1;
      if (nextDay < 0) nextDay = 0;
      if (nextDay > DAYS.length - 1) nextDay = DAYS.length - 1;
      if (nextWeek === card.week && nextDay === card.day) return;
      const next = moveCard(
        current,
        id,
        { week: nextWeek, day: nextDay as Day },
        { clock },
      );
      if (next === current) return;
      pushUndo(current);
      commit(next);
      scheduleSave(next);
    },
    [clock, commit, pushUndo, scheduleSave],
  );

  const deleteSelected = useCallback(() => {
    const current = boardRef.current;
    if (current === null) return;
    const id = selectedCardIdRef.current;
    if (id === null) return;
    if (!current.cards.some((c) => c.id === id)) return;
    const next = deleteCard(current, id);
    pushUndo(current);
    commit(next);
    scheduleSave(next);
    setSelectedCardId(null);
  }, [commit, pushUndo, scheduleSave]);

  // ─── Undo / redo ────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const current = boardRef.current;
    if (current === null) return;
    const restored = historyRef.current.undo(current);
    if (restored === null) return;
    commit(restored);
    scheduleSave(restored);
    bumpHistory();
  }, [bumpHistory, commit, scheduleSave]);

  const redo = useCallback(() => {
    const current = boardRef.current;
    if (current === null) return;
    const restored = historyRef.current.redo(current);
    if (restored === null) return;
    commit(restored);
    scheduleSave(restored);
    bumpHistory();
  }, [bumpHistory, commit, scheduleSave]);

  // ─── Resize ─────────────────────────────────────────────────────────
  const requestResize = useCallback(
    (weeksRaw: number) => {
      const current = boardRef.current;
      if (current === null) return;
      const target = clampWeeks(weeksRaw);
      if (target === current.weeks) {
        setPendingResize(null);
        return;
      }
      // Shrink: any card with week >= target would be cut.
      if (target < current.weeks) {
        const cutCardIds = current.cards
          .filter((c) => c.week >= target)
          .map((c) => c.id);
        if (cutCardIds.length > 0) {
          setPendingResize({ weeks: target, cutCardIds });
          return;
        }
      }
      // Safe — commit immediately.
      const { board: next } = resizeWeeks(current, target);
      pushUndo(current);
      commit(next);
      scheduleSave(next);
      setPendingResize(null);
    },
    [commit, pushUndo, scheduleSave],
  );

  const confirmPendingResize = useCallback(() => {
    const current = boardRef.current;
    const p = pendingResize;
    if (current === null || p === null) return;
    const { board: next } = resizeWeeks(current, p.weeks);
    pushUndo(current);
    commit(next);
    scheduleSave(next);
    setPendingResize(null);
  }, [commit, pendingResize, pushUndo, scheduleSave]);

  const cancelPendingResizeAction = useCallback(() => {
    setPendingResize(null);
  }, []);

  void MIN_WEEKS;
  void MAX_WEEKS;

  return {
    board,
    editor,
    selectedCardId,
    pendingResize,
    canUndo: historyMeta.canUndo,
    canRedo: historyMeta.canRedo,
    undoStackSize: historyMeta.undoStackSize,

    beginNew,
    beginEdit,
    setEditingText,
    setEditingColor,
    commitEdit,
    cancelEdit,
    deleteEditing,
    commitFromRemote,
    mergeIncoming,
    moveCardTo,
    cycleCellStack,
    createThread,
    deleteThreadById,

    selectCard,
    clearSelection,
    nudgeSelected,
    deleteSelected,
    undo,
    redo,
    requestResize,
    confirmPendingResize,
    cancelPendingResize: cancelPendingResizeAction,
  };
}
