import { describe, expect, it } from 'vitest';
import { ADJECTIVES, NOUNS, generateSlug } from '../../../src/persistence/slug';

const SLUG_SHAPE = /^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{4}$/;

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('generateSlug', () => {
  it('returns the word-word-word-word-NNNN shape across 500 samples', () => {
    for (let i = 0; i < 500; i += 1) {
      const slug = generateSlug(seededRng(i + 1));
      expect(slug).toMatch(SLUG_SHAPE);
    }
  });

  it('is deterministic for a given rng', () => {
    const a = generateSlug(seededRng(42));
    const b = generateSlug(seededRng(42));
    expect(a).toBe(b);
  });

  it('defaults to Math.random when no rng is passed', () => {
    const slug = generateSlug();
    expect(slug).toMatch(SLUG_SHAPE);
  });

  it('produces different slugs across different seeds', () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      slugs.add(generateSlug(seededRng(i * 7919 + 1)));
    }
    // We don't claim global uniqueness, but with 100 independent seeds we
    // should see far more than a single value — a regression to "always
    // returns the same slug" would be obvious.
    expect(slugs.size).toBeGreaterThan(90);
  });
});

describe('word lists', () => {
  it('ADJECTIVES is non-trivially sized and all-lowercase a-z', () => {
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(200);
    for (const w of ADJECTIVES) {
      expect(w).toMatch(/^[a-z]+$/);
    }
  });

  it('NOUNS is non-trivially sized and all-lowercase a-z', () => {
    expect(NOUNS.length).toBeGreaterThanOrEqual(200);
    for (const w of NOUNS) {
      expect(w).toMatch(/^[a-z]+$/);
    }
  });

  it('lists contain no duplicates within themselves', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length);
    expect(new Set(NOUNS).size).toBe(NOUNS.length);
  });
});
