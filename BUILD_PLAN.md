# BUILD_PLAN.md — Schedule Board

Eight phases. Each phase is a discrete Claude Code session, ships a demoable artifact, and ends with a critical review report committed to `reviews/phase-N.md`. Do not start phase N+1 until phase N's review is green.

This plan assumes `CLAUDE.md` has been read. Tokens, invariants, and conventions live there and are not repeated here.

---

## How to run a phase session

Each phase below has a **Session kickoff prompt** — paste it into a fresh Claude Code session. The prompt is self-contained but assumes CC has read `CLAUDE.md` and `design/` in the same repo.

Each session follows the same arc:

```
1. Restate the goal in your own words. Stop if anything is unclear.
2. Read CLAUDE.md and the prior phase's review (if any).
3. Write a short plan (a numbered todo list).
4. Implement TDD-style: failing test → code → green → refactor.
5. Run the full quality gate locally (lint, typecheck, unit, integration, e2e).
6. Write reviews/phase-N.md using the template at the bottom of this doc.
7. Open a PR titled "Phase N — <short name>".
```

### Quality gate (run before every phase merge)
```
npm run lint
npm run typecheck
npm test               # vitest, must be 100% green
npm run test:e2e       # playwright, must be 100% green
npm run build          # production build must succeed
```

Coverage threshold for `src/domain/` is **90% lines / 90% branches** from Phase 1 onward, enforced in CI.

---

## Phase 0 — Foundation

**Goal.** A repo a developer can clone and start contributing to. Nothing user-facing.

**Scope**
- Vite + React 18 + TypeScript (strict) scaffold.
- Vitest + RTL configured. Playwright configured against `npm run preview`.
- ESLint (typescript-eslint strict + react-hooks) + Prettier; conflicts resolved.
- Husky + lint-staged: pre-commit runs lint + typecheck on staged files.
- GitHub Actions: lint, typecheck, unit, e2e, build, on PR + main.
- `src/domain/types.ts` skeleton with empty `Board`, `Card`, `Thread`, `Color` types.
- Smoke `App.tsx` rendering "Hello board".
- Google Fonts (Caveat, Permanent Marker, Manrope, JetBrains Mono) in `index.html`.
- Commit hooks reject `console.log` and `any` (override comment allowed).
- `design/` directory populated from the handed-off package.
- `reviews/` directory created.

**Out of scope.** Any board rendering, any state, any interaction.

**TDD plan**
- One smoke unit test that imports `src/domain/types.ts`.
- One Playwright test asserting "Hello board" renders.

**Quality gates**
- All five commands run green locally **and** in CI.
- A deliberately-broken commit (e.g. `any` without override, or trailing `console.log`) is rejected.

---

## Phase 1 — Core data model

**Goal.** All board logic, pure, no UI, no browser.

**Scope**
- Types: `Card`, `Thread`, `Board`, `Color`, `Day` (0–6, Mon–Sun), `Week` (0-indexed), `Pin`, `Rotation`.
- IDs: `cardId()`, `threadId()` — opaque string IDs, seedable for tests.
- Board operations (pure, return new Board):
  - `createBoard({ startMonday, weeks })` — default 26 weeks.
  - `addCard(board, { week, day, color, text }) → { board, cardId }`
  - `updateCard(board, cardId, { text?, color? })`
  - `moveCard(board, cardId, { week, day })`
  - `deleteCard(board, cardId)` — removes attached threads.
  - `addThread(board, { fromCardId, toCardId })` — rejects self-threads and duplicates.
  - `deleteThread(board, threadId)`
  - `resizeWeeks(board, weeks)` — returns `{ board, offBoardCardIds }` for shrink.
  - `cardsOnBoard(board)`, `cardsOffBoard(board)`.
- Helpers: `isMarker(text)`, `clampWeeks(n)`.
- Inject randomness as parameters for determinism.

**Out of scope.** Persistence, undo/redo, any DOM.

**TDD plan**

1. `cardId()` generates unique opaque IDs.
2. `createBoard({ weeks: 26 })` is empty with weeks=26.
3. `createBoard({ weeks: 3 })` rejected; `createBoard({ weeks: 60 })` clamped.
4. `addCard` rejects `day < 0` or `day > 6`.
5. `addCard` adds a card; original unchanged.
6. `addCard` assigns rotation in [-2, +2] and a pin color from the fixed palette.
7. `updateCard` updates text or color; rotation and pin preserved.
8. `moveCard` changes week/day; rotation/pin preserved.
9. `deleteCard` removes the card.
10. `deleteCard` removes threads where it is from or to.
11. `addThread` creates a thread between two existing cards.
12. `addThread` rejects self-threads, duplicates, non-existent endpoints.
13. `deleteThread` removes the thread.
14. `resizeWeeks` smaller keeps off-board cards flagged via `cardsOffBoard()`.
15. `resizeWeeks` regrow restores off-board cards as on-board.
16. `isMarker('BLOCK')` true; `isMarker('Block')` false; `isMarker('B&L')` true; `isMarker('A')` false.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~30–40 | One per operation × happy and edge paths |

