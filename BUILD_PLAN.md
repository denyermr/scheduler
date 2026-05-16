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

Coverage threshold for `src/domain/` is **90% lines / 90% branches** from Phase 1 onward, enforced in CI. UI is not coverage-gated — behavior is gated by tests at the right level instead.

---

## Phase 0 — Foundation

**Goal.** A repo a developer can clone and start contributing to. Nothing user-facing.

**Scope**
- Vite + React 18 + TypeScript (strict) scaffold.
- Vitest + RTL configured. Playwright configured against `npm run preview`.
- ESLint (typescript-eslint strict + react-hooks) + Prettier wired up; conflicting rules resolved.
- Husky + lint-staged: pre-commit runs lint + typecheck on staged files.
- GitHub Actions workflow: lint, typecheck, unit, e2e, build, on PR + main.
- `src/domain/types.ts` skeleton with empty `Board`, `Card`, `Thread`, `Color` types — just the shapes, no logic.
- Smoke `App.tsx` rendering a "Hello board" page with a Manrope-loaded body.
- Google Fonts (Caveat, Permanent Marker, Manrope, JetBrains Mono) loaded in `index.html`.
- Commit hooks reject `console.log` and `any` (with override comment allowed).
- `design/` directory populated from the handed-off zip.
- `reviews/` directory created.

**Out of scope.** Any board rendering, any state, any interaction.

**Session kickoff prompt**
```
Bootstrap the Schedule Board project per BUILD_PLAN.md Phase 0. Read CLAUDE.md
first. The design files live in design/. Set up the full toolchain (Vite, TS
strict, Vitest, RTL, Playwright, ESLint, Prettier, Husky, lint-staged, GH
Actions). Verify every step of the quality gate runs locally and in CI before
writing the review. Do not implement any board logic.
```

**TDD plan**
- One smoke unit test that imports `src/domain/types.ts` and confirms it compiles (sanity).
- One Playwright test that visits `/` and asserts "Hello board" is in the DOM.
- That is enough for Phase 0 — the value is in the toolchain working end to end.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | 1 | Types module imports |
| E2E | 1 | Home page renders |

**Quality gates (must pass)**
- All five commands in the gate above run green locally **and** in CI.
- A deliberately-broken commit (e.g. `any` without override, or trailing `console.log`) is rejected by pre-commit or CI.

**Critical review report — `reviews/phase-0.md`**
Use the template at the bottom. Specifically demonstrate:
- Screenshot of CI run passing on a real PR.
- The list of installed dependencies and exact versions.
- Any deviations from CLAUDE.md (and why).

---

## Phase 1 — Core data model

**Goal.** All board logic, pure, no UI, no browser. If a behavior is testable in `src/domain/` it lives there.

**Scope**
- Types: `Card`, `Thread`, `Board`, `Color`, `Day` (0–4), `Week` (0-indexed), `Pin`, `Rotation`.
- IDs: `cardId()`, `threadId()` — opaque string IDs (e.g. `card_<8 hex>`), seedable for tests.
- `Board` operations (all pure, return new Board):
  - `createBoard({ startMonday, weeks })` — `weeks` defaults to 26.
  - `addCard(board, { week, day, color, text }) → { board, cardId }`
  - `updateCard(board, cardId, { text?, color? })`
  - `moveCard(board, cardId, { week, day })`
  - `deleteCard(board, cardId)` — also removes attached threads.
  - `addThread(board, { fromCardId, toCardId })` — rejects self-threads and duplicates.
  - `deleteThread(board, threadId)`
  - `resizeWeeks(board, weeks)` — returns `{ board, offBoardCardIds }` for shrink. Does not mutate or delete off-board cards; their `week` stays as-is.
  - `cardsOnBoard(board) → Card[]` — only cards whose `week < board.weeks`.
  - `cardsOffBoard(board) → Card[]`.
- Helpers: `isMarker(text)` returning the auto-marker regex result, `clampWeeks(n)`.
- Pin color and rotation are assigned inside `addCard` from injected randomness sources (parameters with defaults), to keep determinism in tests.

**Out of scope.** Persistence, undo/redo, any DOM. Even the `BoardRepository` interface — that's Phase 2.

**Session kickoff prompt**
```
Implement Phase 1 of BUILD_PLAN.md. The full domain model and operations in
src/domain/, with 90% line+branch coverage. Pure TypeScript only — zero React,
zero browser APIs. Inject randomness as parameters so tests are deterministic.
Reference the invariants in CLAUDE.md §5 — every invariant should be pinned
by at least one test.
```

**TDD plan**

Order matters. Each step is a red→green→refactor cycle.

