# Phase 4 Review — Cards: drag / move + multi-card stacking

## Summary

Workflow 02 (drag a card) and the deterministic in-cell stacking from CLAUDE.md §4 now work end-to-end. Press-and-hold a card for 80 ms to lift it (scale 1.05, rotation reset to 0, larger shadow); the dragged card and any thread anchored to it follow the pointer live; release over any cell snaps the card into that cell with a 120 ms ease-out transition; multiple cards in the same `(week, day)` cell render with the §4 offset formula, sorted by `createdAt` ascending. `Card.z` is a required field now — assigned monotonically per cell on every `addCard` / `moveCard`, rotated within the cell by `cycleStack` for the Cmd/Ctrl-click gesture. The render-time `offset` is derived in `<Board>`, not stored, per CLAUDE.md §10 row 4 (clarified at the start of this phase). 183 unit + integration pass, 25 e2e pass across chromium / firefox / webkit (+ 2 visual baselines correctly skipped on firefox / webkit). Domain coverage 97.41 / 95.00 / 100.00 / 97.79.

## What shipped

- **Domain — `Card.z`, `stackOffsets`, `cycleStack`.** [src/domain/types.ts](../src/domain/types.ts) gains required `Card.z: number` — the in-cell stack order, higher = on top, assigned per cell. [src/domain/stacking.ts](../src/domain/stacking.ts) is new: `stackOffsets(n)` is a pure table-driven helper that emits the §4 formula `(±(4+i·3), ±(3+i·2.5))` for `i = 0..n-1` (and `[(0,0)]` for `n = 1`, `[]` for `n = 0`, throws for `n < 0`); `cycleStack(board, week, day, {clock})` promotes the bottom card of a cell to the new top by bumping its `z` to `max(z in cell) + 1` and its `updatedAt`. The cycle is scoped to the named cell only — cards in other cells are returned by reference.
- **Domain — `addCard` and `moveCard` z assignment.** [src/domain/board.ts](../src/domain/board.ts) calls a private `nextZForCell(cards, week, day, excludeId)` helper that returns `0` for an empty cell and `max(z in cell) + 1` otherwise. `addCard` uses it on insert; `moveCard` uses it on the destination cell (with `excludeId` so the same-cell no-op stays a no-op). The most recently-interacted-with card always ends up with the highest `z` in its cell.
- **Persistence — `z` migration on load.** [src/persistence/localStorage.ts](../src/persistence/localStorage.ts) gains a `migrateBoard(board)` helper that runs on every successful JSON parse. If any card is missing `z`, it groups cards by `(week, day)`, sorts each cell ascending by `createdAt`, and assigns `z = 0..N-1`. Phase-3 saves come back with `z`s that match what `addCard` would have produced; Phase-4 (and later) saves with `z` already present round-trip unchanged. No version field yet — Phase 7's backend layer is the right place to introduce one.
- **State — `useBoardEditor.moveCardTo` + `cycleCellStack`.** [src/state/useBoardEditor.ts](../src/state/useBoardEditor.ts) gains two more actions, both going through the same clock-injected `commit` + debounced `scheduleSave` pipeline as Phase 3's edit actions. Same-cell `moveCardTo` short-circuits (relies on `moveCard` returning `board` by reference); `cycleCellStack` short-circuits when the cell has 0 or 1 cards.
- **UI — render-time offset application.** [src/ui/Board.tsx](../src/ui/Board.tsx) groups cards by cell, sorts each group by `createdAt` asc, and calls `stackOffsets(N)` once per group. Each card's final render position is `cellCenter + offsets[i]`. Threads read the same `positionById` map, so a thread attached to a stacked card lands exactly on the card's visual centre (not the cell centre). The edit popover anchors to the resolved position too. The card slot's CSS `zIndex` is the card's `z` value — the highest-z card paints last.
- **UI — drag state machine.** Same file. A discriminated union (`idle | pressing | lifted | snapping`) plus two timers (`liftTimer` for the 80 ms press-hold, `snapTimer` for the 120 ms ease-out). `onPointerDown` on the card slot opens the press; a window-level `pointermove` listener (registered only while `pressing` or `lifted`) updates the lifted card's `(deltaX, deltaY)` and the drop target via `cellAt(x, y, metrics, weeks)`. A subtle dashed rectangle (`drop-target-highlight`) renders over the currently-highlighted cell. `pointerup` commits the move via `onCardDrop` then transitions to `snapping` for 120 ms; the slot adds `transition: transform 120ms ease-out` during this window so the lift visual eases off. The synthetic click that follows pointerup is suppressed via a `suppressNextClick` ref.
- **UI — Cmd/Ctrl-click stack cycle.** Card-slot `onClick` checks `e.metaKey || e.ctrlKey` and, if the card's cell holds more than one sibling, calls `onCellCycle(week, day)` instead of `onCardClick(cardId)`. The drag handler skips pointer-down on modifier-key presses so the same gesture doesn't both lift the card and cycle the stack.
- **App composition.** [src/App.tsx](../src/App.tsx) wires `moveCardTo` / `cycleCellStack` as `onCardDrop` / `onCellCycle` on `<Board>`. It also gains an optional `containerWidth` prop that bypasses the `ResizeObserver` — needed for integration tests because jsdom has no layout and `clientWidth` collapses to 0, which would push `cellW` down to its 120 px floor and silently break the cellAt math.
- **Tokens — drag constants + cellAt re-export.** [src/ui/tokens.ts](../src/ui/tokens.ts) exports `DRAG_LIFT_MS = 80`, `DRAG_SNAP_MS = 120`, `DRAG_LIFT_SCALE = 1.05`, `DRAG_LIFT_SHADOW`. `cellAt(x, y, metrics, weeks)` (already lifted in Phase 3) is the drop-target hit-tester.
- **Test infra — `PointerEvent` polyfill.** [tests/setup.ts](../tests/setup.ts) installs a minimal `PointerEvent` subclass of `MouseEvent` on `window` and `globalThis`. JSDOM 25 does not ship a `PointerEvent` constructor, and React 18's synthetic event system needs it to route `onPointerDown` etc. Playwright covers real `PointerEvent`s end-to-end.
- **Demo board — stacked cards at (4, 2).** [src/persistence/demoBoard.ts](../src/persistence/demoBoard.ts) seeds three cards at `(week 4, day 2)` so the §4 offset formula is visible on first load. Card count goes 54 → 57; thread count unchanged.

