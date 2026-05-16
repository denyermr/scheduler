import { describe, it, expect } from 'vitest';
import { randomPin, randomRotation } from '../../../src/domain/random';
import { PIN_COLORS } from '../../../src/domain/types';

describe('domain/random — randomPin', () => {
  it('returns a value from PIN_COLORS for any rng output', () => {
    for (let i = 0; i < 100; i++) {
      const pin = randomPin();
      expect(PIN_COLORS).toContain(pin);
    }
  });

  it('is deterministic when seeded — same rng gives same pin', () => {
    const seeded = (): number => 0.42;
    expect(randomPin(seeded)).toBe(randomPin(seeded));
  });

  it('reaches every pin color across the [0,1) range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < PIN_COLORS.length; i++) {
      const v = i / PIN_COLORS.length;
      seen.add(randomPin(() => v));
    }
    expect(seen.size).toBe(PIN_COLORS.length);
  });

  it('handles the rng() === 0 edge', () => {
    expect(PIN_COLORS).toContain(randomPin(() => 0));
  });

  it('handles the near-1 edge by wrapping into a valid index', () => {
    expect(PIN_COLORS).toContain(randomPin(() => 0.999999));
  });
});

describe('domain/random — randomRotation', () => {
  it('returns a value in [-2, 2)', () => {
    for (let i = 0; i < 200; i++) {
      const r = randomRotation();
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(2);
    }
  });

  it('is deterministic when seeded', () => {
    const seeded = (): number => 0.5;
    expect(randomRotation(seeded)).toBe(0);
  });

  it('maps rng 0 → -2 and near-1 → near +2', () => {
    expect(randomRotation(() => 0)).toBe(-2);
    expect(randomRotation(() => 0.9999)).toBeCloseTo(2, 2);
  });
});
