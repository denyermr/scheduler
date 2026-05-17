/**
 * A function returning the current time as a unix epoch millisecond.
 * Inject the production clock at the system boundary (state / persistence);
 * keep the domain pure — no `Date.now()` calls live under `src/domain/`.
 */
export type Clock = () => number;

/**
 * Deterministic fallback so tests that ignore timestamps stay terse.
 * Production callers MUST inject a real clock (e.g. `() => Date.now()`).
 */
export const defaultClock: Clock = () => 0;