## Tests added

| Level | Count | Files |
| --- | --- | --- |
| Unit (domain) | 14 | [tests/unit/domain/stacking.test.ts](../tests/unit/domain/stacking.test.ts) covers `stackOffsets(0..5)` (incl. `n = 1` returning the singleton-at-centre case and a `n < 0` throw), `addCard` z assignment (empty cell, stacking, cell-isolation), `moveCard` rebasing (onto non-empty target, onto empty cell, same-cell no-op identity), and `cycleStack` (promotion, `updatedAt` bump only on the promoted card, no-op for cells with 0 / 1 cards, no side effects on other cells). |
| Unit (persistence) | 3 | [tests/unit/persistence/repository.test.ts](../tests/unit/persistence/repository.test.ts) gained the legacy-load migration tests: single-card cell default-fills to `z = 0`, multi-card cell default-fills to `z = 0..N-1` by `createdAt` ascending (even when the array order is shuffled), and a Phase-4-native save with `z` already present round-trips unchanged. |
| Integration (RTL) | 4 (`Board.tsx`) + 10 (`drag.test.tsx`) | [tests/integration/Board.test.tsx](../tests/integration/Board.test.tsx) — single card centred at the cell centre, four-card stack offsets match `stackOffsets(4)` at the pixel, higher-z card has higher CSS `zIndex`, and a thread anchored to a stacked card terminates at the offset endpoint (the SVG path's trailing endpoint is parsed and pixel-compared). [tests/integration/drag.test.tsx](../tests/integration/drag.test.tsx) — one assertion block per BUILD_PLAN Phase 4 step 4..13: lift threshold, tap-as-click, drop-target highlight, drop on empty cell (one save + `updatedAt` bumped), drop on same cell (no save), drop on occupied cell (two-card stack with `z` 0 / 1), Sunday-column parity, live thread re-routing during drag, the 120 ms ease-out transition, and Cmd-click cycle. |
| E2E (Playwright) | 2 specs × 3 browsers = 6 runs | [tests/e2e/drag.spec.ts](../tests/e2e/drag.spec.ts) — workflow 02 (seed a unique card → press-hold-drag to a new cell → assert bounding-box overlap → reload → still in the new cell) and a stacking-offsets spec (read the live `(4, 2)` stack via `getBoundingClientRect` on every card-slot, assert there are 3 in the cell with both `±x` and `±y` offsets around the cell centre and all centres distinct). |

**183 unit + integration tests pass in ~3.4 s. 25 e2e pass in ~11 s** across chromium / firefox / webkit (the two skipped specs are the chromium-only visual baseline; the smoke baseline assertions in firefox / webkit are also intentionally skipped). Domain coverage on the head commit `ad4a8d7`:

```
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |   97.41 |    95.00 |  100.00 |   97.79 |
 board.ts    |   97.91 |    96.47 |  100.00 |   97.70 | 143,172
 random.ts   |   85.71 |    75.00 |  100.00 |   85.71 | 11
 stacking.ts |   96.29 |    91.30 |  100.00 |  100.00 | 62-63
```

Domain ≥ 90 / 90 gate satisfied.

## Design adherence

The drag flow tracks CLAUDE.md §8 workflow 02 and §4 stacking-offset table. Specifically:

- **Tactile, not slick.** Lift uses the spec's `DRAG_LIFT_SHADOW` and the 1.05 scale; rotation eases to 0 only during the lift. No animation library, no CSS keyframes — a single `transition: transform 120ms ease-out` on the slot does the snap.
- **No new dependencies.** Pointer events + a 30-line `PointerEvent` polyfill in `tests/setup.ts`. No `react-dnd`, no `@use-gesture/react`, no Framer Motion. The plan-then-install gate is satisfied by zero installs. `package.json` is unchanged.
- **`z` is persisted; `offset` is derived.** Spec amendment to CLAUDE.md §10 row 4 was committed first (`docs(spec)`) before any code change so the spec and the implementation didn't drift.
- **§4 offset formula is pixel-exact.** Both the unit test (`stackOffsets` table for n = 0..5) and the integration test (`<Board>` renders n = 4 with the exact pixel offsets) pin the formula. No `toBeCloseTo` approximation.
- **Sat / Sun parity.** Step 10 drives a drop into day = 6 (Sunday) through the same code path as weekdays.
- **Threads stay attached to the card, not the cell.** A thread between a stacked card and another card terminates at the stacked card's `cellCentre + offset` — the integration test parses the SVG path's trailing endpoint and pixel-compares.

### Where it diverges — and why

1. **No `z`-bounding on `cycleStack`.** The cycle bumps the bottom card to `max + 1` rather than re-sequencing the cell to `{0..N-1}`. After many cycles on the same cell, `z` would grow unboundedly. In practice the popover sits at `zIndex = 30`, so cards stay below the popover for the first ~25 cycles per cell — fine for v1. Phase 7's LWW merge will also be fine: `z` is per-card, last-write-wins, no collision. Bounding `z` would force every cycle to bump every card in the cell, costing N writes instead of 1. Documented in the `cycleStack` doc comment.
2. **No visual interpolation between drop-point and cell-centre.** The card snaps instantly from origin + delta to the new cell centre on `pointerup`; the 120 ms transition eases scale 1.05 → 1 and the rotation back to the card's resting angle. A FLIP-style position interpolation would be smoother but adds complexity not asked for in the spec.
3. **`App` accepts a `containerWidth` prop.** Introduced for integration tests where jsdom has no layout. Production callers (`main.tsx`, real usage) leave it unset and the `ResizeObserver` measures the real container — unchanged from Phase 3. Tagged as test-only in the prop doc comment.
4. **The stacking E2E asserts n = 3 not n = 4.** BUILD_PLAN step 15 names "a cell with 4 stacked cards" for the screenshot; the demo seed adds 3. Adding a 4th in the E2E flow requires hitting the cell overlay around the seeded cards, but cards render wider than the cell at `containerWidth = 1280` (cardSize ≥ 1) so the corner overlay region isn't clickable without further refactor. The 3-stack still exercises both ± signs along both axes — the property the BUILD_PLAN step actually wants to pin.

## Invariants pinned

| # | Invariant | New / refreshed assertion in Phase 4 |
| --- | --- | --- |
| 3 | No save button. Edits debounce 250 ms then persist. | `tests/integration/drag.test.tsx > step 7 — drop on an empty cell moves the card; one save fires` — pinned via `vi.spyOn(repo, 'save')`. |
| 7 | One Mon–Sun column set; Sat / Sun cells are first-class. | `tests/integration/drag.test.tsx > step 10` drops into the Sunday column (day = 6) through the same code path as weekdays and asserts the persisted card has `day === 6`. |
| 10 | Thread endpoints are stable card IDs, not array indices. | `tests/integration/Board.test.tsx > threads attaching to a stacked card terminate at the rendered (offset) position` reads the SVG path's trailing endpoint, asserts it matches the stacked card's offset centre. The endpoint is resolved via `positionById.get(thread.toCardId)`, not by card index. |

## Defects discovered

- **JSDOM 25 lacks `PointerEvent`.** First pass: drag tests all timed out with `data-dragging` stuck at `null`. Root cause: React 18's synthetic event system needs a real `PointerEvent` constructor to route pointer events; JSDOM 25 doesn't ship one. Fixed by polyfilling a minimal `PointerEvent extends MouseEvent` in `tests/setup.ts`. Playwright covers real PointerEvents in E2E.
- **Fake-timer-from-start blocks RTL `waitFor` (recurrence of the Phase 3 defect).** First-pass `drag.test.tsx` ran fake timers in `beforeEach`; the `waitFor` inside `renderApp` hit its 5 s timeout because RTL polls via `setInterval`. Fixed by switching to fake timers AFTER the initial `waitFor` resolves (inside `renderApp` itself). Same pattern as Phase 3's `cards.test.tsx`.
- **`fireEvent.click` on a stacked card hits the top card, not the cell overlay.** First-pass stacking E2E tried to add a 4th card by clicking the (4, 2) cell with cards already seeded. Cards render wider than the cell (cardSize > 1 at 1280 px viewport), so even corner clicks land on a card. Fix: scope the stacking E2E to 3 cards and pin the formula via the integration test instead, where the 4-card case is exact-pixel verified without DOM hit-testing.
- **Demo board card-count assertion drift.** Adding 3 stacked demo cards changed the global card count from 54 → 57. Tests in `tests/unit/persistence/repository.test.ts` (×3) and `tests/e2e/smoke.spec.ts` had to be updated. Same pattern as Phase 2 Amendment B's baseline regeneration — call out the count in one place and update.
- **`act()` wrapping needed for `setTimeout`-driven state changes under fake timers.** First pass: `vi.advanceTimersByTime(80)` fired the 80 ms lift timer but the resulting `setDrag(lifted)` didn't reflect in the DOM. Fixed via an `advanceMs(ms)` helper that wraps the advance in `act(...)` so React flushes the queued state update synchronously.

## Tech debt accrued

- **`z` grows unbounded over long-lived `cycleStack` sessions.** See "Where it diverges" #1. Tracked: if Phase 7's two-tab convergence test ever pushes a single cell past z = 25 cycles, revisit.
- **No drag-snap visual interpolation.** "Where it diverges" #2. The 120 ms transition handles scale + rotation but the spatial jump from `origin + delta` to the target cell centre is instant. A FLIP animation would be a Phase 8 polish item.
- **No keyboard equivalent for stack cycling.** Cmd/Ctrl-click is the only way to cycle. Phase 6 (keyboard shortcuts + a11y) is the right place to add a key-only equivalent.
- **The `pressing` state has no public DOM signal.** `data-dragging` is set during `lifted` and `snapping` only. There's no easy way for an a11y screen reader to announce "card press-held but not yet lifted." Phase 8 (accessibility) is the right place if needed.
- **No drag start / cancel telemetry.** A drop that lands outside the board grid silently no-ops (since `cellAt` returns `null` outside the bounds). User has no indication of why. Phase 6 / 8 polish.

## Risks / unknowns for next phase

- **Phase 5 — threads.** Threads creation will reuse the same pointer-down infrastructure (handle on each card → drag to another card). The `dragRef` + window-listener pattern in `<Board>` is ready to extend; the thread-handle would emit its own state-machine arm rather than the card-move one. Decision at Phase 5 kickoff: extend `DragState` discriminated union or factor into a `useDrag` hook.
- **Touch + Playwright mobile emulation.** Integration tests use synthetic `PointerEvent`s with `pointerType: 'mouse'`. Playwright's touch emulation fires `pointerType: 'touch'` events through the real PointerEvent constructor. I did not gate Phase 4 on a touch-specific test (BUILD_PLAN step is "touch + pointer events" without naming a touch test); a Playwright touch spec would be a useful add in Phase 8 / a11y.
- **The `containerWidth` test prop is a divergence from the production composition.** If a future change removes it (mistaking it for dead test-only code), the drag tests would silently regress to cellW = 120. The prop's doc comment names this; we should keep an eye on it during Phase 6's toolbar landing (which also fights for `App`'s prop surface).
- **`<Board>` is now ~600 lines.** It owns the surface, grid, drop targets, drag state machine, popover anchoring, and thread rendering. Phase 5 (threads creation) will add another state machine arm; Phase 6 (keyboard shortcuts) will add focus + selected-card state. Decision at Phase 5: split `<Board>` into `<Surface>` + `<CardLayer>` + `<ThreadLayer>` + `useDrag` hook, or carry on with one file. The integration tests will tell us when readability starts to degrade.

## Quality gate status

Local, on the head commit `ad4a8d7` of `phase-4-drag-stack`:

- [x] Lint clean — `npm run lint` (exit 0)
- [x] Types clean — `npm run typecheck` (exit 0)
- [x] Unit + integration green — `npm test` (183 / 183 across 23 files in ~3.4 s)
- [x] E2E green — `npm run test:e2e` (25 passed, 2 visual baselines correctly skipped on firefox / webkit, ~11 s)
- [x] Production build succeeds — `npm run build` (`dist/`: 1.32 kB HTML / 0.32 kB CSS / 166.45 kB JS, 54.63 kB gzipped — up ~5 kB from Phase 3 for the drag state machine + stacking helpers)
- [x] Coverage threshold met — domain ≥ 90 / 90 (97.41 / 95.00 / 100.00 / 97.79)
- [x] Lift threshold pinned at exactly `DRAG_LIFT_MS = 80` ms with fake timers — `step 4` advances `DRAG_LIFT_MS - 10` and asserts no lift, then advances `DRAG_LIFT_MS` and asserts lift.
- [x] Snap animation duration pinned at exactly `DRAG_SNAP_MS = 120` ms — `step 12` asserts the slot carries `transition: transform 120ms ease-out` during snapping and clears it after `advanceMs(DRAG_SNAP_MS)`.
- [x] Stacking formula is unit-tested with explicit `n = 1..5` expected pixel values — no `toBeCloseTo`.
- [x] `transform`-only during drag — the slot's `left` / `top` are the resolved render position; only `transform` changes between frames. (CSS specifically `transform`-based; no `top` / `left` mutation per frame.)
- [ ] **CI green on the head commit** — will be verified by the PR after pushing; this checklist updates once CI reports.

## Recommendation

Proceed to Phase 5 (threads — create / delete / follow) once CI is verified green on the PR. The drag infrastructure (window-listener pattern, `cellAt` hit-testing, `suppressNextClick`, snap-state visual) generalises cleanly to a thread-handle drag. The Card schema and persistence layer are ready: `z` is persisted, `offset` is derived, threads already use the same `positionById` map as cards.

## Appendix

### Commits on this branch (off main)

1. `b60f2fa` — `docs(spec): clarify Card.z persisted, offset derived at render time`
2. `2965659` — `feat(domain): Card.z + stackOffsets + cycleStack`
3. `b3bd6d4` — `feat(persistence): migrate legacy boards to Card.z on load`
4. `ebd7b71` — `feat(ui): render-time stack offsets + zIndex for stacked cells`
5. `a6d0641` — `feat(drag): press-hold lift, cellAt drop targeting, snap-on-release`
6. `ad4a8d7` — `test(e2e) + demo: workflow 02 drag + stacking screenshot`

### File changes (vs main)

```
 CLAUDE.md                                                    | +/-1 line — §10 row 4 clarified (z persisted, offset derived)
 src/App.tsx                                                  | + optional containerWidth + onCardDrop/onCellCycle wiring
 src/domain/board.ts                                          | + nextZForCell + z assignment in addCard/moveCard
 src/domain/index.ts                                          | + ./stacking re-export
 src/domain/stacking.ts                                       | +new
 src/domain/types.ts                                          | + Card.z required
 src/persistence/demoBoard.ts                                 | + 3 stacked cards at (4, 2)
 src/persistence/localStorage.ts                              | + migrateBoard default-fills z
 src/state/useBoardEditor.ts                                  | + moveCardTo + cycleCellStack
 src/ui/Board.tsx                                             | + drag state machine, drop-target highlight, render-offset, zIndex, Cmd-click cycle
 src/ui/tokens.ts                                             | + DRAG_LIFT_MS + DRAG_SNAP_MS + DRAG_LIFT_SCALE + DRAG_LIFT_SHADOW
 tests/e2e/drag.spec.ts                                       | +new (workflow 02 + stacking offsets)
 tests/e2e/smoke.spec.ts                                      | 54 → 57 card-count
 tests/integration/Board.test.tsx                             | + 4 stacking integration tests
 tests/integration/Card.test.tsx                              | fixture: + createdAt/updatedAt/z (was a latent gap)
 tests/integration/drag.test.tsx                              | +new (10 tests, steps 4..13)
 tests/setup.ts                                               | + PointerEvent polyfill
 tests/unit/domain/stacking.test.ts                           | +new (14 tests)
 tests/unit/persistence/repository.test.ts                    | + 3 z-migration tests; 54 → 57 card-count
```

### No new runtime dependencies

`package.json` is unchanged. The plan-then-install gate is trivially satisfied.