**Quality gates**
- `src/domain/` coverage ≥ 90% lines + branches.
- No React or browser imports under `src/domain/` (ESLint rule).
- A property-based test on `moveCard`: any sequence preserves id, rotation, pin.

---

## Phase 2 — Read-only board rendering

**Goal.** Given a `Board`, render it per the design. No interactions. Visual fidelity is the deliverable.

**Scope**
- `tokens.ts` exporting canonical values from CLAUDE.md §4.
- `<Board />`, props: `board: Board`, optional `containerWidth`.
- `<Card />`, props derived from a `Card` plus a `scale` prop.
- `<Thread />`, SVG path between two card positions.
- `BoardRepository` interface (read-only this phase): `load(slug)`.
- `InMemoryRepository` + stub `LocalStorageRepository`.
- App boots, loads demo board, renders.

7 day columns (Mon–Sun); fluid cell width per CLAUDE.md §4.

**Out of scope.** Hover, click, drag, popovers, toolbar.

**TDD plan**
- `<Card>` renders text, applies marker font when all-caps, applies rotation, renders pin head.
- `<Board>` renders 7 day headers and N week rows.
- At 1440px container, computed `cellW` is inside the clamp bounds; at 600px, floors at the minimum.
- `<Board>` renders one thread per `board.threads` with correct sag.
- Visual regression: hero board matches design at 1440×900.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit (RTL) | ~14 | Card, Board, Thread rendering + fluid sizing |
| E2E + visual | 1 | Hero board screenshot |

**Quality gates**
- Visual regression baseline committed and matched.
- Lighthouse performance ≥ 90 on populated 26-week board.
- 8-color palette is the only fill set on cards.
- At 1440px viewport, rendered board width ≥ 90% of content area.

---

## Phase 2 — Amendment A · 7-day grid + fluid width (2026-05-16)

Brought the existing build to **Mon–Sun (7)** with fluid cell width via `clamp(90, vw/7, 160)`.

If you have already merged Amendment A, proceed to Amendment B. If Amendment A is still in flight, you may either land it first or fold both amendments into a single PR — Amendment B's changes do not conflict.

(Full TDD plan and kickoff prompt for this amendment in the previous revision of this document — preserved in git history. Summary: widen `Day` type to `0..6`, extend `DAYS` constant, replace `* 5` with `* 7` in grid math, replace fixed `cellW` with the clamp formula, regenerate visual baseline.)

---

## Phase 2 — Amendment B · Visual refresh (2026-05-16)

Brings the existing build in line with the new design drop in `design/handoff/`: **light page background, no wood frame, floating board with elevated shadow, weekend header muting, raised cell clamp bounds**.

### Scope of patch

1. **Page background.** `App.tsx` (and any screen wrapper) replaces the dark brown `#3a2410` background with the cool off-white per CLAUDE.md §4. URL chip text colors updated (`#7a8295` dim, `#2a3142` bright).
2. **Remove the wood frame.** In `<Board>`, delete the wood-gradient wrapper, its padding, its inset bevel highlights. Replace with the floating shadow per §4. Cork keeps its own border-radius (3) and inset hairline edge.
3. **Cell clamp bounds raised.** `clamp(90, …, 160)` → `clamp(120, (containerWidth − railW − margin) / 7, 180)`. Update the two sizing tests that pinned the old bounds.
4. **Weekend header muting.** Day headers for Sat (index 5) and Sun (index 6) render with:
   - Badge fill `#e9c79a` (was `#F4B584` for weekdays).
   - Font size 16px (was 18px).
   - Opacity 0.78.
   - Same ±1.5° random rotation as weekdays.
   - Same width slot, same alignment, no other changes.
5. **Cork inner shadow softened.** `inset 0 0 24px rgba(60,30,10,.18)` → `inset 0 0 28px rgba(60,30,10,.16)`. Hairline `inset 0 0 0 1px rgba(0,0,0,.18)` → `inset 0 0 0 1px rgba(40,30,15,.28)`.
6. **Visual regression baseline regenerated.** Previous post-Amendment-A baseline archived under `tests/e2e/__screenshots__/_archive/phase-2-amend-A/`.

### Behavior NOT changed

- 7-day grid (already Mon–Sun from Amendment A).
- Card data shape (unchanged this amendment — see Phase 3 / 4 for that).
- Workflows 01–06 (no interaction work in this patch).
- The 8-color palette.

### TDD plan (ordered red → green)

