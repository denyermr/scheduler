import { PIN_COLORS, type Pin } from './types';

export type Rng = () => number;

export const defaultRng: Rng = Math.random;

export function randomPin(rng: Rng = defaultRng): Pin {
  const idx = Math.floor(rng() * PIN_COLORS.length) % PIN_COLORS.length;
  const pin = PIN_COLORS[idx];
  if (pin === undefined) {
    throw new Error(`randomPin: unreachable index ${String(idx)}`);
  }
  return pin;
}

export function randomRotation(rng: Rng = defaultRng): number {
  return rng() * 4 - 2;
}
