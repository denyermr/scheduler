import { describe, expect, it } from 'vitest';
import { History } from '../../../src/state/history';

describe('History<T>', () => {
  it('starts empty: canUndo / canRedo are false', () => {
    const h = new History<number>();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it('push adds a snapshot to the undo stack and clears redo', () => {
    const h = new History<number>();
    h.push(1);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it('undo pops the most recent snapshot and pushes `current` onto redo', () => {
    const h = new History<number>();
    h.push(1);
    h.push(2);
    // current state when the user invokes undo is 3
    const restored = h.undo(3);
    expect(restored).toBe(2);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(true);
    const restored2 = h.undo(2);
    expect(restored2).toBe(1);
  });

  it('undo on empty stack returns null', () => {
    const h = new History<number>();
    expect(h.undo(99)).toBeNull();
  });

  it('redo pops the most recent redo and pushes `current` back onto undo', () => {
    const h = new History<number>();
    h.push(1);
    const undone = h.undo(2);
    expect(undone).toBe(1);
    const redone = h.redo(1);
    expect(redone).toBe(2);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it('redo on empty stack returns null', () => {
    const h = new History<number>();
    expect(h.redo(99)).toBeNull();
  });

  it('a fresh push clears the redo stack', () => {
    const h = new History<number>();
    h.push(1);
    h.push(2);
    h.undo(3);
    expect(h.canRedo()).toBe(true);
    h.push(3);
    expect(h.canRedo()).toBe(false);
  });

  it('capacity bounds the undo stack — oldest snapshot dropped on overflow', () => {
    const h = new History<number>(3);
    h.push(1);
    h.push(2);
    h.push(3);
    h.push(4);
    // Undo three times: should see 4, 3, 2 (1 was dropped to fit cap=3).
    expect(h.undo(5)).toBe(4);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBeNull();
  });

  it('default capacity is 50', () => {
    const h = new History<number>();
    for (let i = 0; i < 60; i++) h.push(i);
    // 60 pushes with cap 50 → oldest 10 dropped → undo can pop 50 times.
    for (let i = 59; i >= 10; i--) {
      const r = h.undo(i + 1);
      expect(r).toBe(i);
    }
    expect(h.undo(0)).toBeNull();
  });

  it('redo capacity also bounded', () => {
    const h = new History<number>(2);
    h.push(0);
    h.push(1);
    h.push(2);
    // Undo three times — but cap=2 means only 2 entries on each stack.
    // undo stack at this point has [1, 2] (0 was dropped).
    h.undo(3); // pop 2, redo = [3], undo = [1]
    h.undo(2); // pop 1, redo = [3, 2], undo = []
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
  });
});