1. `cardId()` generates unique opaque IDs of the expected shape.
2. `createBoard({ weeks: 26 })` returns a board with 0 cards, 0 threads, weeks=26.
3. `createBoard({ weeks: 3 })` is rejected (min 4); `createBoard({ weeks: 60 })` clamped or rejected (decide; align with §5).
4. `addCard` adds a card, returns new board + cardId, original board unchanged.
5. `addCard` assigns rotation in [-2, +2] and a pin color from the fixed palette.
6. `updateCard` updates text or color; rotation and pin are preserved.
7. `moveCard` changes week/day; rotation/pin preserved.
8. `deleteCard` removes the card.
9. `deleteCard` also removes threads where it is from or to (invariant 9).
10. `addThread` creates a thread between two existing cards.
11. `addThread` rejects self-threads, duplicate threads, threads to non-existent cards.
12. `deleteThread` removes the thread.
13. `resizeWeeks` to a smaller N keeps off-board cards in the board but flagged via `cardsOffBoard()`.
14. `resizeWeeks` regrow restores previously off-board cards as on-board (invariant 8).
15. `isMarker('BLOCK')` true; `isMarker('Block')` false; `isMarker('B&L')` true; `isMarker('A')` false.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~30–40 | One per operation × happy and edge paths |

**Quality gates**
- `src/domain/` coverage ≥ 90% lines + branches.
- No React or browser imports anywhere under `src/domain/` (enforced by ESLint rule `no-restricted-imports`).
- A property-based test on `moveCard`: any sequence of moves on a card preserves its id, rotation, pin.

**Critical review report — `reviews/phase-1.md`**
In addition to the template:
- Coverage report screenshot.
- Confirmation each of the 10 invariants in CLAUDE.md §5 is pinned by a named test.
- Any operations whose semantics required clarification — with the resolution.

---

## Phase 2 — Read-only board rendering

**Goal.** Given a `Board` (from Phase 1), render it exactly per the design — cork, wood frame, headers, week rail, cards (with marker auto-detect, rotation, pin), threads. No interactions. Visual fidelity is the deliverable.

**Scope**
- `tokens.ts` exporting the canonical color / surface / font / metric values from CLAUDE.md §4.
- `<Board />` component, props: `board: Board`, `cellW?`, `cellH?`, `railW?`, `headerH?`, `frame?`.
- `<Card />` component, props: derived from a `Card`.
- `<Thread />` component, renders the SVG path between two card positions.
- A `BoardRepository` interface (read methods only this phase: `load(slug): Promise<Board | null>`).
- Two implementations: `InMemoryRepository` (tests) and a stub `LocalStorageRepository` returning a hard-coded demo board.
- App boots, loads demo board, renders.

**Out of scope.** Hover states, click handlers, drag, popovers, toolbar.

**Session kickoff prompt**
```
Implement Phase 2 of BUILD_PLAN.md. Render a Board to the DOM with full visual
fidelity to design/screens.jsx (HeroBoardScreen). Reference design/board.jsx
for exact metrics — they're authoritative. No interactions. Capture before/
after screenshots in reviews/phase-2.md against the hero artboard.
```

**TDD plan**
- RTL: `<Card>` renders text, applies marker font when text matches all-caps regex, applies rotation as a transform style, has a pin head with the chosen color.
- RTL: `<Board>` renders 5 day headers, N week rows, and one card per `board.cards` entry positioned at the right cell.
- RTL: `<Board>` renders one thread per `board.threads` entry as an `<svg>` `<path>` with the correct stroke and the correct sag for the distance.
- Visual regression (Playwright `expect(page).toHaveScreenshot()`): hero board matches design within tolerance.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit (RTL) | ~12 | Card, Board, Thread rendering |
| E2E + visual | 1 | Hero board screenshot |

**Quality gates**
- Visual regression baseline committed and matched.
- Lighthouse performance ≥ 90 on a populated 26-week board (run via Playwright).
- The 8-color palette is the *only* set of fills used on cards (assert by enumerating CSS).

**Critical review report — `reviews/phase-2.md`**
- Side-by-side: design artboard (hero) and current build, exported.
- Pixel-diff summary if any.
- Performance numbers.
- Anything visually compromised and why (with a deferred-work ticket).

---

## Phase 3 — Cards: create, edit, recolor, delete

**Goal.** Workflows 01 and 04 fully working with persistence via `LocalStorageRepository`.

