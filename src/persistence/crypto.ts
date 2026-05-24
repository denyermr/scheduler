import type { Board } from '../domain/types';

/**
 * Client-side encryption for the Phase 7.5 mandatory-lock scheme.
 *
 *   passphrase + kdfSalt + kdfIters  --PBKDF2-SHA256-->  256-bit key
 *   key + plaintext + iv             --AES-GCM-->        ciphertext + auth tag
 *
 * Web Crypto only — no external library. The server never sees plaintext.
 *
 * AES-GCM is authenticated: decryption with the wrong key (or any tampering)
 * fails its auth tag check. We catch that and return `null` rather than
 * throwing, so callers can distinguish "wrong password" from "actually broken".
 */

/** OWASP 2026 floor for PBKDF2-SHA-256 in interactive auth contexts. */
export const KDF_ITERS_DEFAULT = 200_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export type EncryptedPayload = {
  /** Base64 of ciphertext + AES-GCM auth tag (concatenated by SubtleCrypto). */
  ciphertext: string;
  /** Base64 of the random IV used for this single encryption. */
  iv: string;
};

export function randomSalt(): string {
  const out = bytes(SALT_BYTES);
  crypto.getRandomValues(out);
  return bytesToBase64(out);
}

export async function deriveKey(
  passphrase: string,
  kdfSalt: string,
  kdfIters: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(kdfSalt),
      iterations: kdfIters,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    // Extractable so we can export → sessionStorage on unlock and
    // re-import on reload. For our threat model (personal-deploy SPA
    // where any XSS = total compromise anyway) the marginal risk is
    // tiny and the UX win (no re-prompt on tab reload) is real.
    true,
    ['encrypt', 'decrypt'],
  );
}

/** Export an AES-GCM key as base64 raw bytes (for sessionStorage caching). */
export async function exportKeyRaw(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(buf));
}

/** Import a previously-exported raw AES-GCM key (from sessionStorage). */
export async function importKeyRaw(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(rawB64),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBoard(
  board: Board,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = bytes(IV_BYTES);
  crypto.getRandomValues(iv);
  const plaintext = encodeUtf8(JSON.stringify(board));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptEnvelope(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<Board | null> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
      key,
      base64ToBytes(payload.ciphertext),
    );
    const json = new TextDecoder().decode(plaintext);
    return JSON.parse(json) as Board;
  } catch {
    return null;
  }
}

// TS 6's Uint8Array is now generic over its underlying buffer kind
// (ArrayBuffer | SharedArrayBuffer | ArrayBufferLike). Web Crypto's
// `BufferSource` requires the narrowed `ArrayBuffer` kind. Build all
// fresh buffers through these helpers so the narrow type flows through
// without per-call assertions.
function bytes(n: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(n));
}

function encodeUtf8(s: string): Uint8Array<ArrayBuffer> {
  const text = new TextEncoder().encode(s);
  const out = bytes(text.length);
  out.set(text);
  return out;
}

function bytesToBase64(b: Uint8Array): string {
  let binary = '';
  for (const x of b) binary += String.fromCharCode(x);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = bytes(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
