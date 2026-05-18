import type { Board } from '../domain/types';

/**
 * The wire format for `GET /b/:slug` and `PATCH /b/:slug`.
 *
 * Discriminated union from day one so Phase 7.5's `locked: true` arm is a
 * pure addition with no migration of the unlocked path. See
 * `reviews/phase-7-backend-decision.md` §3.
 *
 * Phase 7 only constructs / consumes the `locked: false` arm. The
 * `locked: true` arm exists in the type so clients pattern-match on
 * `envelope.locked` from the start — `unwrapUnlocked` throws if a server
 * speaking the Phase 7.5 protocol talks to a Phase 7 client.
 */
export type Envelope =
  | { readonly locked: false; readonly board: Board; readonly updatedAt: number }
  | {
      readonly locked: true;
      readonly ciphertext: string;
      readonly iv: string;
      readonly kdfSalt: string;
      readonly kdfIters: number;
      readonly updatedAt: number;
    };

export function isUnlocked(
  env: Envelope,
): env is Envelope & { locked: false } {
  return env.locked === false;
}

export type Unlocked = { board: Board; updatedAt: number };

export function unwrapUnlocked(env: Envelope): Unlocked {
  if (!isUnlocked(env)) {
    throw new Error(
      'Envelope is locked — lockable boards arrive in Phase 7.5.',
    );
  }
  return { board: env.board, updatedAt: env.updatedAt };
}
