import { describe, it, expect } from 'vitest';
import { cardId, threadId } from '../../../src/domain/ids';

function seq(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('domain/ids', () => {
  it('cardId returns an opaque id of shape card_<8 hex> (TDD step 1)', () => {
    const id = cardId();
    expect(id).toMatch(/^card_[0-9a-f]{8}$/);
  });

  it('threadId returns an opaque id of shape thread_<8 hex>', () => {
    const id = threadId();
    expect(id).toMatch(/^thread_[0-9a-f]{8}$/);
  });

  it('cardId is seedable for tests — same rng produces same id', () => {
    const a = cardId(seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]));
    const b = cardId(seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]));
    expect(a).toBe(b);
  });

  it('cardId produces enough variety from Math.random to be effectively unique', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(cardId());
    expect(ids.size).toBe(200);
  });

  it('threadId is seedable for tests', () => {
    const a = threadId(seq([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]));
    const b = threadId(seq([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]));
    expect(a).toBe(b);
  });
});
