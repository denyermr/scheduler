import { describe, it, expect } from 'vitest';
import { CARD_COLORS, DAYS, PIN_COLORS } from '../../src/domain/types';

describe('domain/types', () => {
  it('exports the 8 card colors per CLAUDE.md §4', () => {
    expect(CARD_COLORS).toEqual([
      'peach',
      'coral',
      'orange',
      'salmon',
      'yellow',
      'mint',
      'sky',
      'lilac',
    ]);
  });

  it('exports the 5 pin colors per CLAUDE.md §4', () => {
    expect(PIN_COLORS).toEqual([
      '#d6463a',
      '#e9b834',
      '#3a7ed6',
      '#3aa15a',
      '#f5f1e6',
    ]);
  });

  it('Mon–Sun — exactly 7 day indices (CLAUDE.md invariant 7, v2)', () => {
    expect(DAYS).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
