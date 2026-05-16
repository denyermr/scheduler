export const MIN_WEEKS = 4;
export const MAX_WEEKS = 52;
export const DEFAULT_WEEKS = 26;

export function clampWeeks(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_WEEKS;
  const floored = Math.floor(n);
  if (floored < MIN_WEEKS) return MIN_WEEKS;
  if (floored > MAX_WEEKS) return MAX_WEEKS;
  return floored;
}
