import { describe, it, expect } from 'vitest';
import { isMarker } from '../../../src/domain/marker';

describe('domain/marker — isMarker (TDD step 15, CLAUDE.md §4 + invariant 5)', () => {
  it("'BLOCK' → true", () => {
    expect(isMarker('BLOCK')).toBe(true);
  });

  it("'Block' → false (mixed case opts out)", () => {
    expect(isMarker('Block')).toBe(false);
  });

  it("'B&L' → true (& is in the allowed alphabet)", () => {
    expect(isMarker('B&L')).toBe(true);
  });

  it("'A' → false (single character is below the 2-char minimum)", () => {
    expect(isMarker('A')).toBe(false);
  });

  it("'A+B' → true (+ is in the allowed alphabet)", () => {
    expect(isMarker('A+B')).toBe(true);
  });

  it("empty string → false", () => {
    expect(isMarker('')).toBe(false);
  });

  it("'BLOCK!' → false (! is outside the allowed alphabet)", () => {
    expect(isMarker('BLOCK!')).toBe(false);
  });

  it("'DRESS + LIGHT' → true (spaces allowed)", () => {
    expect(isMarker('DRESS + LIGHT')).toBe(true);
  });

  it("lowercase letters reject regardless of position", () => {
    expect(isMarker('Hello WORLD')).toBe(false);
  });
});
