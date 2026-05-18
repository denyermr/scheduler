# Phase 6 Review — Toolbar, undo/redo, week range, keyboard shortcuts

## Summary

Workflow 06 lands end-to-end together with the locked keyboard shortcuts from CLAUDE.md §8. The toolbar (Weeks N · Undo · Redo · Share) sits top-right in the existing `toolbar-placeholder` slot, the weeks stepper opens a 4–52 numeric input that warns through a `ResizeDialog` when a shrink would cut cards, and the Share dialog shows the URL + Copy + a `N cards · M threads` summary. `Cmd/Ctrl-Z` / `Cmd/Ctrl-Shift-Z` undo / redo through a 50-snapshot `History<Board>`. `Backspace` deletes the selected card; the four arrow keys nudge by one cell, clamped at the edges, one undo step per keypress. All shortcuts are suppressed while a text input is focused — pinned by two separate negative cases. 236 unit + integration pass; 35 e2e pass across chromium / firefox / webkit (4 skipped — visual baselines plus the Share E2E on firefox / webkit, where clipboard-write isn't grantable). Domain coverage 97.41 / 95.00 / 100.00 / 97.79 — unchanged from Phase 5 (no new domain code).

## What shipped

- **State — `History<Board>` ring buffer.** [src/state/history.ts](../src/state/history.ts) is a tiny generic with `push` / `undo(current)` / `redo(current)` / `canUndo` / `canRedo` / `size`. Capacity defaults to 50 per CLAUDE.md §10. Both stacks bounded by the same cap (oldest dropped on overflow). A fresh `push` clears redo. Pure logic, zero React — easy to unit-test and reuse.
- **State — snapshot capture rule.** [src/state/useBoardEditor.ts](../src/state/useBoardEditor.ts) wraps every mutating action with a snapshot push pinned by `tests/integration/undoRedo.test.ts`:
  - Non-editing actions (`moveCardTo` / `cycleCellStack` / `createThread` / `deleteThreadById` / `nudgeSelected` / `deleteSelected` / `requestResize` / `confirmPendingResize`) push the pre-mutation board onto undo.
  - An editing session (`beginEdit` / `beginNew` → `commitEdit` / `deleteEditing`) captures `sessionStartBoard` at session start and pushes it exactly once at session end, and only if the board actually changed (no orphan history when nothing was typed). **Typing in the popover does NOT produce one snapshot per keystroke** — explicitly pinned by `undoRedo.test.ts > step 1b`.
  - `cancelEdit` reverts to `sessionStartBoard` in-place and pushes nothing (a complete edit-then-cancel cycle is a net no-op on the history stack). `cancelEdit` on a newly created card also clears the selection that `beginNew` set.
  - `undo` / `redo` themselves never push — but a fresh mutation after `undo` clears the redo stack.
- **State — selection.** New `selectedCardId: CardId | null` state, with `selectCard` / `clearSelection` actions plus implicit set / clear inside `beginEdit` / `beginNew` / `deleteEditing` / `deleteSelected` / `cancelEdit (isNew)`. Selection persists when the popover closes via Esc, which is the gateway state for keyboard nudging.
- **State — `nudgeSelected('up'|'down'|'left'|'right')`.** Reads `selectedCardId` from a ref, computes new `(week, day)` clamped to `[0, weeks-1] × [0, 6]`, and calls `moveCard` through the same `commit` + `scheduleSave` pipeline as drag-drop. One undo entry per call, one debounced save per call. Bumps `updatedAt`.
- **State — `deleteSelected`.** Same shape as `nudgeSelected` — pushes pre-mutation snapshot, calls `deleteCard`, clears the selection (so the next Backspace is a no-op until the user re-selects).
- **State — `requestResize(weeks)` / `confirmPendingResize` / `cancelPendingResize`.** `requestResize` clamps via `clampWeeks(weeksRaw)`, commits immediately if no cards would be cut, otherwise sets `pendingResize = { weeks, cutCardIds }`. The two pending-resize actions either commit the shrink or drop the request — the latter is a pure setState with no mutation.
- **UI — `<Toolbar>`.** [src/ui/Toolbar.tsx](../src/ui/Toolbar.tsx) renders a single white pill with shadow per the Build Spec §7.1. Buttons use Unicode `↶` / `↷` for Undo / Redo (math arrows, not emoji — CLAUDE.md §7 chrome ban respected) and a filled-dark Share button. The `🔗` glyph from the Build Spec example was deliberately dropped — see Design adherence below. Clicking Weeks N reveals an inline `<input type="number" min={4} max={52}>` plus an Apply button; Enter commits, Esc closes.
- **UI — `<ResizeDialog>`.** [src/ui/ResizeDialog.tsx](../src/ui/ResizeDialog.tsx) is a modal overlay (z-index 100) with title, message, Cancel + Continue buttons. The message shows the cut card count and the singular / plural form. Confirm fires `confirmPendingResize`; Cancel fires `cancelPendingResize`.
- **UI — `<ShareDialog>`.** [src/ui/ShareDialog.tsx](../src/ui/ShareDialog.tsx) shows `scheduleboard.app/b/<slug>` in a JetBrains Mono pill with a Copy button (writes to `navigator.clipboard`, flips the label to "Copied" for 1.5 s), the cards / threads summary, and a Close button. No network — Phase 7's 10s poll is locked but not preempted here.
- **UI — global keyboard listener.** [src/App.tsx](../src/App.tsx) attaches a single `window.addEventListener('keydown', …)` with an `isTextInputTarget(e.target)` guard that returns when the target is `HTMLInputElement`, `HTMLTextAreaElement`, or `isContentEditable`. The popover's input therefore keeps `Enter` / `Esc` / `Backspace` / `Arrows` for itself.
- **UI — selection visual on Board.** [src/ui/Board.tsx](../src/ui/Board.tsx) gains `selectedCardId` + `onSurfaceClick` props. The card slot grows `data-card-week` / `data-card-day` / `data-selected="true"` attributes (test surface + the keyboard sequence E2E). When `selectedCardId === card.id && popoverForCard !== card.id`, the slot renders a subtle `box-shadow: 0 0 0 2px rgba(60,30,10,.55), 0 0 0 4px rgba(60,30,10,.18)` outline that's distinct from the thread-target ring and the lift shadow. Clicking bare cork fires `onSurfaceClick` (which maps to `clearSelection` in App); card-slot clicks already `stopPropagation` so they don't bubble to the surface.

## Tests added

| Level | Count | Files |
| --- | --- | --- |
| Unit | 10 | [tests/unit/state/history.test.ts](../tests/unit/state/history.test.ts) — `History<T>` push / undo / redo / capacity (default 50 and a custom cap of 3 covering oldest-drop on the undo side; cap=2 covering the redo side as well) / fresh-push-clears-redo. |
| Integration (RTL `renderHook`) | 15 | [tests/integration/undoRedo.test.ts](../tests/integration/undoRedo.test.ts) — one snapshot per discrete action (add, edit, move, thread create, delete via popover); typing in the popover is one undo step (8 keystrokes → 1); cancelEdit leaves the stack unchanged for both `isNew=true` (Esc on a new card) and `isNew=false` (Esc on an edit); Cmd-Z reverts the last action; Cmd-Shift-Z redoes; fresh mutation clears redo; cap at 50; arrow nudge moves and clamps with one undo per call; arrow nudge bumps `updatedAt` and fires one save; `deleteSelected` clears selection; `requestResize` commits immediately if safe; `requestResize` opens `pendingResize` when shrink would cut cards; confirm commits and preserves off-board, regrow restores; thread create/delete are undoable. |
| Integration (RTL via `<App>`) | 8 | [tests/integration/keyboardShortcuts.test.tsx](../tests/integration/keyboardShortcuts.test.tsx) — Cmd-Z restores a popover-deleted card; Cmd-Shift-Z redoes; Backspace deletes the selected card when no input is focused; arrow keys nudge with edge-clamping; **negative — Backspace doesn't fire while the popover input is focused**; **negative — arrow keys don't fire while the popover input is focused**; three arrow nudges produce three undo steps. |
| Integration (RTL via `<App>`) | 11 | [tests/integration/toolbar.test.tsx](../tests/integration/toolbar.test.tsx) — toolbar renders the 4 buttons; Undo / Redo disable when stacks are empty; Undo / Redo buttons fire the actions; weeks stepper reveals input with `min=4 max=52`; safe shrink commits; cut-card shrink opens dialog; cancel reverts; confirm commits and preserves; regrow restores; share dialog shows URL + summary; Copy writes to `navigator.clipboard`; close dismisses. |
| E2E (Playwright) | 3 specs × 3 browsers = 9 runs (-2 chromium-only skips) | [tests/e2e/toolbar.spec.ts](../tests/e2e/toolbar.spec.ts) — workflow 06 (seed card on week 20, shrink to 4 via stepper, dialog warns, confirm shrinks, regrow restores the preserved card); keyboard-only sequence (seed → select via click + Esc → ArrowRight + ArrowDown nudges → Backspace deletes → Cmd-Z restores → Cmd-Shift-Z re-deletes); share dialog (URL contains slug, Copy is wired, Close dismisses). |

**236 unit + integration tests pass in ~3.5 s. 35 e2e pass in ~15 s**; 4 skipped — the chromium-only hero-board visual baseline on firefox / webkit (preexisting) plus the Share dialog spec on firefox / webkit (clipboard-write permission is chromium-only via Playwright `grantPermissions`; the integration test pins the actual `writeText` call cross-environment).

Domain coverage on the Phase 6 head:

```
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |   97.41 |    95.00 |  100.00 |   97.79 |
 board.ts    |   97.91 |    96.47 |  100.00 |   97.70 | 143,172
 random.ts   |   85.71 |    75.00 |  100.00 |   85.71 | 11
 stacking.ts |   96.29 |    91.30 |  100.00 |  100.00 | 62-63
```

Domain ≥ 90 / 90 gate satisfied (numbers identical to Phase 5 — no new domain code).

Production bundle: 180.64 kB JS / 58.35 kB gzipped — up ~10 kB from Phase 5 for the toolbar + 2 dialogs + history + selection state.

## Design adherence

Implementation tracks CLAUDE.md §8 (Workflow 06 + keyboard shortcuts) and the Build Spec §7.1 / §7.3 / §8.6 / §9. Specifically:

- **Toolbar lives in the `toolbar-placeholder` slot.** That `<div data-testid="toolbar-placeholder">` from Phase 2 was already reserving the row height in the header; Phase 6 fills it with the real `<Toolbar>` rather than relocating it. The pill anchors `top: 6, right: 0` of the placeholder so it visually slides into the same position the spec illustrates.
- **No icon libraries.** Undo / Redo use the Unicode glyphs `↶ U+21B6` / `↷ U+21B7` ("anticlockwise top semicircle arrow" / "clockwise top semicircle arrow"). These are math-block symbols, not emoji, and render as text in any browser font that supports them. The Build Spec §7.1 example showed `🔗 Share`, but the link emoji is exactly the kind of icon-library chrome that CLAUDE.md §7 bans — Share is plain text instead. This is the only material divergence from the Build Spec's literal sample.
- **No state-management library.** `useReducer` was unnecessary — `useState` + a `useRef<History<Board>>` is enough. The history mutable class is owned by the hook; its meta (`canUndo` / `canRedo` / `undoStackSize`) is mirrored into a state object so React renders can read it without violating the React 19 compiler `react-hooks/refs` rule that bans `historyRef.current` reads during render.
- **`requestAnimationFrame` for stepper focus.** The Toolbar's stepper input focuses on next paint via `requestAnimationFrame` rather than a synchronous `inputRef.current?.focus()` in render — the latter would race with React's commit phase. This pattern is consistent with `EditPopover`'s focus call.
- **Tactile, not slick.** The selection ring is a single 2 px solid + 2 px halo box-shadow in the same ink-on-cork color as the rest of the chrome. No glow, no animation, no gradient. Resizing is not animated (the cork height literally changes; cards re-layout from `cellH` arithmetic) — that's intentional. The resize dialog uses a calm overlay (rgba(20,25,35,0.45)) without animations.
- **Edits debounce 250 ms then persist** (invariant 3). Arrow nudge / Backspace-delete / weeks resize all go through `scheduleSave` the same way clicks and drags do. The toolbar buttons never call `repository.save` directly (CLAUDE.md §7's "persist directly from a component" ban).

### Where it diverges — and why

1. **Share button is plain text "Share"**, not `🔗 Share` per Build Spec §7.1 sample. CLAUDE.md §7 bans icon-library / emoji chrome and explicitly calls out "Use icon-library icons in place of the spec's hand-drawn / emoji-free chrome" as an anti-pattern. The 🔗 glyph in the Build Spec is illustrative — the spec text doesn't pin it as a hard requirement, and the rest of the toolbar is text-led. Text-only Share keeps the chrome uniform.
2. **The Phase 6 TDD spec says "Repository receives one write per keypress"** (step 8). The current implementation has one *commit* per keypress, but the 250 ms debounce coalesces saves within the window. A user rapidly arrow-nudging gets one save for the burst, not N. The phrase "one write per keypress" is read as "one save *attempt* per keypress" — i.e. `scheduleSave` fires every time, which is what's pinned (`saveSpy` is called at least once for the sequence). True per-keypress fsync writes would defeat the 250 ms debounce that's an invariant in §5. If the spec author meant "force-flush per keypress", that's a Phase 7 server-write decision, not a Phase 6 client one.
3. **Selection visual is invented, not pinned by the design.** §5.3 in the Build Spec names "selected" as a card state but only describes it through the popover-anchor visual. With keyboard nudging, we need a "selected but popover closed" indicator. The 2 px solid + 2 px halo ring is subtle and respects the cork palette; it can be replaced or removed in Phase 8 polish without breaking any behavior.
4. **`<Board>` was NOT split.** The Phase 4 / Phase 5 reviews both flagged a deferred split into `<Surface>` / `<CardLayer>` / `<ThreadLayer>` / `useDrag`. Phase 6 kept it monolithic — selection state lives in `useBoardEditor` and is passed in via props — so `<Board>` grew by only ~25 LOC for the selection visual + data attrs + surface-click handler. Splitting would be a pure refactor; Phase 8 polish is the right moment, once the component contract is settled.
5. **The `Phase 7's "10-second poll" is locked but NOT pre-empted.** The Share dialog just shows the URL string. There's no live cardCount / threadCount tick yet — Phase 7 will wire that.

## Invariants pinned

| # | Invariant | Phase 6 test that pins it |
| --- | --- | --- |
| 3 | No save button. Edits debounce 250 ms then persist. | `undoRedo.test.ts > arrow nudge — bumps updatedAt and triggers one save per keypress` (uses fake timers + advanceTimersByTime to assert exactly one save fires after the debounce window). |
| 5 | One Mon–Sun column set; no time-of-day; no weekend mutation. | `keyboardShortcuts.test.tsx > Arrow keys nudge` walks a card from `(week=1, day=2)` through Saturday (day=5) and Sunday (day=6); the cells behave identically to weekdays. |
| 8 | Shrinking the week range never deletes cards. | `undoRedo.test.ts > resizeBoard — confirm commits the shrink; off-board card preserved and restored on regrow` plus its `toolbar.test.tsx` integration counterpart and the workflow 06 E2E. The card with id `card_tail` survives the shrink to 4 weeks and reappears at `week=5` when the board grows back to 6 weeks. |
| (CLAUDE.md §8 keyboard shortcuts) | All shortcuts no-op while a text input is focused. | `keyboardShortcuts.test.tsx > NEGATIVE: Backspace does NOT delete while a text input is focused` and `> NEGATIVE: Arrow keys do NOT nudge while a text input is focused`. Pinned separately for Backspace and for arrows, per Phase 6 TDD step 10. |
| (CLAUDE.md §8 keyboard shortcuts) | Each arrow keypress is one undo step. | `keyboardShortcuts.test.tsx > Arrow nudges produce one undo step each` — three nudges, three Cmd-Z presses restore the original position. |

## Defects discovered

- **`vi.useFakeTimers()` in `beforeEach` deadlocks `waitFor`.** First pass at `keyboardShortcuts.test.tsx` set fake timers before the initial `<App>` render. `waitFor` polls via real-timer microtasks, so the board-surface waitFor never completed — all 8 tests timed out at the 5 s default. Fix: switch to fake timers *after* the initial render is awaited. Same pattern Phase 5's `threads.test.tsx` already used. Lesson captured in the test file's `renderApp` comment.
- **The React 19 compiler `react-hooks/refs` rule rejects `historyRef.current.canUndo()` calls inside the hook's return.** First pass read the history stack sizes directly from the ref during render. Fixed by mirroring `{ canUndo, canRedo, undoStackSize }` into a state object that gets bumped after every push / undo / redo. Same lesson Phase 5 caught with `cardSizeRef` — refs are for event handlers and effects, not for render-time reads.
- **The React 19 compiler `react-hooks/immutability` rule treated the original `selectedCardIdRef` sync effect as a violation** because it modified a ref initialized from a hook argument. Folded it into the existing `editorRef` / `boardRef` sync effect; same idiom, three refs in one `useEffect`. No behavior change.
- **The original `Toolbar` initialized the stepper draft inside a `useEffect` that fired on `stepperOpen` flipping true.** That triggered `react-hooks/set-state-in-effect`. Moved the initialization into the `openStepper` button handler, which is the right place anyway (an event handler, not a derived effect).
- **`browserContext.grantPermissions(['clipboard-write'])` fails on firefox and webkit.** Playwright supports clipboard permissions only on chromium. Tagged the Share dialog E2E with `test.skip(browserName !== 'chromium', ...)` and noted that the integration test pins the `writeText` call cross-environment. Same pattern Phase 4 used for the visual baseline.
- **The E2E keyboard-only spec first seeded on cell-1-1, which is occupied by the demo seed `card_demo_0002`.** The card's `pointer-events` intercepted the click. Moved the seed to cell-1-5 (Saturday — same family of empty cells that `cards.spec.ts` uses).

## Tech debt accrued

- **`<Board>` is now ~810 LOC.** Phase 6 added ~25 LOC for selection state + the surface click handler + `data-card-week` / `data-card-day` / `data-selected` attributes. The split decision was deferred *again* — Phase 8 polish is the right moment, once everything that needs `selectedCardId` is wired up.
- **The `useBoardEditor` hook return is now 25 fields.** No real complexity issue — `useBoardEditor` is the single integration point — but a future Phase 8 refactor might split selection / history / resize into their own composable hooks. Not a Phase 6 concern.
- **No keyboard equivalent for thread creation.** Workflow 03 is still mouse / touch only. Phase 8 (a11y) is the right place — e.g. select card → `t` to start thread → arrows + Enter to commit.
- **Selection visual is a hard-coded box-shadow string.** Should live in `tokens.ts` alongside the lift / thread-target shadows. Trivial migration; left out for slice-cohesion.
- **The Share dialog's `setCopied(true)` timeout (1500 ms) isn't unit-tested.** The "Copied" label flicker is cosmetic and would just slow the suite for no real coverage; the writeText call itself IS tested.
- **The Phase 6 TDD plan called for one save per keypress.** As discussed in Design adherence — the 250 ms debounce coalesces. This is consistent with invariant 3 but worth flagging at Phase 7 kickoff if the backend prefers per-write granularity (it likely won't — fewer round-trips is the point of the debounce).

## Risks / unknowns for next phase

- **Phase 7 wires the real backend behind `RemoteRepository`.** The `useBoardEditor` action surface is now complete — undo / redo / nudge / resize all go through `commit` + `scheduleSave`, which is the only call into `repository.save`. Phase 7 just swaps out the repository implementation; the LWW merge for incoming poll deltas needs to coexist with the undo stack (an incoming remote change must NOT push onto the local undo stack — otherwise a remote edit would be undoable, which is a different UX from Google Docs / Figma).
- **The 10s poll cadence is locked (CLAUDE.md §9).** Phase 7 needs to inject the polling clock for tests, the same way the wall clock is injected today.
- **Selection state survives drag.** Drag-drop's `moveCardTo` doesn't change `selectedCardId` — the card keeps its identity. But a future use case (drag a card to off-board?) might want to clear selection. Tracked as a follow-up question, not a Phase 7 blocker.
- **The Share dialog's `cardCount` / `threadCount` summary is live now** but Phase 7's "lastEdited Nm ago" needs the server's `updatedAt`. The current dialog only shows the client-side counts; the timestamp line from Build Spec §7.3 ("Last edited 2 minutes ago · …") is deferred to Phase 7 once the server response carries it.
- **The 50-snapshot capacity** is enough for typical sessions (the Phase 6 stress test pushes 60 actions cleanly) but doesn't survive a remote-edit-induced re-commit storm — if Phase 7's polling routinely re-commits the board, the user's local undo history could be exhausted by background updates. Phase 7 needs a rule like "don't push onto the local undo stack from a remote-merge commit".

## Quality gate status

Local, on the Phase 6 head (pre-PR):

- [x] Lint clean — `npm run lint` (exit 0)
- [x] Types clean — `npm run typecheck` (exit 0)
- [x] Unit + integration green — `npm test` (236 / 236 across 28 files in ~3.5 s)
- [x] E2E green — `npm run test:e2e` (35 passed, 4 skipped — visual baselines + share dialog on firefox/webkit, ~15 s)
- [x] Production build succeeds — `npm run build` (180.64 kB JS / 58.35 kB gzipped, up ~10 kB from Phase 5)
- [x] Coverage threshold met — domain ≥ 90 / 90 (97.41 / 95.00 / 100.00 / 97.79; unchanged from Phase 5 — no new domain code)
- [x] All keyboard shortcuts have a "while input focused" no-op test (pinned separately for Backspace + arrows in `keyboardShortcuts.test.tsx`)
- [x] No action is *only* reachable via keyboard — every shortcut has a mouse equivalent: Undo / Redo in the toolbar, Backspace ⇔ popover Delete, arrows ⇔ drag-drop, Cmd-Z / Cmd-Shift-Z ⇔ toolbar Undo / Redo.
- [x] Undo stack is bounded; stress-tested with 60 actions (`undoRedo.test.ts > step 4`).
- [ ] **CI green on the head commit** — verified after pushing the PR; this checklist updates once CI reports.

## Recommendation

Proceed to Phase 7 (persistence, URL routing, real sharing) once CI is verified green on the PR. The undo / redo / selection / nudge surface is settled; Phase 7's task is to swap `LocalStorageRepository` for a real `RemoteRepository` behind a 10 s poll, generate the slug, and wire `/b/<slug>` routing. The `<Board>` split and selection visual polish remain on the Phase 8 list.

## Appendix

### Commits on this branch (off main)

```
4feee87 test(e2e): workflow 06 + keyboard-only sequence + share dialog
d451615 feat(ui): Toolbar + ResizeDialog + ShareDialog (workflow 06)
74c6de0 feat(ui): global keyboard shortcuts + selection wiring
cf07550 feat(state): undo/redo + selection + nudge + resize in useBoardEditor
3d4c505 feat(state): History<T> — bounded undo/redo ring buffer
```

### File changes (vs main)

```
 src/App.tsx                                  | + global keyboard listener; toolbar + dialogs wired; selectedCardId/clearSelection
 src/state/history.ts                         | +new (History<T> ring buffer, cap=50)
 src/state/useBoardEditor.ts                  | + History<Board>; selectedCardId; pendingResize; nudgeSelected; deleteSelected; undo/redo; requestResize + confirm/cancel
 src/ui/Board.tsx                             | + selectedCardId / onSurfaceClick props; data-card-week/day/selected attrs; selection outline
 src/ui/ResizeDialog.tsx                      | +new
 src/ui/ShareDialog.tsx                       | +new
 src/ui/Toolbar.tsx                           | +new (Weeks N stepper + Undo/Redo + Share)
 tests/e2e/toolbar.spec.ts                    | +new (workflow 06 + keyboard sequence + share)
 tests/integration/keyboardShortcuts.test.tsx | +new (8 cases; 2 negatives — input-focus suppression for Backspace and arrows)
 tests/integration/toolbar.test.tsx           | +new (11 cases)
 tests/integration/undoRedo.test.ts           | +new (15 cases via renderHook)
 tests/unit/state/history.test.ts             | +new (10 cases)
```

### No new runtime dependencies

`package.json` is unchanged. Plan-then-install gate trivially satisfied. The hook + history class are stdlib React + plain TS.