**Scope**
- Click empty cell → blank peach card + caret + edit popover docked below.
- Type → live update (and live marker-font switch when going all-caps).
- Enter or blur → commit + persist + close popover.
- Esc → cancel (if newly created, remove; if edited, revert).
- Click existing card → edit popover with text input pre-filled and 8 swatches; clicking a swatch recolors live.
- Delete button on popover removes card and attached threads.
- Cmd/Ctrl-Z is **not** implemented in this phase (Phase 6).
- `LocalStorageRepository` saves on every mutating action behind a 250ms debounce.

**Out of scope.** Drag, multi-card-in-cell visual stacking, undo/redo, threads, toolbar.

**Session kickoff prompt**
```
Implement Phase 3 of BUILD_PLAN.md — workflows 01 and 04. Use the domain
operations from Phase 1; do not duplicate any logic in components.
LocalStorageRepository persists on a 250ms debounce. Pin behavior and rotation
must remain stable across edits (CLAUDE.md invariant 6).
```

**TDD plan**
1. Integration: clicking an empty cell mounts an edit popover and focuses the input. The board state shows a new peach card immediately (optimistic).
2. Integration: typing updates the rendered card live.
3. Integration: pressing Enter commits and closes the popover; the card persists in the in-memory repository.
4. Integration: pressing Esc on a *newly created* card removes it; the repository does not see a write.
5. Integration: typing all-caps switches the rendered font to Permanent Marker (per `isMarker()`).
6. Integration: clicking an existing card opens the popover with text pre-filled, no caret position jump.
7. Integration: clicking a swatch updates the card color in the DOM and in the repository.
8. Integration: clicking Delete removes the card from the DOM and the repository.
9. Integration: rotation and pin color are unchanged after edit/recolor.
10. E2E: workflow 01 storyboard reproduced (open page → click cell → type "Dress + light" → Enter → reload page → card still there).
11. E2E: workflow 04 storyboard reproduced (click card → recolor coral → close → reload → coral).

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~6 | Popover behavior, debounce |
| Integration | ~12 | The numbered scenarios above |
| E2E | 2 | Workflows 01 and 04 |

**Quality gates**
- The debounce window is exactly 250ms (asserted with fake timers).
- Persistence layer is touched only by repository — components do not call `localStorage` directly (enforced by ESLint).
- Lighthouse a11y ≥ 95 on the editing screen.

**Critical review report — `reviews/phase-3.md`**
- Screen recording / GIF of workflows 01 and 04.
- One paragraph on any UX decisions that diverged from the storyboards.

---

## Phase 4 — Cards: drag / move and multi-card stacking

**Goal.** Workflow 02 fully working. Multi-card-in-cell renders correctly (the design allows it; cards stack/overlap slightly rather than resizing the grid).

**Scope**
- Press-and-hold (80ms) a card lifts it: scale 1.05, larger shadow, rotation reset to 0.
- Drag highlights the nearest cell in blue with a hairline outline.
- Release snaps to the cell center over 120ms ease-out.
- Threads connected to the moved card re-route live during drag.
- Two or more cards in the same cell stack with slight x/y offset (`ox`, `oy`) and `z-index` by insertion order.
- Touch and pointer events both supported.

**Out of scope.** Threads creation (Phase 5), undo (Phase 6).

**Session kickoff prompt**
```
Implement Phase 4 of BUILD_PLAN.md — workflow 02 + multi-card cell stacking.
Use pointer events. Press-and-hold threshold is 80ms; snap animation is 120ms
ease-out; both pinned by tests. Threads must follow the dragged card live.
```

**TDD plan**
1. Integration (fake timers): mousedown on a card for 80ms triggers the lift state (scale and shadow).
2. Integration: mousedown for <80ms followed by mouseup is a click (opens edit popover).
3. Integration: dragging over a cell highlights it with the same blue tint as Phase 3 cell hover.
4. Integration: drop on an empty cell moves the card; repository receives one write.
5. Integration: drop on the same cell is a no-op (no repository write).
6. Integration: dropping into an already-occupied cell stacks both cards with non-zero `ox`/`oy`.
7. Integration: while dragging, the live thread endpoints update on every frame to the card's current pointer position.
8. Integration: snap animation duration is 120ms (asserted via mocked clock).
9. E2E: workflow 02 storyboard reproduced.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~10 | All scenarios above |
| E2E | 1 | Workflow 02 |

**Quality gates**
- Dragging is 60fps on a 26-week board with 60 cards (asserted via Playwright trace, frame drops < 2).
- Touch support verified in Playwright mobile emulation.
- No layout thrash during drag (use `transform`, not `top`/`left`).

**Critical review report — `reviews/phase-4.md`**
- Frame-rate trace under load.
- Anything sacrificed to hit 60fps.

---

