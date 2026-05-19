import { ADJECTIVES, NOUNS } from './slugWords';

export { ADJECTIVES, NOUNS };

type Rng = () => number;

/**
 * Generate a board slug shaped `adj-noun-adj-noun-NNNN`.
 *
 * With the current list sizes (≥ 400 of each) and 10000 digit suffixes, the
 * combination space is at least `400⁴ × 10⁴ ≈ 2.5 × 10¹³` — bots and
 * scanners cannot enumerate this in any practical time. Collisions are
 * tolerated by the backend (slug uniqueness is not enforced on the client).
 *
 * The shape is pinned by `tests/unit/persistence/slug.test.ts`:
 *   /^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{4}$/
 *
 * Pass a seeded `rng` for determinism (tests, repro). Defaults to
 * `Math.random` in production.
 */
export function generateSlug(rng: Rng = Math.random): string {
  const adj1 = pick(ADJECTIVES, rng);
  const noun1 = pick(NOUNS, rng);
  const adj2 = pick(ADJECTIVES, rng);
  const noun2 = pick(NOUNS, rng);
  const suffix = Math.floor(rng() * 10_000)
    .toString()
    .padStart(4, '0');
  return `${adj1}-${noun1}-${adj2}-${noun2}-${suffix}`;
}

function pick<T>(list: readonly T[], rng: Rng): T {
  const idx = Math.floor(rng() * list.length) % list.length;
  const value = list[idx];
  if (value === undefined) {
    throw new Error(`pick: unreachable index ${String(idx)} on list of size ${String(list.length)}`);
  }
  return value;
}
