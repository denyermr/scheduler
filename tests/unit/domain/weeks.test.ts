import { describe, it, expect } from 'vitest';
import {
  clampWeeks,
  DEFAULT_WEEKS,
  MAX_WEEKS,
  MIN_WEEKS,
} from '../../../src/domain/weeks';

describe('domain/weeks', () => {
  it('exposes the 4 / 52 / 26 constants from CLAUDE.md §4', () => {
    expect(MIN_WEEKS).toBe(4);
    expect(MAX_WEEKS).toBe(52);
    expect(DEFAULT_WEEKS).toBe(26);
  });

  it('clampWeeks passes a value already in range through unchanged', () => {
    expect(clampWeeks(26)).toBe(26);
    expect(clampWeeks(4)).toBe(4);
    expect(clampWeeks(52)).toBe(52);
  });

  it('clampWeeks clamps below MIN to MIN', () => {
    expect(clampWeeks(0)).toBe(MIN_WEEKS);
    expect(clampWeeks(-10)).toBe(MIN_WEEKS);
  });

  it('clampWeeks clamps above MAX to MAX', () => {
    expect(clampWeeks(60)).toBe(MAX_WEEKS);
    expect(clampWeeks(1_000_000)).toBe(MAX_WEEKS);
  });

  it('clampWeeks floors fractional values', () => {
    expect(clampWeeks(26.9)).toBe(26);
  });

  it('clampWeeks returns DEFAULT_WEEKS for non-finite input', () => {
    expect(clampWeeks(Number.NaN)).toBe(DEFAULT_WEEKS);
    expect(clampWeeks(Number.POSITIVE_INFINITY)).toBe(DEFAULT_WEEKS);
    expect(clampWeeks(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_WEEKS);
  });
});