## Phase 5 — Threads: create, delete, follow

**Goal.** Workflow 03 fully working.

**Scope**
- Hovering a card reveals a small red "thread handle" at its top-right corner.
- Press-drag from handle draws a dashed in-progress line that follows the pointer.
- Release on another card creates a thread (committed, persisted).
- Release on empty space cancels.
- Click a thread (6px hit area) flashes it red for 100ms then deletes it.
- Threads update their path live when either endpoint card is moved (already done in Phase 4 for the dragged card; here for the general case).

**Out of scope.** Thread editing, labels, styling.

**Session kickoff prompt**
```
Implement Phase 5 of BUILD_PLAN.md — workflow 03. Endpoint identity is the
card ID, never the array index (CLAUDE.md invariant 10). A self-thread or
duplicate is rejected silently (no error, no toast). Click hit area on
threads is 6px wide; assert with a Playwright bounding-box check.
```

**TDD plan**
1. Integration: hovering a card shows the thread handle; leaving the card hides it.
2. Integration: drag from handle creates the dashed temporary path.
3. Integration: release on a different card commits the thread; repository sees one write.
4. Integration: release on the same card or empty space discards.
5. Integration: clicking a thread shows the 100ms red flash, then removes from DOM and repository.
6. Integration: deleting a card via Phase 3 popover also removes any thread that referenced it (invariant 9).
7. Integration: moving an endpoint card (Phase 4) updates the thread path live.
8. E2E: workflow 03 storyboard reproduced.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~10 | All scenarios above |
| E2E | 1 | Workflow 03 |

**Quality gates**
- A thread that references a deleted card cannot exist in any rendered state (invariant 9).
- The thread hit area is verifiable (Playwright `boundingBox()` includes 6px around the path).

**Critical review report — `reviews/phase-5.md`**
- Screenshots of in-progress drag, committed thread, and deletion flash.

---

## Phase 6 — Toolbar, undo/redo, week range

**Goal.** Workflows 06 and the missing pieces of the toolbar.

**Scope**
- Toolbar (top-right, fixed): `Weeks N · Undo · Redo · Share`.
- Undo/Redo: stack of board snapshots, capacity 50. Keyboard shortcuts `Cmd/Ctrl-Z` and `Cmd/Ctrl-Shift-Z`.
- `Weeks N` opens a stepper (4–52).
- Shrinking that would cut off cards prompts: *"N cards would be cut off — continue?"*. Cards are preserved off-board (invariant 8).
- Share button opens the dialog (URL + Copy + summary). Copy puts the URL in the clipboard. Network sharing remains stubbed.

**Out of scope.** Real backend, real sharing across users.

**Session kickoff prompt**
```
Implement Phase 6 of BUILD_PLAN.md. Undo/redo is a snapshot stack of size 50;
all mutating operations push to it. Re-do is cleared on a fresh mutation.
Keyboard shortcuts are global. Shrink-warning dialog is modal and dismissible.
The Share dialog is real chrome but uses the still-local repository.
```

**TDD plan**
1. Integration: every mutating action (add card, edit, move, delete, add thread, delete thread, resize weeks) pushes a snapshot.
2. Integration: Cmd-Z reverts the last action and updates the UI.
3. Integration: Cmd-Shift-Z re-applies; a fresh mutation clears the redo stack.
4. Integration: stack capped at 50; oldest dropped first.
5. Integration: shrinking weeks below `max(card.week)+1` shows the warning; canceling does not mutate.
6. Integration: shrinking → confirm → regrow restores the off-board cards (invariant 8).
7. Integration: Share dialog Copy puts the right URL in `navigator.clipboard`.
8. E2E: workflow 06 storyboard reproduced.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~10 | All scenarios above |
| E2E | 1 | Workflow 06 |

**Quality gates**
- Undo stack is bounded; verified by a stress test that performs 60 actions.
- Keyboard shortcuts do not fire while a text input is focused (verified).

**Critical review report — `reviews/phase-6.md`**
- A 60-step undo→redo cycle screen recording.
- Confirmation that no action is *only* available via the keyboard (all actions reachable by mouse).

---

## Phase 7 — Persistence, URL routing, real sharing

**Goal.** Workflow 05 fully working with a real backend.

**Decision point.** This phase opens with a one-page decision doc in `reviews/phase-7-backend-decision.md` evaluating the three candidates (Cloudflare Workers + Durable Objects, Supabase, Node + SQLite + WebSockets). Pick one, commit, then implement.

