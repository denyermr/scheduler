# Phase 1 Review — Core data model

## Summary

The full domain model and all eleven board operations land under `src/domain/` as pure TypeScript — zero React, zero browser APIs, zero hidden state. Randomness, IDs, and the default clock are injectable so tests are deterministic. 80 unit tests run in ~1s and the domain hits 97% statements / 96% branches / 100% functions against a 90/90 gate. The Phase 0 toolchain is unchanged; the CI workflow now runs `npm run test:coverage` and fails the build if the domain drops below 90/90.

## What shipped

- `src/domain/types.ts` — `Card`, `Thread`, `Board`, `Color`, `Day`, `Week`, `Pin`, `Rotation`, `CardId`, `ThreadId`. All readonly. The `CARD_COLORS`, `PIN_COLORS`, `DAYS` const tuples are the source of truth for the type unions and for runtime palettes.
- `src/domain/ids.ts` — `cardId(rng?)` and `threadId(rng?)` produce `card_<8 hex>` / `thread_<8 hex>`. RNG is injectable for deterministic tests; defaults to `Math.random`.
- `src/domain/random.ts` — `randomPin(rng?)` and `randomRotation(rng?)`. `Rotation` is uniform on `[-2, 2)`. `Pin` is uniform over the 5-colour palette.
- `src/domain/weeks.ts` — `MIN_WEEKS=4`, `MAX_WEEKS=52`, `DEFAULT_WEEKS=26`, `clampWeeks(n)` (for UI step controls; never invoked by `createBoard`).
- `src/domain/marker.ts` — `isMarker(text)` returns `/^[A-Z &+]{2,}$/.test(text)` per §4.
- `src/domain/board.ts` — `createBoard`, `addCard`, `updateCard`, `moveCard`, `deleteCard`, `addThread`, `deleteThread`, `resizeWeeks`, `cardsOnBoard`, `cardsOffBoard`. All pure: every operation returns a new `Board`; the input is never mutated. Spread + filter + a small `replaceAt` helper.
- `src/domain/index.ts` — barrel re-export.
- Vitest coverage wired with v8, scoped to `src/domain/**`, thresholds 90/90/90/90 (lines/branches/functions/statements). New script `npm run test:coverage`.
- CI updated: `Unit tests` step replaced by `Unit tests + domain coverage gate` (`npm run test:coverage`). Coverage HTML/LCOV uploaded as an artifact on every run.

## Tests added

| Level | Count | Files |
| --- | --- | --- |
| Unit | 80 (across 13 files) | `tests/unit/domain.types.test.ts`, `tests/unit/domain/ids.test.ts`, `tests/unit/domain/marker.test.ts`, `tests/unit/domain/weeks.test.ts`, `tests/unit/domain/random.test.ts`, `tests/unit/domain/board.createBoard.test.ts`, `tests/unit/domain/board.addCard.test.ts`, `tests/unit/domain/board.updateCard.test.ts`, `tests/unit/domain/board.moveCard.test.ts`, `tests/unit/domain/board.moveCard.property.test.ts`, `tests/unit/domain/board.deleteCard.test.ts`, `tests/unit/domain/board.threads.test.ts`, `tests/unit/domain/board.resizeWeeks.test.ts` |
| E2E | 1 | unchanged from Phase 0 (`tests/e2e/smoke.spec.ts`) |

**Coverage on `src/domain/`:**

```
File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered
-----------|---------|----------|---------|---------|----------
All files  |   97.29 |     96.1 |     100 |   97.02 |
 board.ts  |   97.53 |    96.92 |     100 |   97.33 | 115, 139  (defensive `unreachable` throws gated by noUncheckedIndexedAccess)
 ids.ts    |    100  |    100   |    100  |   100   |
 marker.ts |    100  |    100   |    100  |   100   |
 random.ts |   85.71 |     75   |    100  |   85.71 | 11 (defensive `unreachable` throw in randomPin)
 types.ts  |    100  |    100   |    100  |   100   |
 weeks.ts  |    100  |    100   |    100  |   100   |
```

Aggregate is comfortably above the 90/90 floor. The three uncovered lines are `if (x === undefined) throw new Error('unreachable')` defensive guards required by `noUncheckedIndexedAccess`; they are unreachable by construction. Considered an acceptable trade-off vs disabling the TS check.

**Property test:** `board.moveCard.property.test.ts` uses `fast-check` with 200 runs. Generators: a board size in [4, 52] and a sequence of up to 30 random moves; the assertion is that across any sequence, the card's `id`, `rotation`, `pin`, `color`, and `text` are unchanged. Pins CLAUDE.md invariant 6.

## Design adherence

- The 8-card palette and 5-pin palette are encoded as `as const` tuples; the type system rejects any other value.
- `DAYS = [0,1,2,3,4]` and is the only allowed shape for `Day` — invariant 7 (Mon–Fri only) is unrepresentable as a falsehood.
- `addCard` defaults colour to `peach` per §4.
- Marker regex matches §4 verbatim: `/^[A-Z &+]{2,}$/`.

No visual surfaces touched this phase — Phase 2 owns that.

## Invariants pinned

Each invariant from CLAUDE.md §5 that is *expressible* in pure-domain code has at least one named test. Invariants 1–3 are URL/persistence/UI behaviour and land in Phase 2 / Phase 3 / Phase 7. Invariant 4 (LWW merge) lands at the Phase 7 backend boundary.

