/**
 * Bounded undo/redo ring buffer for Phase 6.
 *
 * Each entry is a snapshot of `T`. Callers push the *pre-mutation* state
 * before applying a change, then call `undo(current)` to restore it
 * (the current state is moved onto the redo stack). A fresh push clears
 * the redo stack.
 *
 * Capacity defaults to 50 per CLAUDE.md §10 (Phase 6 stack cap). Both
 * stacks are bounded by the same capacity; oldest entries drop off the
 * bottom when full.
 */
export class History<T> {
  private readonly cap: number;
  private undoStack: T[] = [];
  private redoStack: T[] = [];

  constructor(capacity = 50) {
    this.cap = Math.max(1, Math.floor(capacity));
  }

  push(snapshot: T): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.cap) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /**
   * Move the most recent undo snapshot off the stack and onto redo.
   * Returns the snapshot the caller should restore. `current` is the
   * caller's live state, which is pushed onto redo so it can be re-applied.
   */
  undo(current: T): T | null {
    const top = this.undoStack.pop();
    if (top === undefined) return null;
    this.redoStack.push(current);
    if (this.redoStack.length > this.cap) {
      this.redoStack.shift();
    }
    return top;
  }

  redo(current: T): T | null {
    const top = this.redoStack.pop();
    if (top === undefined) return null;
    this.undoStack.push(current);
    if (this.undoStack.length > this.cap) {
      this.undoStack.shift();
    }
    return top;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Test/debug helpers — exposed for assertions, not for production callers. */
  size(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