1. *Red:* update existing "page background is `#3a2410`" assertion to expect the new off-white gradient. Watch it fail.
2. *Green:* implement the new page background in the app shell. Test passes.
3. *Red:* update "Board renders inside a wood-gradient frame" assertion to "Board has no frame element; cork is the outer surface". Watch it fail.
4. *Green:* delete the frame wrapper. Cork radius and hairline preserved. Test passes.
5. *Red:* new unit test — at `containerWidth = 1440`, computed `cellW` is in [120, 180].
6. *Red:* new unit test — at `containerWidth = 600`, computed `cellW` equals 120 (clamp floor).
7. *Red:* delete or update tests pinning the old 90–160 bounds; replace with 120–180.
8. *Green:* update the clamp formula in `<Board>`. All three tests pass.
9. *Red:* new unit test — the Sat day-header badge has fill `#e9c79a`, font-size 16px, opacity 0.78. Same for Sun.
10. *Red:* new unit test — Mon–Fri day-header badges still have fill `#F4B584`, font-size 18px, opacity 1.
11. *Red:* new unit test — *cells* in columns 5 and 6 (Sat, Sun) have the same background, grid lines, and dimensions as weekday cells (asserts invariant 7's "cells unchanged" clause).
12. *Green:* implement weekend-only header styling in `<Board>`. Tests 9, 10, 11 pass.
13. Regenerate the visual regression baseline. **Manually inspect** the new screenshot at 1440×900 against `design/screens.jsx` hero artboard before committing.
14. Run the full quality gate.

### Session kickoff prompt for Amendment B

```
You are applying Amendment B to Phase 2 of the Schedule Board build.

Read the updated CLAUDE.md in full — §1, §4 (Surfaces, Day-header badges,
Board sizing), §5 (invariant 7), and §7 (anti-patterns) all changed.
Read the "Phase 2 — Amendment B" section of BUILD_PLAN.md.

Replace the contents of design/ with the files from the latest design drop
(handoff/, board.jsx, tokens.jsx, screens.jsx, workflows.jsx,
components.jsx, design-canvas.jsx, Schedule Board Spec.html, and
Schedule Board Spec — bundled.html). Commit that as a separate `chore: refresh design`
commit on the patch branch before any code changes.

Branch off main as `phase-2-patch-visual-refresh`. (If Amendment A is still
unmerged, branch off the Amendment A branch instead and combine both in one PR.)

Work TDD-first using the ordered red→green list in Amendment B.
Regenerate the visual regression baseline only after all the assertion
tests are green; inspect the new screenshot manually before committing.

When complete:
  - Write reviews/phase-2-patch-B.md using the template at the bottom of
    BUILD_PLAN.md. Include before/after screenshots at 1440px and 1024px,
    and one screenshot focused on the day-header row showing the
    Mon–Fri vs Sat–Sun differentiation.
  - Open a PR titled "Phase 2 patch B — visual refresh".
  - Do not begin Phase 3 until the patch is merged.

Constraints:
  - Weekend muting is ONLY in the day-header badge — not in cells, not in
    grid lines, not in cards. If your implementation makes Sat/Sun cells
    look different from weekday cells in any way, you have gone too far.
  - The wood frame is DELETED, not hidden. Remove the wrapper element,
    not just its styles.
  - The clamp formula is exactly: clamp(120, (containerWidth − railW − margin) / 7, 180).
    Do not improvise different bounds.
  - No new dependencies. No CSS framework. Surfaces live in tokens.ts.
```

### Quality gates for Amendment B
- All existing unit and integration tests are either still green or updated and green. No skipped tests.
- New visual baseline committed and matched on re-run.
- Manual check: open the dev server at 1440×900, 1280×800, and 1024×768. The board's rendered width is ≥ 85% of the content area at every breakpoint above 1024px.
- Manual check: the day-header row at 1440×900 shows visibly muted Sat/Sun badges next to fully-saturated Mon–Fri badges, without making the cells below look different.

---

## Phase 3 — Cards: create, edit, recolor, delete

**Goal.** Workflows 01 and 04 working with persistence via `LocalStorageRepository`.

**Scope**
- Click empty cell → blank peach card + caret + edit popover docked below.
- Type → live update (and live marker-font switch when going all-caps).
- Enter or blur → commit + persist + close popover.
- Esc → cancel (if newly created, remove; if edited, revert).
- Click existing card → edit popover with text pre-filled and 8 swatches; clicking a swatch recolors live.
- Delete button on popover removes card and attached threads.
- `LocalStorageRepository` saves on every mutating action behind a 250ms debounce.
- **Card schema gains** `createdAt: number` (set on create, never modified) **and** `updatedAt: number` (set on create, bumped on every mutation including text/color edits). Use an injected clock in the domain layer so tests stay deterministic.

**Out of scope.** Drag, multi-card-in-cell stacking (Phase 4), undo/redo, threads, toolbar.

**TDD plan**
1. Unit (domain): `addCard` sets `createdAt` and `updatedAt` to the injected clock's value.
2. Unit (domain): `updateCard` bumps `updatedAt` to the new clock value; `createdAt` is unchanged.
3. Unit (domain): `moveCard` also bumps `updatedAt`.
4. Integration: clicking an empty cell mounts an edit popover and focuses the input. Card appears optimistically.
5. Integration: typing updates the rendered card live.
6. Integration: Enter commits and closes; repository sees one write.
7. Integration: Esc on a *newly created* card removes it; repository sees no write.
8. Integration: typing all-caps switches font to Permanent Marker.
9. Integration: clicking an existing card opens the popover with text pre-filled.
10. Integration: clicking a swatch updates color in DOM and repository.
11. Integration: Delete removes the card from the DOM and repository.
12. Integration: rotation and pin color unchanged after edit/recolor.
13. Integration: cards on Saturday (day=5) and Sunday (day=6) cells are clickable and editable.
14. E2E: workflow 01 reproduced (click cell → type "Dress + light" → Enter → reload → still there).
15. E2E: workflow 04 reproduced (click → recolor coral → reload → coral).

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~9 | Domain timestamp behavior + popover unit |
| Integration | ~13 | The scenarios above |
| E2E | 2 | Workflows 01 and 04 |

**Quality gates**
- Debounce window exactly 250ms (fake timers).
- Components do not call `localStorage` directly (ESLint).
- Lighthouse a11y ≥ 95 on the editing screen.

---

## Phase 4 — Cards: drag / move and multi-card stacking

**Goal.** Workflow 02 working. Multi-card-in-cell renders with the deterministic stacking from CLAUDE.md §4.

**Scope**
- Press-and-hold (80ms) on a card lifts it: scale 1.05, larger shadow, rotation reset.
- Drag highlights the nearest cell. Threads connected to the dragged card re-route live.
- Release snaps over 120ms ease-out.
- Two or more cards in the same cell stack per the deterministic offset formula in CLAUDE.md §4. Grid never grows.
- **Card schema gains** `z: number` (stack order, monotonically increasing per board) **and** optional `offset: { x: number; y: number }` (computed at render time from cell occupancy).
- Clicking through a stack: top card (highest `z`) opens.
- **Cmd/Ctrl-click on a stacked cell** cycles the visible top card by rotating `z` values within the stack.
- Touch + pointer events.

**Out of scope.** Threads creation (Phase 5), undo (Phase 6).

**TDD plan**
1. Unit (domain): a function `stackOffsets(n)` returns the i = 0..n-1 offsets per CLAUDE.md §4 formula; pinned by table-driven test for n = 1..5.
2. Unit (domain): `addCard` into a non-empty cell assigns `z = max(existing z in cell) + 1`.
3. Unit (domain): a function `cycleStack(board, cell)` returns a new board where the bottom card becomes the new top within that cell only.
4. Integration (fake timers): mousedown on a card for 80ms triggers the lift state.
5. Integration: mousedown <80ms then mouseup is a click (opens edit popover).
6. Integration: dragging over a cell highlights it.
7. Integration: drop on an empty cell moves the card; repository receives one write; `updatedAt` bumped.
8. Integration: drop on the same cell is a no-op.
9. Integration: dropping into an already-occupied cell stacks both cards with non-zero `offset` per the formula.
10. Integration: dropping into the Sunday column works identically to weekdays.
11. Integration: while dragging, live thread endpoints update on every frame.
12. Integration: snap animation duration is 120ms.
13. Integration: Cmd-click on a stacked cell cycles which card is rendered on top (`z` rotates within the cell).
14. E2E: workflow 02 reproduced.
15. E2E: a cell with 4 stacked cards renders all four with the deterministic offsets visible (screenshot).

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~6 | Stacking helpers and z assignment |
| Integration | ~11 | Drag and stack scenarios |
| E2E | 2 | Workflow 02 + stacking screenshot |

**Quality gates**
- Dragging is 60fps on a 26-week board with 60 cards (Playwright trace, frame drops < 2).
- Touch support verified in Playwright mobile emulation.
- No layout thrash during drag (use `transform`, not `top`/`left`).
- Stacking formula is unit-tested with explicit n=1..5 expected values — no "approximately" assertions.

---

## Phase 5 — Threads: create, delete, follow

**Goal.** Workflow 03 fully working.

**Scope**
- Hovering a card reveals a small red-brown thread handle at its top-right corner.
- Press-drag from handle draws a dashed in-progress line.
- Release on another card creates a thread.
- Release on empty space cancels.
- Esc during drag cancels.
- Click a thread (6px hit area) flashes red 100ms then deletes.
- Threads update live when either endpoint card is moved.

**TDD plan**
1. Integration: hovering a card shows the thread handle; leaving hides it.
2. Integration: drag from handle creates the dashed temporary path.
3. Integration: release on a different card commits the thread; repository sees one write.
4. Integration: release on same card or empty space discards.
5. Integration: Esc during drag cancels.
6. Integration: clicking a thread shows the 100ms red flash, then removes from DOM and repository.
7. Integration: deleting a card removes any thread that referenced it.
8. Integration: moving an endpoint card updates the thread path live.
9. E2E: workflow 03 reproduced.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~10 | All scenarios above |
| E2E | 1 | Workflow 03 |

**Quality gates**
- A thread referencing a deleted card cannot exist (invariant 9).
- Thread hit area is verifiable via `boundingBox()`.

---

## Phase 6 — Toolbar, undo/redo, week range, keyboard shortcuts

**Goal.** Workflow 06 + the locked keyboard shortcuts from CLAUDE.md §8.

**Scope**
- Toolbar (top-right, fixed): `Weeks N · Undo · Redo · Share`.
- Undo/Redo: stack of board snapshots, capacity 50.
- `Weeks N` opens an inline stepper (4–52).
- Shrinking past `max(card.week) + 1` prompts: *"N cards would be cut off — continue?"*. Cards preserved off-board.
- Share button opens dialog (URL + Copy + summary). Network sharing still stubbed.
- **Keyboard shortcuts (all global, suppressed while a text input is focused):**
  - `Cmd/Ctrl-Z` undo, `Cmd/Ctrl-Shift-Z` redo.
  - `Backspace` deletes the selected card (when no input is focused, and a card is selected).
  - `Arrow keys` move the selected card by exactly one cell in that direction, clamped to board bounds. Each keypress is one undo step.

**Out of scope.** Real backend, real sharing.

**TDD plan**
1. Integration: every mutating action pushes a snapshot.
2. Integration: Cmd-Z reverts the last action.
3. Integration: Cmd-Shift-Z re-applies; a fresh mutation clears the redo stack.
4. Integration: stack capped at 50; oldest dropped.
5. Integration: shrinking weeks below `max(card.week) + 1` shows the warning; canceling does not mutate.
6. Integration: shrinking → confirm → regrow restores off-board cards.
7. Integration: Share dialog Copy puts the URL in `navigator.clipboard`.
8. Integration: with a card selected, ↑ ↓ ← → each move it one cell, clamped at the edges. Repository receives one write per keypress.
9. Integration: with a card selected and no input focused, Backspace deletes it.
10. Integration: keyboard shortcuts do **not** fire while a text input is focused (verified for Backspace and arrows, separately).
11. Integration: arrow-key moves bump `updatedAt` and produce one undo step each.
12. E2E: workflow 06 reproduced.
13. E2E: keyboard-only sequence — select a card, nudge it with arrows, Backspace it, Undo to restore, Redo to re-delete.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~12 | All scenarios above |
| E2E | 2 | Workflow 06 + keyboard sequence |

**Quality gates**
- Undo stack is bounded; stress test with 60 actions.
- All keyboard shortcuts have a "while input focused" no-op test.
- No action is *only* reachable via keyboard (every shortcut has a mouse equivalent).

---

## Phase 7 — Persistence, URL routing, real sharing

**Goal.** Workflow 05 working with a real backend.

**Decision point — resolved 2026-05-18.** Backend is **Node + SQLite** via a single-file `node:http` + `better-sqlite3` server in `server/`. Wire format is the discriminated-union envelope from day one. `DEMO_SLUG` is scrapped; `/` redirects to a freshly generated slug. `commitFromRemote(next)` is added to `useBoardEditor` so poll-induced merges never enter the local undo stack. `PollDriver` injection mirrors the `Clock` pattern. Routing is plain `pathname` + `pushState`. Full rationale in `reviews/phase-7-backend-decision.md`. **The sync mechanism is locked: 10-second poll on the client** regardless of backend.

**Scope**
- `/` → home: redirects to a fresh slug (generated client-side, written to URL via `history.replaceState`).
- `/b/<slug>` routing via plain `pathname` parsing in `src/state/useRoute.ts` (no React Router). Unknown slug → backend `GET` 404 → `RemoteRepository` emits an empty `Board` at the current week count; the first write creates the row server-side.
- **Slugs: four random words + 4-digit suffix** in the `adj-noun-adj-noun-NNNN` pattern (e.g. `oak-thread-helmet-tractor-7421`). Word lists live inline in `src/persistence/slugWords.ts` (~540 adjectives + ~550 nouns shipped as plain TS arrays, no external dep; spec floor is ≥ 500 of each). Combined entropy ≈ 9 × 10¹⁴ combinations — bots cannot enumerate. Collisions are tolerated by the backend (slug uniqueness is not enforced on the client; the unit test asserts shape across 500 samples, not global uniqueness). Router validation accepts any `[a-z0-9-]+` slug for forward-compat; only the *generator* enforces the four-word shape.
- `RemoteRepository` implements `BoardRepository`. Uses `fetch` (no client-side lib), holds an injected `PollDriver` (`setInterval(cb, 10_000)` in production; manual fire in tests).
- Debounced writes (250ms) per mutating action; the whole envelope is `PATCH`-ed (the server stores it opaquely — no per-entity payload).
- `RemoteRepository` polls `GET /b/<slug>` every 10 seconds; the delta is merged into local state with LWW per card and per thread (invariant 4). Cards use the per-field `updatedAt` rule; threads use set-diff by id (immutable, no per-thread timestamp added — see decision doc §7).
- Remote-merge commits MUST NOT push onto the local undo stack. The new path `commitFromRemote(next)` skips both `pushUndo` and `scheduleSave` (the change is already on the server).
- Share dialog shows the real URL and live `Last edited Nm ago · N cards · M threads` summary from the server's `updatedAt`.
- Optimistic UI: local mutations show immediately; server confirmation does not re-render. A poll arriving while the user is typing in the popover MUST NOT steal focus — pinned by a test that asserts `document.activeElement` is unchanged across a poll cycle.
- Offline window: writes that fail are retained in memory and retried on the next poll tick. No data loss within a 30s offline window.
- **Backend persistence schema**: one table `boards(slug TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`. `payload` is the JSON envelope; the server never parses card / thread structure. Three endpoints, no per-entity routes. Phase 7.5 adds the locked-envelope arm without a schema migration.
- **Wire envelope (option (b))**: `GET /b/:slug` always returns `{ locked: false, board, updatedAt } | { locked: true, ciphertext, iv, kdfSalt, kdfIters, updatedAt }`. Phase 7 ships only the unlocked arm; Phase 7.5 adds the locked arm.
- **Dev / test harness**: `npm run server` boots the HTTP server on `localhost:8787` against `data/dev.sqlite` (gitignored). Vite dev server proxies `/b/*` to it. Tests stand up an in-process `http.Server` on an ephemeral port against `:memory:` SQLite; same code as prod. E2E tests boot the server once via Playwright's `webServer` config.
- **`DEMO_SLUG` scrapped**: the old `'oak-thread-942'` constant and its `buildDemoBoard()` fallback are removed. `/` now generates a fresh slug. The existing localStorage entry under `sb:board:oak-thread-942` becomes orphaned for any dev who runs both `main` and the phase-7 branch on the same machine — noted in `reviews/phase-7.md`.

**Out of scope.** Conflict warnings, presence indicators, cursors, comments. WebSockets / SSE — not in v1.

**TDD plan**
1. Unit: slug generator returns `/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{4}$/`. ~500 samples; assert shape, not uniqueness.
2. Integration: `/b/unknown-slug` creates a fresh empty board.
3. Integration: any mutation is debounced 250ms then `PATCH`-ed.
4. Unit: LWW merge — given local card with `updatedAt = T1` and incoming card with `updatedAt = T2`, the one with higher `updatedAt` wins, applied per-field.
5. Integration: polling triggers every 10 seconds; the polling clock is injectable in tests.
6. Integration: a poll response carrying a deleted card removes it locally; any thread referencing it is removed too.
7. Integration: a poll response arriving while I'm editing a card does not steal focus from my input.
8. Integration: a remote-merge commit does NOT push onto the local undo stack — pin separately for "incoming card change" and "incoming card delete".
9. E2E (two browser contexts): tab A adds a card, tab B sees it within 12 seconds (one poll cycle + slack).
10. E2E (two contexts): both tabs edit the same card's color; the later write wins.
11. E2E (two contexts): tab A deletes a card; tab B's thread referencing it disappears on the next poll.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~6 | Slug shape, LWW merge |
| Integration | ~11 | Routing, repository, debounce, polling, remote-merge does NOT push undo |
| E2E | 3 | Multi-tab scenarios |

**Quality gates**
- Two-tab convergence verified by Playwright (cross-context, with poll-cycle slack).
- Network failure: writes queue and retry; no data loss on a 30s offline window.
- Backend stores the full board JSON per slug as an opaque payload (or a Phase 7.5–ready envelope). No server-side indexing of `cards` / `threads` — the server is dumb storage.
- Slug entropy bumped to four words + four digits (see Scope); shape-test pinned.

---

## Phase 7.5 — Mandatory locked boards + site-creation gate (in progress 2026-05-24)

**Goal.** Every board is encrypted client-side; the server stores only ciphertext envelopes. A static site-wide `SITE_PASSWORD` (Fly secret) gates the creation of new boards. The creator picks a per-board passphrase at create time; recipients need the slug + the passphrase to decrypt and view. **No unlocked variant.** Brought forward from "optional opt-in" because uncontrolled board creation on the public deploy is unacceptable, and the per-board-passphrase model is the right protection regardless.

**Why this changed.** The original Phase 7.5 plan made encryption optional. After the Phase 8A deploy went live, the bot/abuse surface was reconsidered: a single owner with a personal deployment does not need the "casual boards stay frictionless" middle ground — every board should be locked, and creation should require something only the owner knows. The site password is the simplest viable anti-bot for a one-user deployment.

**Scope**

*Server*
- New `SITE_PASSWORD` env var, set as a Fly secret (`fly secrets set SITE_PASSWORD=...`).
- `PATCH /b/:slug`: if the slug does not exist in the `boards` table AND the request lacks a valid `X-Site-Password` header → 401. Existing-slug PATCH does NOT require the site password (slug entropy is the protection).
- `GET /b/:slug`: unchanged. `DELETE /b/:slug`: unchanged (currently nothing in the UI exposes delete — out of scope to change here).
- Existing test boards on the live volume are wiped as part of deploy. Once 7.5 ships, every row in `boards` is a locked envelope.

*Client crypto* (`src/persistence/crypto.ts`)
- `PBKDF2-SHA-256` with `kdfIters = 200_000` (OWASP 2026 floor for PBKDF2-SHA-256). Salt is 16 random bytes per board, generated on create.
- `AES-GCM-256` with a fresh 12-byte random IV per write.
- WebCrypto only — no external library. No new runtime dependency.
- `deriveKey(passphrase, salt, iters) → CryptoKey`, `encryptBoard(board, key) → { ciphertext, iv }`, `decryptEnvelope({ ciphertext, iv }, key) → Board | null` (null on auth-tag failure = wrong key).

*Client wire format*
- Server payloads are always `{ locked: true, ciphertext, iv, kdfSalt, kdfIters, updatedAt }`. The unlocked variant from Phase 7 still exists in the type union but is never produced or accepted by the v2 client.
- `RemoteRepository.save(board)` requires a session key (held by `useBoardEditor`); encrypts, then PATCHes the ciphertext envelope.
- `RemoteRepository.load(slug)` returns the raw envelope; the editor decrypts before rendering.
- Poll-merge (`mergeIncoming`): decrypt the polled envelope first, then run the existing LWW on plaintext, then re-encrypt for the next save. No plaintext leaves the browser.

*Splash screen at `/` (cork-paper aesthetic)*
- Small "paper-pinned-to-cork" card centered on the floating-board page background — matches Phase 2 Patch B surfaces.
- Two password inputs: **Site password** (creates boards) + **Board password** (encrypts this board). Caveat title; Manrope inputs. No emoji.
- "Create board" button.
- On submit:
  1. Generate a fresh slug (`slugWords`).
  2. Generate fresh 16-byte salt, derive key.
  3. Encrypt an empty `Board` (default 26 weeks, no cards, no threads) with a fresh IV.
  4. PATCH `/b/<slug>` with `{ locked: true, ciphertext, iv, kdfSalt, kdfIters: 200_000, updatedAt: now }` and header `X-Site-Password: <input>`.
  5. On 201/204: stash the key in `sessionStorage` under `sb:key:<slug>`, navigate to `/b/<slug>`.
  6. On 401: inline error "Site password incorrect" (no detail on which input).

*Unlock screen at `/b/:slug` (cork-paper aesthetic)*
- Same surface treatment as the splash.
- `useBoardEditor` first fetches the envelope. If `sessionStorage` has a key for this slug, attempt silent decrypt; success → mount the board; failure → fall through to prompt.
- Prompt: one password input + "Unlock". On submit: derive key with the envelope's `kdfSalt` + `kdfIters`, attempt `decryptEnvelope`. Success → cache key in `sessionStorage`, render board. Failure → inline error, retry.
- 404 envelope (unknown slug) — show "This board doesn't exist or has been deleted." with a link back to `/`. (Distinct from the splash so the URL stays addressable.)

**Out of scope (v1 of 7.5)**
- Per-card encryption.
- Per-user passphrases on the same board (would break "in the room" semantics).
- Passphrase recovery / reset / hint storage.
- "Change passphrase" UI (would need a re-encrypt + re-share flow; defer until needed).
- Audit log of failed-unlock attempts.
- Brute-force rate limiting (PBKDF2 cost is the rate limit; the site password gate limits create-rate).
- Multiple site passwords / per-invitee tokens (v2, once multi-user matters).

**TDD plan (ordered red → green)**

*Crypto unit*
1. `deriveKey('abc', salt, 200_000)` produces a `CryptoKey` usable for AES-GCM. Different salts → different keys (verified via roundtrip differing).
2. `encryptBoard(board, key)` then `decryptEnvelope({ciphertext, iv}, key)` returns a deep-equal board. Property test (fast-check) over random small boards.
3. `decryptEnvelope` with the wrong key returns `null` (no throw); the auth-tag failure path is explicit.
4. Tampered ciphertext (single bit flipped) returns `null` from `decryptEnvelope`.

*Server integration*
5. `PATCH /b/<new-slug>` without `X-Site-Password` → 401, no row inserted.
6. `PATCH /b/<new-slug>` with wrong `X-Site-Password` → 401, no row inserted.
7. `PATCH /b/<new-slug>` with correct `X-Site-Password` → 204, row inserted.
8. `PATCH /b/<existing-slug>` without `X-Site-Password` → 204 (existing-slug edits are open).
9. Server reads `SITE_PASSWORD` from env at startup; missing env → server still starts but rejects all create attempts (defensive). Optionally: warn to stderr.

*Client integration*
10. Visiting `/` renders the splash with two password inputs. Submitting both posts a locked envelope to the new slug.
11. Submitting the splash with wrong site password shows the inline error and doesn't navigate.
12. Successful splash submit → navigates to `/b/<slug>` and renders the (empty) board without re-prompting (key cached in sessionStorage).
13. Visiting `/b/<slug>` in a fresh tab (no sessionStorage) shows the unlock prompt, not the board.
14. Wrong board password on unlock shows inline error and keeps the prompt mounted.
15. Right board password decrypts and renders the board; key cached.
16. A typing → save cycle in a locked board: the network payload contains `{ locked: true, ciphertext, ... }` and NO plaintext card text.
17. Poll-merge: incoming locked envelope decrypts → LWW runs → next save re-encrypts. Merge outcomes identical to the Phase 7 plaintext equivalent.
18. Reload in the same tab does NOT re-prompt (sessionStorage hit).
19. New tab to the same `/b/<slug>` URL DOES re-prompt (sessionStorage is per-tab).

*E2E*
20. Full create flow: visit `/`, enter site + board passwords, click Create, lands on `/b/<slug>`, board is editable.
21. Share flow: open the same `/b/<slug>` URL in a second browser context with no shared state — unlock prompt appears, board password decrypts, content matches.
22. Wrong password rejection: open in a second context, enter wrong board password, see error, enter right password, succeed.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~4 | crypto roundtrip + wrong-key + tamper |
| Integration | ~15 | site gate, splash, unlock, poll under lock, sessionStorage cache |
| E2E | 3 | create flow, two-context unlock, wrong-password rejection |

**Quality gates**
- All server responses for any slug contain only the locked-envelope fields (`locked: true, ciphertext, iv, kdfSalt, kdfIters, updatedAt`) — pinned by an integration assertion against a saved board.
- `kdfIters` in every persisted envelope is ≥ 200,000 — pinned by a unit test.
- A save cycle's network payload never contains card text — explicit `expect(JSON.stringify(body)).not.toContain(...)` on a known card text.
- `npm run build` bundle stays under 250 kB gzipped. WebCrypto is in the browser — no library footprint.
- Site password is never logged or echoed in error messages — pinned by a test that the 401 response body does not include the submitted password.
- Production deploy includes `fly secrets set SITE_PASSWORD=...` and a one-shot wipe of the existing boards table (since the live volume has Phase 8A test data with unlocked envelopes).

---

## Phase 8 — Polish, a11y, perf, launch readiness

**Goal.** Ship it.

**Scope**
- Tab cycles cells; Enter on a cell opens add-card flow. (Arrow keys and Backspace come from Phase 6.)
- Screen reader: each card is announced as "card, color X, text Y, week Z, day D" with day name spelled out; threads as "thread from … to …".
- Contrast: chrome text meets WCAG AA against its (now light) surface. The weekend header at opacity 0.78 is verified to still meet contrast.
- Focus rings visible when navigation is keyboard.
- Performance: time-to-interactive on 26-week board with 80 cards ≤ 1.5s on a mid-spec laptop.
- Cross-browser: Chrome, Firefox, Safari, Edge — full E2E green in each.
- Empty / error / loading states per `design/screens.jsx`.
- README for a new developer.

**Out of scope.** Mobile-first layout (v2).

**TDD plan**
1. Integration: axe-core runs as part of unit tests for every screen; zero violations on the new light page background.
2. Integration: keyboard-only full add/edit/move/thread/delete cycle in Playwright.
3. Integration: screen reader announcements include the day name (Mon–Sun) correctly.
4. Integration: contrast check on the muted weekend header — explicit assertion against WCAG AA for `#3a2410` on `#e9c79a` at 78% opacity (compute effective color).
5. E2E: full suite runs in all four browsers in CI.
6. Visual regression: golden screenshots from Phase 2 (post-Amendment-B) still match.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~9 | a11y per screen + contrast check |
| E2E | full suite × 4 browsers | Cross-browser smoke |

**Quality gates**
- Lighthouse: performance ≥ 90, accessibility = 100, best-practices ≥ 95, SEO ≥ 90.
- axe-core: zero violations on every primary screen.
- Bundle size ≤ 250kb gzipped (excluding fonts).

---

## Critical review report template

Copy this into `reviews/phase-N.md` (or `reviews/phase-N-patch-X.md`) at the end of each phase.

```markdown
# Phase N Review — <short name>

## Summary
One paragraph. What shipped, what didn't.

## What shipped
- Bullet list of concrete user-facing or developer-facing capabilities.

## Tests added
| Level | Count | Files |
|---|---|---|
| Unit | N | … |
| Integration | N | … |
| E2E | N | … |

Coverage on src/domain/: X% lines / Y% branches.

## Design adherence
- Where the implementation matches the design.
- Where it diverges, and why — with a screenshot side-by-side if visual.

## Invariants pinned
For each CLAUDE.md §5 invariant touched in this phase, the test that pins it.

## Defects discovered
- Bugs caught during the phase. Fixed (link to commit) or deferred (link to issue).

## Tech debt accrued
- Shortcuts taken, with rationale and a follow-up issue link.

## Risks / unknowns for next phase
- Anything that should be resolved before kickoff.

## Quality gate status
- [ ] Lint clean
- [ ] Types clean
- [ ] Unit + integration green
- [ ] E2E green
- [ ] Production build succeeds
- [ ] Coverage threshold met (domain ≥ 90%)
- [ ] CI green on the merge commit

## Recommendation
"Proceed to phase N+1" or "Hold — resolve <list> first".

## Appendix
- Screenshots / recordings / Lighthouse / axe reports as applicable.
```
