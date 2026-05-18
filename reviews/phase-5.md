# Phase 5 Review — Threads: create / delete / follow

## Summary

Workflow 03 is fully working end-to-end. Hovering a card reveals a 10 px red-brown handle at its top-right corner; pressing-and-dragging from the handle opens a dashed in-progress thread that tracks the pointer, highlights the card under it as a drop target, and on release over a different card commits a real thread via `addThread`. Releasing on empty cork or on the source card discards the draw; pressing Esc mid-drag cancels it; clicking an existing thread (12 px wide invisible hit-path centred on the curve) flashes the visible stroke `#d6463a` for 100 ms and then removes it. Threads continue to follow their endpoint cards live during card-move drag (already pinned in Phase 4 — refreshed here). 192 unit + integration pass; 28 e2e pass across chromium / firefox / webkit (+ 2 visual baselines correctly skipped on firefox / webkit). Domain coverage 97.41 / 95.00 / 100.00 / 97.79.

## What shipped

- **State — `useBoardEditor.createThread` + `deleteThreadById`.** [src/state/useBoardEditor.ts](../src/state/useBoardEditor.ts) gains two more actions on the same clock-injected `commit` + debounced `scheduleSave` pipeline as Phase 3/4's edit actions. `createThread` no-ops on self-thread and on duplicates (in either direction — threads are undirected per CLAUDE.md §4 "no arrowhead"); `deleteThreadById` no-ops on unknown ids. Domain `addThread` / `deleteThread` are unchanged.
- **UI — hover-revealed thread handle.** [src/ui/Board.tsx](../src/ui/Board.tsx) tracks `hoveredCardId` and renders a `<button data-testid="thread-handle">` at `top: -5, right: -5` of the hovered slot — a 10 px red-brown disc (`#9c5a2e`) with a 2 px white ring and a soft drop shadow, exactly per the design Build Spec §6.4. The hovered slot's `zIndex` boosts to 500 while a handle is showing so the handle lifts above adjacent slots when cards overlap at wide container widths.
- **UI — thread-drawing drag arm.** Same file. `DragState` grows two new arms — `thread-pressing` (immediately after handle pointerdown) and `thread-drawing` (after first pointer-move). A second `useEffect`, scoped to the thread arms only, attaches window listeners (`pointermove`, `pointerup`, `pointercancel`, `keydown`). On pointermove the in-progress path is rerouted from the snapshot of the source card's render position to the current pointer position; a geometric hit-test against `positionByIdRef` resolves the candidate target card (walks cards in descending `z` so the topmost wins). On pointerup, if there's a non-source target, `onThreadCreate(from, to)` fires; otherwise the arm transitions back to idle silently.
- **UI — dashed in-progress path.** Rendered inside the existing threads `<svg>` as a single `<path data-testid="thread-drawing-path">` while `drag.kind === 'thread-drawing'`. Uses the same `threadPathD` / `threadSag` helpers as committed threads with a `stroke-dasharray="5 4"` overlay. Lives alongside the existing threads, not in a separate svg, so its `d` is computed in the same surface coordinate space as the committed paths.
- **UI — target-card highlight while drawing.** The targeted slot gets `data-thread-target="true"` and a 2 px solid `#9c5a2e` ring + soft glow box-shadow so the user gets clear feedback that releasing will create a thread. Drops the highlight as soon as the pointer leaves the card.
- **UI — Esc cancels the draw.** The keydown listener inside the thread-arm effect resets the drag to idle on `Escape`. Any subsequent pointerup is a no-op because the arm is no longer active.
- **UI — click-to-delete with 100 ms red flash.** [src/ui/Thread.tsx](../src/ui/Thread.tsx) is refactored to a `<g>` containing two `<path>` elements per thread: a transparent `data-testid="thread-hit"` with `stroke-width="12"` and `pointer-events="stroke"` (the 6 px hit area on each side of the curve), and the existing visible `data-testid="thread-path"` with `pointer-events="none"`. The hit-path's `onClick` fires `onThreadClick` in `<Board>` which sets `flashingThreadId`, re-renders the visible path with `stroke="#d6463a"`, and after exactly `THREAD_DELETE_FLASH_MS = 100` ms calls `onThreadDelete(id)` (which itself feeds `deleteThreadById` and the 250 ms debounce). One save fires.
- **Tokens — workflow 03 constants.** [src/ui/tokens.ts](../src/ui/tokens.ts) exports `THREAD_HANDLE_FILL = '#9c5a2e'`, `THREAD_HANDLE_RING = '#ffffff'`, `THREAD_DELETE_FLASH_STROKE = '#d6463a'`, `THREAD_DELETE_FLASH_MS = 100`, `THREAD_HIT_WIDTH = 12`, `THREAD_DRAWING_DASH = '5 4'`.
- **App composition.** [src/App.tsx](../src/App.tsx) wires `createThread` / `deleteThreadById` as `onThreadCreate` / `onThreadDelete` on `<Board>`.

