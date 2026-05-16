import { defaultRng, type Rng } from './random';

function hex8(rng: Rng): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += (Math.floor(rng() * 16) & 0xf).toString(16);
  }
  return out;
}

export function cardId(rng: Rng = defaultRng): string {
  return `card_${hex8(rng)}`;
}

export function threadId(rng: Rng = defaultRng): string {
  return `thread_${hex8(rng)}`;
}
