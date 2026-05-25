import { exportKeyRaw, importKeyRaw } from './crypto';
import type { CryptoContext } from './remote';

/**
 * Per-tab sessionStorage cache of unlocked board keys. Lets reloads in the
 * same tab skip the unlock prompt. Tab close → key gone.
 *
 * Stored shape: `{ keyRawB64, kdfSalt, kdfIters }`. AES key is round-tripped
 * via Web Crypto's raw export/import (deriveKey produces extractable keys
 * per Phase 7.5).
 *
 * Failure mode: any error reading / parsing / importing returns null and
 * removes the corrupt entry. The user gets re-prompted, which is correct.
 */

type CachedShape = {
  keyRawB64: string;
  kdfSalt: string;
  kdfIters: number;
};

const PREFIX = 'sb:key:';

export async function cacheCryptoContext(
  slug: string,
  ctx: CryptoContext,
): Promise<void> {
  const keyRawB64 = await exportKeyRaw(ctx.key);
  const value: CachedShape = {
    keyRawB64,
    kdfSalt: ctx.kdfSalt,
    kdfIters: ctx.kdfIters,
  };
  sessionStorage.setItem(PREFIX + slug, JSON.stringify(value));
}

export async function readCachedCryptoContext(
  slug: string,
): Promise<CryptoContext | null> {
  const raw = sessionStorage.getItem(PREFIX + slug);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as CachedShape;
    const key = await importKeyRaw(parsed.keyRawB64);
    return { key, kdfSalt: parsed.kdfSalt, kdfIters: parsed.kdfIters };
  } catch {
    sessionStorage.removeItem(PREFIX + slug);
    return null;
  }
}

export function clearCachedCryptoContext(slug: string): void {
  sessionStorage.removeItem(PREFIX + slug);
}