**Scope**
- `/b/<slug>` routing. Unknown slug → create empty board at that slug.
- New board UI generates a slug (adjective-noun-number) and redirects to its URL.
- `RemoteRepository` implements the same `BoardRepository` interface used everywhere.
- Debounced writes (250ms) on every mutation.
- Multi-user updates: incoming changes apply with LWW per card and per thread (invariant 4).
- Share dialog shows the real URL and the real `lastEdited` / `cardCount` / `threadCount` summary.
- Optimistic UI: local mutations show immediately; server confirmation does not re-render.

**Out of scope.** Conflict warnings, presence indicators, cursors, comments. None of those exist in v1.

**Session kickoff prompt**
```
Implement Phase 7 of BUILD_PLAN.md. First commit the backend decision doc.
Then implement RemoteRepository, URL routing, slug generation, optimistic
updates, and last-writer-wins merge per card/thread. Two browser tabs must
be able to edit the same board and see each other's changes within 1 second.
```

**TDD plan**
1. Integration: visiting `/b/unknown-slug` creates a fresh empty board at that slug.
2. Integration: any mutation is debounced 250ms then sent to the backend.
3. Integration: incoming server update merges by card-id LWW.
4. Integration: an incoming delete of a card I'm currently editing closes my popover (no data loss for unsent text).
5. E2E (two browser contexts): tab A adds a card, tab B sees it within 1s.
6. E2E (two contexts): both tabs edit the same card's color; the later write wins.
7. E2E (two contexts): tab A deletes a card; tab B's thread referencing it disappears.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Unit | ~5 | LWW merge, slug generation |
| Integration | ~10 | Routing, repository, debounce |
| E2E | 3+ | Multi-tab scenarios |

**Quality gates**
- Two-tab convergence verified by Playwright (cross-context).
- Network failure: writes queue and retry; no data loss on a 30s offline window.
- Backend exposes only the two operations needed: `loadBoard(slug)`, `applyChange(slug, change)`. Nothing else.

**Critical review report — `reviews/phase-7.md`**
- Architecture diagram of the backend.
- Decision doc with the alternatives considered.
- Two-tab demo recording.
- Failure-mode log: what happens on backend outage, on stale tab, on conflicting deletes.

---

## Phase 8 — Polish, a11y, perf, launch readiness

**Goal.** Ship it.

**Scope**
- Keyboard nav: Tab cycles cells; Enter on a cell opens add-card flow; arrow keys nudge selected card; Delete removes selected card.
- Screen reader: every card is announced as "card, color X, text Y, week Z, day D"; every thread as "thread from … to …".
- Contrast: all chrome text meets WCAG AA against its surface.
- Focus rings: visible (not the design's selected-blue alone) when navigation is keyboard.
- Performance: time-to-interactive on 26-week board with 80 cards ≤ 1.5s on a mid-spec laptop.
- Cross-browser smoke: Chrome, Firefox, Safari, Edge — full E2E suite green in each.
- Empty / error / loading states per design `screens.jsx`.
- 404 board (rare given "any slug works", but a real 500 from the backend has a message).
- README written for a new developer; explains how to run and how to deploy.

**Out of scope.** Mobile-first layout (deferred to v2).

**Session kickoff prompt**
```
Implement Phase 8 of BUILD_PLAN.md. Focus: a11y, perf, cross-browser, polish.
Audit results land in reviews/phase-8.md with Lighthouse, axe, and a manual
keyboard-only walkthrough. README is the new-developer entry point — review
it after a fresh `git clone` simulating onboarding.
```

**TDD plan**
1. Integration: axe-core runs as part of unit tests for every screen; zero violations.
2. Integration: keyboard-only walkthrough scripted in Playwright — full add/edit/move/thread/delete cycle without a mouse.
3. Integration: screen reader announcements verified via `getByRole` + `getByLabelText` assertions.
4. E2E: full suite runs in all four browsers in CI.
5. Visual regression: golden screenshots from Phase 2 still match.

**Test inventory**
| Level | Count | What |
|---|---|---|
| Integration | ~8 | a11y per screen |
| E2E | full suite × 4 browsers | Cross-browser smoke |

**Quality gates**
- Lighthouse: performance ≥ 90, accessibility = 100, best-practices ≥ 95, SEO ≥ 90.
- axe-core: zero violations on every primary screen.
- Bundle size ≤ 250kb gzipped (excluding fonts).

**Critical review report — `reviews/phase-8.md`**
- Lighthouse scores, axe report.
- Cross-browser screenshot grid.
- A "what we cut" list — everything intentionally not done for v1.
- Sign-off: ready to launch / list of blockers.

---

## Critical review report template

Copy this into `reviews/phase-N.md` at the end of each phase.

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
