import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addCard,
  deleteCard,
  updateCard,
} from '../domain/board';
import type { Clock } from '../domain/clock';
import type {
  Board,
  Card,
  CardId,
  Color,
  Day,
  Week,
} from '../domain/types';
import type { BoardRepository } from '../persistence/repository';

export const DEFAULT_DEBOUNCE_MS = 250;

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

export type UseBoardEditorOptions = {
  repository: BoardRepository;
  slug: string;
  clock: Clock;
  debounceMs?: number;
};

export type UseBoardEditorResult = {
  board: Board | null;
  editor: EditorState;
  beginNew: (week: Week, day: Day) => void;
  beginEdit: (cardId: CardId) => void;
  setEditingText: (text: string) => void;
  setEditingColor: (color: Color) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  deleteEditing: () => void;
};

/**
 * Owns the board state, the editor state, and the debounced repository write.
 * Components do not call `localStorage` or the repository directly — every
 * persisted mutation flows through here.
 */
export function useBoardEditor(
  options: UseBoardEditorOptions,
): UseBoardEditorResult {
  const { repository, slug, clock } = options;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const [board, setBoard] = useState<Board | null>(null);
  const [editor, setEditor] = useState<EditorState>({ kind: 'idle' });

  // Mirror the latest editor + board in refs so action callbacks read fresh
  // values without depending on state in their dep arrays. Effects sync after
  // every commit; handlers fire post-commit so they always read fresh values.
  const editorRef = useRef<EditorState>(editor);
  const boardRef = useRef<Board | null>(board);
  useEffect(() => {
    editorRef.current = editor;
    boardRef.current = board;
  });

  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest board the timer should persist when it fires; the setTimeout
  // closure can't read the live state directly.
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

  // Initial load. Re-runs if slug/repository change.
  useEffect(() => {
    let cancelled = false;
    void repository.load(slug).then((loaded) => {
      if (cancelled) return;
      boardRef.current = loaded;
      setBoard(loaded);
    });
    return (): void => {
      cancelled = true;
    };
  }, [repository, slug]);

  // Flush any pending save on unmount so we don't drop the user's last keystroke.
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

  const beginNew = useCallback(
    (week: Week, day: Day) => {
      const current = boardRef.current;
      if (current === null) return;
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
      scheduleSave(next);
    },
    [clock, commit, scheduleSave],
  );

  const beginEdit = useCallback((cardId: CardId) => {
    const current = boardRef.current;
    if (current === null) return;
    const card = current.cards.find((c) => c.id === cardId);
    if (!card) return;
    const editing: EditorState = {
      kind: 'editing',
      cardId,
      isNew: false,
      original: card,
    };
    editorRef.current = editing;
    setEditor(editing);
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

  const commitEdit = useCallback(() => {
    editorRef.current = { kind: 'idle' };
    setEditor({ kind: 'idle' });
  }, []);

  const cancelEdit = useCallback(() => {
    const ed = editorRef.current;
    const current = boardRef.current;
    if (ed.kind !== 'editing' || current === null) return;

    if (ed.isNew) {
      cancelPendingSave();
      const next = deleteCard(current, ed.cardId);
      commit(next);
      editorRef.current = { kind: 'idle' };
      setEditor({ kind: 'idle' });
      return;
    }

    if (ed.original !== null) {
      const next = updateCard(
        current,
        ed.cardId,
        { text: ed.original.text, color: ed.original.color },
        { clock },
      );
      commit(next);
      scheduleSave(next);
    }
    editorRef.current = { kind: 'idle' };
    setEditor({ kind: 'idle' });
  }, [cancelPendingSave, clock, commit, scheduleSave]);

  const deleteEditing = useCallback(() => {
    const ed = editorRef.current;
    const current = boardRef.current;
    if (ed.kind !== 'editing' || current === null) return;
    const next = deleteCard(current, ed.cardId);
    commit(next);
    scheduleSave(next);
    editorRef.current = { kind: 'idle' };
    setEditor({ kind: 'idle' });
  }, [commit, scheduleSave]);

  return {
    board,
    editor,
    beginNew,
    beginEdit,
    setEditingText,
    setEditingColor,
    commitEdit,
    cancelEdit,
    deleteEditing,
  };
}
