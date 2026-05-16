import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { addCard, createBoard, moveCard } from '../../../src/domain/board';
import { DAYS } from '../../../src/domain/types';

describe('domain/board — moveCard property test (BUILD_PLAN.md Phase 1 quality gate)', () => {
  it('any sequence of moves preserves id, rotation, and pin', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 52 }),
        fc.array(
          fc.record({
            week: fc.integer({ min: 0, max: 51 }),
            day: fc.constantFrom(...DAYS),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (boardWeeks, moves) => {
          const base = createBoard({
            startMonday: '2026-05-18',
            weeks: boardWeeks,
          });
          const { board: b0, cardId } = addCard(base, {
            week: 0,
            day: 0,
          });
          const original = b0.cards[0];
          if (!original) throw new Error('seed card missing');

          let current = b0;
          for (const m of moves) {
            const w = m.week % boardWeeks;
            current = moveCard(current, cardId, { week: w, day: m.day });
          }

          const final = current.cards[0];
          expect(final?.id).toBe(original.id);
          expect(final?.rotation).toBe(original.rotation);
          expect(final?.pin).toBe(original.pin);
          expect(final?.color).toBe(original.color);
          expect(final?.text).toBe(original.text);
        },
      ),
      { numRuns: 200 },
    );
  });
});