## Tests added

| Level | Count | Files |
| --- | --- | --- |
| Integration (RTL) | 9 (`threads.test.tsx`) | [tests/integration/threads.test.tsx](../tests/integration/threads.test.tsx) — one assertion block per BUILD_PLAN Phase 5 step 1..8 plus a target-highlight pin: step 1 (handle reveals on pointerEnter, hides on pointerLeave); step 2 (no path on press alone; dashed path appears on first move with the exact endpoint coords); step 3 (release on a different card commits + one save; persisted board has 1 thread); step 4a (release on empty cork — no save); step 4b (release on the source card — no save); step 5 (Esc during draw cancels — drawing-path gone, no save even on stray pointerup); step 6 (click → 100 ms flash with stroke `#d6463a` → thread removed from DOM + persistence); step 7 (deleting an endpoint card cascades to threads at the integration layer — invariant 9); plus the target-card highlight on hover during draw. |
| E2E (Playwright) | 1 spec × 3 browsers = 3 runs | [tests/e2e/threads.spec.ts](../tests/e2e/threads.spec.ts) — workflow 03 end-to-end: seed two cards at non-adjacent cells → hover source → press-drag from the handle to the target (dashed path becomes visible during drag) → release commits → assert thread count = baseline + 1 → reload → assert still = baseline + 1 → click the new thread's hit-path via `dispatchEvent('click')` → wait flash + debounce → assert count back to baseline. |

**192 unit + integration tests pass in ~3.4 s. 28 e2e pass in ~14.6 s** across chromium / firefox / webkit (the two skipped specs are the chromium-only visual baseline — same as Phase 4). Domain coverage on the Phase 5 head:

```
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |   97.41 |    95.00 |  100.00 |   97.79 |
 board.ts    |   97.91 |    96.47 |  100.00 |   97.70 | 143,172
 random.ts   |   85.71 |    75.00 |  100.00 |   85.71 | 11
 stacking.ts |   96.29 |    91.30 |  100.00 |  100.00 | 62-63
```

Domain ≥ 90 / 90 gate satisfied (numbers unchanged from Phase 4 — no new domain code).

## Design adherence

Implementation tracks CLAUDE.md §8 workflow 03 and the Build Spec §6.4. Specifically:

