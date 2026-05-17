import { describe, expect, it } from 'vitest';
import {
  CELL_W_MAX,
  CELL_W_MIN,
  computeBoardMetrics,
  DAY_HEADER_LABELS,
  WEEKEND_DAY_INDICES,
} from '../../../src/ui/tokens';

describe('computeBoardMetrics (Amendment B fluid sizing)', () => {
  it('exposes the canonical bounds', () => {
    expect(CELL_W_MIN).toBe(120);
    expect(CELL_W_MAX).toBe(180);
  });

  it('at containerWidth = 1440, computed cellW is inside [120, 180]', () => {
    const m = computeBoardMetrics(1440);
    expect(m.cellW).toBeGreaterThanOrEqual(120);
    expect(m.cellW).toBeLessThanOrEqual(180);
  });

  it('at containerWidth = 600, computed cellW equals 120 (clamp floor)', () => {
    expect(computeBoardMetrics(600).cellW).toBe(120);
  });

  it('at containerWidth = 4000, computed cellW equals 180 (clamp ceiling)', () => {
    expect(computeBoardMetrics(4000).cellW).toBe(180);
  });

  it('uses the exact formula clamp(120, (containerWidth - railW - margin) / 7, 180)', () => {
    // 64 (rail) + 48 (margin) = 112; (1232 - 112) / 7 = 160 exactly.
    expect(computeBoardMetrics(1232).cellW).toBe(160);
  });

  it('cellH is round(cellW * 0.55)', () => {
    const m = computeBoardMetrics(1232);
    expect(m.cellW).toBe(160);
    expect(m.cellH).toBe(88); // round(160 * 0.55) = 88
  });

  it('exposes rail = 64 and header = 32 by default', () => {
    const m = computeBoardMetrics(1440);
    expect(m.railW).toBe(64);
    expect(m.headerH).toBe(32);
  });
});

describe('day-header constants', () => {
  it('exports 7 day labels in Mon..Sun order', () => {
    expect(DAY_HEADER_LABELS).toEqual([
      'MON',
      'TUES',
      'WED',
      'THURS',
      'FRI',
      'SAT',
      'SUN',
    ]);
  });

  it('marks day indices 5 and 6 as weekend (and only those two)', () => {
    expect(WEEKEND_DAY_INDICES).toEqual([5, 6]);
  });
});