| # | Invariant | Pinned by |
| --- | --- | --- |
| 5 | Marker font auto-applies via the all-caps regex; lowercase opts out. | `domain/marker.test.ts` — full table (`BLOCK`, `Block`, `B&L`, `A`, `A+B`, `Hello WORLD`, etc.) |
| 6 | Pin colour and rotation are stable per card. | `board.updateCard.test.ts` (3 tests), `board.moveCard.test.ts` (1 test), `board.moveCard.property.test.ts` (fast-check 200 runs) |
| 7 | One Mon–Fri column set; no weekends. | `domain.types.test.ts` (`DAYS === [0,1,2,3,4]`) + `addCard`/`moveCard` runtime guards (`board.addCard.test.ts`, `board.moveCard.test.ts`) |
| 8 | Shrinking the week range never deletes cards; regrow restores. | `board.resizeWeeks.test.ts` — "shrinking … leaves off-board cards", "regrowing restores", "shrink with no overflow returns empty offBoardCardIds" |
| 9 | Deleting a card removes its threads. | `board.deleteCard.test.ts` — "removes threads where it is the from-endpoint" + "to-endpoint" + "leaves unrelated threads intact" |
| 10 | Thread endpoints are stable card IDs, not array indices. | `board.threads.test.ts` — addThread uses `fromCardId`/`toCardId` and the test verifies the returned thread carries the same IDs |

Invariants 1, 2, 3 (URL identity, no-auth, no save button) and 4 (LWW merge) are out-of-scope for Phase 1 and will be pinned in Phase 2/3/7.

## Defects discovered

None.

## Tech debt accrued

- **Defensive `unreachable` throws cost ~3% coverage.** `noUncheckedIndexedAccess: true` (set in Phase 0) forces a `T | undefined` check after `arr[i]`. Three call sites have an `if (x === undefined) throw new Error('unreachable')` branch that is provably unreachable. Could be tightened by introducing a `safeAt(arr, i)` helper or a `// c8 ignore next` comment, but the current state is honest and the threshold passes. Logged as a candidate for the Phase 2 refactor pass.
- **`startMonday` is a string, not a `Date`.** Validation is regex-only (no calendar correctness). Sufficient for Phase 1 but Phase 2 may want a "is this a Monday" assertion when the week-rail label rendering needs it. Will revisit if it bites.

## Semantic clarifications I had to make (the spec was intentionally underspecified)

These were called out in the kickoff and you blessed them. Recording for the audit trail:

1. **`createBoard({ weeks: 60 })` throws.** Spec said "clamped or rejected (decide; align with §5)". Picked reject — silent clamping hides caller bugs. `clampWeeks(n)` exists as a separate UI-side helper.
2. **`startMonday` is `string` in `YYYY-MM-DD` form.** Domain is pure; `Date` objects in pure code are awkward (timezones, mutability). Validated with `/^\d{4}-\d{2}-\d{2}$/`.
3. **`addCard` / `moveCard` throw on out-of-range week or day** — they don't silently coerce.
4. **`addThread` rejects duplicates *in either direction*.** Spec §4 says "no arrowhead. Ever." Threads are visually symmetric, so `A→B` and `B→A` collapse to the same edge.
5. **Off-board cards live in the same `cards` array.** `cardsOnBoard` / `cardsOffBoard` are filters. Avoids a second collection that would have to stay consistent. Invariant 8 is satisfied trivially: shrink doesn't touch `cards`.
6. **No `createdAt` field on `Card` or `Thread` this phase.** Timestamps will be added at Phase 7 for LWW merge.

## Risks / unknowns for next phase

- Phase 2 is the read-only board render with full visual fidelity to the design. The `tests/integration/` directory does not exist yet; Vitest `include` is currently `tests/unit/**` and will need to be widened to `tests/{unit,integration}/**`.
- Visual regression tests will need a deterministic seed so rotation/pin assignments don't flicker between snapshot runs. The injectable RNG hooks added in this phase make that straightforward.
- Whether `Board` should store a `Map<CardId, Card>` instead of an array is a Phase 2 perf question — the array is fine for ≤80 cards on a 26-week board but every operation is O(n). Defer; profile during Phase 2.

## Quality gate status

Local, on the head commit of `phase-1-domain`:

- [x] Lint clean — `npm run lint` (exit 0)
- [x] Types clean — `npm run typecheck` (exit 0)
- [x] Unit tests green — `npm test` (80/80 across 13 files in ~1s)
- [x] E2E green — `npm run test:e2e` (3 tests × 3 browsers, ~2.6s)
- [x] Production build succeeds — `npm run build` (140.92 KB JS / 0.32 KB CSS, unchanged from Phase 0)
- [x] Coverage threshold met — `npm run test:coverage` (90/90/90/90 against actual 97.29/96.10/100/97.02)
- [x] CI green on the head commit (`58c5944`) — PR [#2](https://github.com/denyermr/scheduler/pull/2), run [25971489610](https://github.com/denyermr/scheduler/actions/runs/25971489610). All 15 steps success in 1m 24s. Per-step: install 5s · lint 2s · typecheck 2s · test+coverage 5s · build 3s · playwright install 49s · e2e 14s.

## Recommendation

Proceed to Phase 2.

## Appendix

### Property test parameters
- `numRuns: 200`
- Board size: `fc.integer({ min: 4, max: 52 })`
- Moves: `fc.array(fc.record({ week: int 0..51, day: constantFrom(...DAYS) }), { minLength: 1, maxLength: 30 })`
- Per move, `week` is taken mod `boardWeeks` so the move is always on-board.
- Assertion: id, rotation, pin, color, text invariant.

### New dependencies (only 2, both dev-only, both demanded by Phase 1 quality gates)
- `@vitest/coverage-v8@^4.1.6` — to enforce the 90/90 domain coverage gate.
- `fast-check@^3.23.2` — for the property test on `moveCard` required by BUILD_PLAN.md Phase 1 quality gates.

### Deviations from CLAUDE.md
None.