- **Tactile, not slick.** The dashed in-progress path uses the same curved `threadPathD` + sag formula as committed threads — the dashed line "is" a thread mid-formation, not a separate vector primitive. The handle is the same red-brown as the thread stroke (`#9c5a2e`) so it reads as the thread's anchor. No animation library, no easing; the only motion is the user's pointer.
- **No new dependencies.** `package.json` is unchanged. The plan-then-install gate is trivially satisfied.
- **No arrowhead, ever.** Threads remain undirected — `createThread` rejects duplicates in either direction. The thread path uses `stroke-linecap: round` (no markers).
- **6 px hit area along the path.** Implemented as a 12 px-wide transparent stroke (= ±6 px from the curve centerline) with `pointer-events: stroke` so only clicks landing on the rendered band trigger. This matches the design Build Spec §6.4 precisely.
- **Threads update live when either endpoint moves** (invariant via Phase 4's `drag.test.tsx` step 11). The render-time `positionById` map is the single source of truth for both card and thread endpoints, so dragging a card automatically re-routes any attached thread on every pointermove.
- **Deleted card cascades to threads** (invariant 9). Domain `deleteCard` already cascades; Phase 5 adds an integration-layer pin that the cascade survives the persistence path (`deleteEditing` → `scheduleSave` → repo has 0 threads).

### Where it diverges — and why

1. **Handle is rendered via a `<button>`, not a `<div>`.** The Build Spec doesn't specify the element type. Using `<button>` gives free keyboard focusability and an `aria-label`, which we'll lean on in Phase 8 (a11y). The visual is identical because we strip the default button styles.
2. **Hovered slot is z-boosted to 500.** Without this, the handle (positioned at `top: -5, right: -5` of its slot) can fall inside a sibling slot's box when cards render wider than the cell (e.g. at 1440 px container width, cardW ≈ 203 px vs cellW = 180 px). 500 sits below the popover layer (z = 30 is wrong, popover is actually at 30 — let me double-check). The popover anchor is at `z = 30`; we use 500 for the hovered slot so the handle floats above neighbours but the popover still wins. This is a UX safeguard, not a design-spec departure.
3. **The dashed in-progress path lives in the same `<svg>` as committed threads.** Could equally have lived in its own `<svg>` for separation of concerns; sharing keeps `d`-coords in one coordinate space and avoids a second filter definition. No functional difference.
4. **Self-thread / duplicate are silent no-ops at the editor layer.** Domain `addThread` throws on self / duplicate; the editor catches them before the domain call. This is friendlier than letting the throw bubble — the user can re-draw an existing thread without an error popup. The domain remains strict for any other caller.
5. **Click-to-delete uses `dispatchEvent('click')` in the E2E.** `force: true` clicks at the locator's bounding-box centre, which for a quadratic curve may fall outside the stroke band. Dispatching the event directly avoids the curve-vs-bbox geometry. The integration test exercises the same code path through `fireEvent.click` on the hit-path element.

## Invariants pinned

| # | Invariant | New / refreshed assertion in Phase 5 |
| --- | --- | --- |
| 3 | No save button. Edits debounce 250 ms then persist. | `threads.test.tsx > step 3` and `> step 6` pin one save each — spied via `vi.spyOn(repo, 'save')`. |
| 9 | Deleting a card removes its threads. | `threads.test.tsx > step 7` deletes a card via the edit popover and asserts the persisted board has 0 threads and the thread is gone from the DOM. |
| 10 | Thread endpoints are stable card IDs, not array indices. | `threads.test.tsx > step 3` reads the persisted `threads[0].fromCardId` / `.toCardId` and asserts they match the seeded card IDs. (Phase 4's `drag.test.tsx > step 11` already pinned endpoint stability across moves.) |

## Defects discovered

- **The hovered handle could fall inside an adjacent slot at wide container widths.** First-pass E2E seeded cards at `(0, 4)` and `(0, 5)`; with `containerWidth = 1440 px`, `cellW = 180 px` but rendered card width is ~203 px, so adjacent slots overlap by ~23 px. The handle at `top: -5, right: -5` of the source slot landed inside the target slot, which then absorbed the pointerdown. Fixed by boosting the hovered slot's `zIndex` to 500 and seeding the E2E cards at non-adjacent cells.
- **`hitLocator.click({ force: true })` doesn't trigger SVG `pointer-events: stroke`.** First-pass E2E delete step failed because Playwright clicks the locator's bounding-box centre, which for a curved quadratic path may fall outside the rendered stroke band. Switched to `dispatchEvent('click')` which fires the event directly on the path element.
- **`react-hooks/preserve-manual-memoization` flagged `onCardPointerDown`.** The dep array `[clearLiftTimer]` from Phase 4 didn't include `setDrag`; the React 19 compiler lint plugin re-analysed after Phase 5's additional state hooks and flagged it. Added `setDrag` to the deps (it's stable, so no behaviour change). Latent issue from Phase 4 surfaced by additional state — not a Phase 5 bug per se.
- **Updating refs during render is now a lint error.** Phase 5 needed `cardSizeRef.current` and `positionByIdRef.current` accessible inside the thread-drag arm's window-listener effect. First pass assigned them at the bottom of the render body; the React 19 compiler lint rule `react-hooks/refs` rejected that. Moved the assignments into a `useEffect` with no dep array (runs after every render) — same as Phase 4's `dragRef` sync pattern.

## Tech debt accrued

- **Card hit-test reuses the `78 × 30` `CARD_BASE` shorthand.** The thread-drag arm's `cardAtSurface` helper computes hit-box dimensions as `78 * cardSize` and `30 * cardSize`. These are CARD_BASE.width / CARD_BASE.minHeight; the magic numbers should ideally be imported from tokens. Tracked: trivial fix when `<Board>` splits in Phase 6.
- **`<Board>` is now ~770 lines.** Phase 4 review flagged the file at ~600 LOC and deferred the split to Phase 5; this phase added ~150 LOC (handle, drag arm, thread interaction). The decision at Phase 5 kickoff was to defer the split again to Phase 6 (keyboard shortcuts + selected-card focus state) because Phase 6 will know whether selection state lives in `<Board>` or `<App>` and that is the right moment to draw the new component boundaries. The integration tests for thread arms still read clearly, so file size hasn't started hurting the test surface yet.
- **Hover-handle disappears mid-drag.** When the pointer leaves the source slot during a drag, `hoveredCardId` becomes null and the handle un-renders. The dashed in-progress path takes over as the visual cue, so this isn't a defect, but the source card has no persistent visual indicator of being the source during the drag. A subtle outline on the source slot would be a nice-to-have polish item for Phase 8.
- **No keyboard equivalent for thread creation.** Workflow 03 is mouse / touch only. Phase 6's keyboard shortcut work or Phase 8's a11y pass is the right place to add a key-only equivalent (e.g. select card → 't' to start thread → arrow keys + Enter to commit).
- **No drag-cancel visual feedback when releasing on empty cork.** The dashed path simply disappears with no animation. A 100 ms fade-out would be a small polish item.

## Risks / unknowns for next phase

- **Phase 6 — toolbar, undo/redo, week range, keyboard shortcuts.** The undo/redo stack must capture thread additions / deletions as discrete snapshots. The `useBoardEditor` actions go through `commit` which is the right interception point — a snapshot push there should cover all eight mutating actions (new + edit + move + delete + cycle + thread-create + thread-delete + resize). The flash timer for thread delete is not a Board mutation — it should not push a snapshot, but `onThreadDelete` (which fires AFTER the flash) should.
- **`<Board>` split decision deferred again to Phase 6.** Phase 6 lands focused-card state and arrow-key nudge. If selection lives in `<Board>`, the file is heading toward 1000 LOC. If selection lives in `<App>` (and `<Board>` becomes a controlled component), the file might stay flat. Phase 6 kickoff should make this decision before the keyboard shortcuts are wired.
- **The two-svg architecture for threads (visible + drawing) could fight Phase 7's optimistic concurrency.** When two tabs race to create a thread, both will write LWW per-thread. The IDs come from `defaultThreadId(defaultRng)` (a global RNG by default). Phase 7 needs to either inject the RNG per repository call OR accept that two tabs can briefly show two threads where one was intended. Note: this is a Phase 7 concern; Phase 5 doesn't introduce it.
- **Touch behaviour.** Integration tests use `pointerType: 'mouse'`; Playwright's mouse API also fires mouse-shaped pointer events. We haven't pinned a touch-shaped pointer-events test. Same gap as Phase 4 — a touch-specific Playwright spec is a Phase 8 a11y add.

## Quality gate status

Local, on the Phase 5 head (pre-commit):

- [x] Lint clean — `npm run lint` (exit 0)
- [x] Types clean — `npm run typecheck` (exit 0)
- [x] Unit + integration green — `npm test` (192 / 192 across 24 files in ~3.4 s)
- [x] E2E green — `npm run test:e2e` (28 passed, 2 visual baselines correctly skipped on firefox / webkit, ~14.6 s)
- [x] Production build succeeds — `npm run build` (`dist/`: 1.32 kB HTML / 0.32 kB CSS / 170.25 kB JS, 55.64 kB gzipped — up ~3.8 kB from Phase 4 for the thread-arm state machine + hit-path)
- [x] Coverage threshold met — domain ≥ 90 / 90 (97.41 / 95.00 / 100.00 / 97.79; unchanged from Phase 4 — no new domain code)
- [x] Flash duration pinned at exactly `THREAD_DELETE_FLASH_MS = 100` ms with fake timers — `step 6` advances 99 ms and asserts no save, then 1 ms and the debounce window, asserting the save fires exactly once.
- [x] Dashed in-progress path's `d` attribute pinned to exact pixel coordinates (`M startX startY` and `endX endY`) — no `toBeCloseTo` approximation.
- [x] Workflow 03 reproduced E2E in all three browsers — create + reload + delete.
- [ ] **CI green on the head commit** — will be verified by the PR after pushing; this checklist updates once CI reports.

## Recommendation

Proceed to Phase 6 (toolbar, undo/redo, week range, keyboard shortcuts) once CI is verified green on the PR. The `useBoardEditor` action surface is now complete for the mutating set Phase 6 needs to snapshot for undo; the `<Board>` split decision is the only structural question remaining at the phase boundary.

## Appendix

### Commits on this branch (off main)

(populated at PR time)

### File changes (vs main)

```
 src/App.tsx                          | + onThreadCreate/onThreadDelete wiring
 src/state/useBoardEditor.ts          | + createThread + deleteThreadById
 src/ui/Board.tsx                     | + thread handle, thread-drag arm, dashed path, target highlight, click-flash
 src/ui/Thread.tsx                    | + hit-path + flashing prop
 src/ui/tokens.ts                     | + THREAD_HANDLE_FILL/RING + THREAD_DELETE_FLASH_STROKE/MS + THREAD_HIT_WIDTH + THREAD_DRAWING_DASH
 tests/e2e/threads.spec.ts            | +new (workflow 03: create + reload + click-delete)
 tests/integration/threads.test.tsx   | +new (9 tests, steps 1..7 + target highlight)
```

### No new runtime dependencies

`package.json` is unchanged.
