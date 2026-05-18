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

**Decision point.** This phase opens with a one-page decision doc in `reviews/phase-7-backend-decision.md` evaluating Cloudflare Workers + Durable Objects, Supabase, Node + SQLite + minimal HTTP. **The sync mechanism is locked: 10-second poll on the client** — the backend decision is only about where state lives, not how the client gets updates.

**Scope**
- `/` → home: redirects to a fresh slug.
- `/b/<slug>` routing. Unknown slug → empty board created at that slug.
- **Slugs: four random words + 4-digit suffix** (e.g. `oak-thread-helmet-tractor-7421`). Word list lives inline in `src/persistence/slug.ts` (~1500 adjectives + ~1500 nouns as plain TS arrays, no external dep). Combined entropy `1500⁴ × 10⁴ ≈ 5 × 10¹⁶` combinations — bots cannot enumerate. Collisions are tolerated by the backend (slug uniqueness is not enforced on the client; the unit test asserts shape, not global uniqueness).
- `RemoteRepository` implements `BoardRepository`.
- Debounced writes (250ms) per mutating action, batched per affected entity (card or thread).
- `RemoteRepository` polls `GET /b/<slug>` every 10 seconds; the delta is merged into local state with LWW per card and per thread (invariant 4).
- Remote-merge commits MUST NOT push onto the local undo stack (otherwise undo would re-apply / undo another user's edit). Add a third commit path in `useBoardEditor` alongside the existing `commit` + implicit `pushUndo`: `commitFromRemote(next)` that skips the snapshot push.
- Share dialog shows the real URL and live `lastEdited` / `cardCount` / `threadCount` summary.
- Optimistic UI: local mutations show immediately; server confirmation does not re-render.
- Backend persistence schema stores the board payload as an opaque blob (or fields that include a `ciphertext` envelope) so Phase 7.5 can slot in client-side encryption without a schema migration. Concretely: don't model `cards` / `threads` as server-side tables you index into — store the whole board JSON per slug, server-opaque.

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

## Phase 7.5 — Lockable boards (optional passphrase encryption)

**Goal.** An owner can opt-in to a per-board passphrase. While locked, board contents are encrypted client-side; the server stores only an opaque ciphertext envelope. The default model from Phase 7 ("anyone with the link can edit") is preserved for un-locked boards; locked boards just demand both the link and the passphrase.

**Important.** This phase only starts once Phase 7 has been dogfooded for at least a week. The motivation for the lock is real-world feedback (e.g. wanting to put company info on a board); if dogfooding reveals it isn't needed, this phase is deferred indefinitely. The Phase 7 scope already prepares the backend to slot this in without a schema migration.

**Scope**
- New toolbar control: `Lock` (text only — emoji ban). On click for an unlocked board: a modal asks for a passphrase + confirmation + a "There is no recovery. If you lose this, the board is lost." acknowledgement. Min 8 chars. On confirm: encrypts the current board and the next persistence write goes out as ciphertext.
- For a locked board, `Lock` becomes `Locked · Unlock` — clicking prompts for the current passphrase to confirm and exits the locked state. A separate `Change passphrase` action re-encrypts under a new key.
- Visiting `/b/<slug>` for a locked board renders an inline "This board is locked. Enter passphrase to view." panel with a single password input. Wrong → re-prompt with an error count, no lockout. Right → decrypt in memory and render normally.
- Crypto: `PBKDF2-SHA-256` with `kdfIters ≥ 250_000`, salt is 16 random bytes generated on the first lock and persisted alongside the ciphertext. AES-GCM-256 with a fresh random IV per write. WebCrypto only — no external lib.
- Persistence schema (locked variant): `{ locked: true, ciphertext: string (base64), iv: string (base64), kdfSalt: string (base64), kdfIters: number, updatedAt: number }`. The board-level `updatedAt` survives in plaintext so the Share dialog's "Last edited" line can still update; nothing else does.
- Local cache (localStorage for the demo fallback path) mirrors the server shape — never persists plaintext to disk.
- Share dialog: when locked, the Copy button copies just the URL; a separate "Copy with passphrase hint" line appears showing `<URL>\n\nPassphrase: [shown to owner only — they're expected to paste it out-of-band]`. The visitor-side experience requires the passphrase via the unlock panel, regardless of how it was shared.
- Polling: a poll cycle for a locked board returns the ciphertext envelope. The client decrypts with the in-memory key; if decryption fails (e.g. the owner changed the passphrase from another tab), prompts for re-entry rather than crashing.
- Concurrent locks: if two owners race to lock the same board, last-write-wins on the envelope. Both must re-enter on their next decrypt. This is acceptable behaviour for v1.

**Out of scope.**
- Per-card encryption.
- Per-user passphrases on the same board (would break "in the room" semantics).
- Passphrase recovery / reset.
- Audit log of access attempts.
- Brute-force rate limiting at the server (PBKDF2 cost is the rate limit).
- Lockable boards interacting with the 10s remote-merge in any way other than "decrypt → merge → re-encrypt → write." If the merge resolution itself becomes too expensive under the encryption layer, the answer is "Phase 7.5 took a perf hit" not "change the merge model".

**TDD plan**
1. Unit (`src/crypto/passphrase.ts`): PBKDF2 derivation produces a stable 256-bit key for `(passphrase, salt)`; different salts produce different keys; iters parameter is honored.
2. Unit: `encryptBoard(board, key)` → `{ ciphertext, iv }`; `decryptBoard(envelope, key)` round-trips. Tampered ciphertext fails AES-GCM verification (test the auth-tag path).
3. Unit: `decryptBoard` with the wrong key throws (not silent corruption).
4. Integration: clicking Lock → modal → confirm → next save goes out with `locked: true` and no plaintext card text in the network payload.
5. Integration: visiting a locked board renders the unlock panel and NOT the board surface.
6. Integration: wrong passphrase increments an error count without revealing whether the board exists.
7. Integration: right passphrase decrypts and renders the same board the owner saw.
8. Integration: Unlock from toolbar prompts for current passphrase; on success, the next save is plaintext.
9. Integration: a poll cycle that returns ciphertext is decrypted client-side; LWW merge runs on plaintext (assert merge outcomes are identical to the unencrypted equivalent).
10. Integration: typing a swatch / text change while the board is locked encrypts before `scheduleSave` fires (no plaintext leaks via the debounce window).
11. E2E: workflow — open fresh slug → add 3 cards → Lock with passphrase → reload → unlock panel → wrong passphrase rejected → right passphrase → cards visible.
12. E2E: workflow — owner locks; visitor opens same URL in another context, must enter passphrase; once entered, cross-tab sync still works under encryption.
13. Smoke: a packet capture of the network layer for a locked board contains no card text strings (`expect(JSON.stringify(payload)).not.toContain('whatever the card said')`).

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~6 | KDF, encrypt/decrypt, tamper detection |
| Integration | ~9 | Lock/unlock UX, server payload shape, poll-under-lock, LWW under lock |
| E2E | 2 | Full lock cycle + cross-context unlock |

**Quality gates**
- Server response for a locked board contains no plaintext fields beyond `{ locked, ciphertext, iv, kdfSalt, kdfIters, updatedAt }`. Smoke-tested at the network layer.
- Key derivation uses `kdfIters ≥ 250_000`; pinned by a unit test that asserts the persisted envelope's `kdfIters` value.
- A locked board's debounced save MUST encrypt before the timer fires; a test asserts no plaintext text/colors appear in `repository.save` arguments while locked.
- The unlock panel does not render anything that reveals the board's structure (no card count, no thread count, no slug-derived info) — the entire payload is opaque until decrypted.
- `npm run build` bundle stays under 250kb gzipped (Phase 8 quality gate). PBKDF2 + AES-GCM are in WebCrypto — no library footprint.

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
