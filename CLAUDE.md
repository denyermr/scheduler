# CLAUDE.md — Schedule Board

This file is read at the start of every Claude Code session. It is the source of truth for **what** we're building, **how** we work, and **what's already decided**. The phased work is in `BUILD_PLAN.md`.

---

## 1. Product

A digital recreation of a physical schedule board (animation-studio reference). Grid of days × weeks; colored cards pinned to cells; threads connecting related cards. URL is the identity — anyone with the link can edit. No accounts, no save button, no permissions.

Boards are link-shared by default. For boards that hold anything sensitive, the owner can set an optional per-board **passphrase lock** that encrypts contents client-side; visiting the URL then prompts for the passphrase before the board renders. The "in the room" model is preserved either way: anyone who has the link (and the passphrase, if set) is in the room. There are still no accounts, no email recovery, no roles — lose the passphrase and the board is lost.

**North star: tactile, not slick.** Cork surface, ±2° card rotation, drop-shadows, pin heads, string-with-sag threads. The board itself floats on a calm off-white page rather than sitting inside a heavy wood frame. Resist any drift toward calendar-app or productivity-SaaS conventions.

The full design spec lives in `design/` (HTML + JSX artboards). Treat it as authoritative for visual decisions. When the markdown in `design/handoff/` and the visual HTML disagree, **the markdown wins for behavior, the visual wins for look** — this convention comes from the handoff package itself.

---

## 2. Tech stack (fixed)

| Layer | Choice |
|---|---|
| Language | TypeScript, strict mode |
| Framework | React 18 |
| Build | Vite |
| Unit / integration | Vitest + React Testing Library |
| E2E | Playwright |
| Lint | ESLint (typescript-eslint strict + react-hooks) |
| Format | Prettier |
| Commit hooks | Husky + lint-staged |
| CI | GitHub Actions (or equivalent) |
| Persistence (Phases 1–6) | `BoardRepository` interface, localStorage impl |
| Persistence (Phase 7) | **Node + SQLite** via single-file `node:http` + `better-sqlite3` server (`server/`); opaque-blob-per-slug schema. Sync mechanism locked to **10s poll** (see §9). Detail in `reviews/phase-7-backend-decision.md`. |

Do **not** introduce additional runtime dependencies without justification in the phase review.

---

## 3. Source layout

```
/
├── design/                  # The handed-off design files (read-only reference)
│   ├── handoff/             # The design-tool's own build spec + visual spec
│   └── ...                  # JSX artboards + bundled HTML
├── src/
│   ├── domain/              # Pure logic, zero React, zero browser APIs
│   │   ├── board.ts         # Board state + operations
│   │   ├── types.ts         # Card, Thread, Board, Color
│   │   └── ids.ts           # ID generation
│   ├── persistence/
│   │   ├── repository.ts    # BoardRepository interface
│   │   ├── memory.ts        # In-memory impl (tests)
│   │   ├── localStorage.ts  # Browser impl (pre-backend)
│   │   └── remote.ts        # Real backend (Phase 7)
│   ├── ui/
│   │   ├── Board.tsx        # Grid, rails, headers, cork, floating shadow
│   │   ├── Card.tsx         # Single card primitive
│   │   ├── Thread.tsx       # SVG thread path
│   │   ├── Toolbar.tsx
│   │   ├── EditPopover.tsx
│   │   ├── ShareDialog.tsx
│   │   └── tokens.ts        # Colors, fonts, surface gradients
│   ├── state/               # React state wiring (hooks, context)
│   └── app.tsx
├── server/                  # Phase 7+ backend (node:http + better-sqlite3)
│   ├── server.ts            # Single-file HTTP server
│   └── db.ts                # SQLite open + schema bootstrap
├── tests/
│   ├── unit/                # Mirrors src/ structure
│   ├── integration/
│   └── e2e/                 # Playwright
├── reviews/                 # Phase review reports (one per phase)
└── CLAUDE.md, BUILD_PLAN.md, README.md
```

The design tool's own `handoff/` package suggests a flatter `src/` layout (everything in `src/` root, no `domain/` separation). We do **not** adopt that — our `domain/` split is what gives us 90% pure-logic coverage and a clean swap to a real backend at Phase 7. Keep our layout.

Keep the domain layer **pure**: no React, no DOM, no localStorage, no `Date.now()` directly. Inject a clock if needed.

---

## 4. Design tokens (canonical)

These are extracted from the design files. Treat as the only allowed values.

### Card palette (8 colors)
| Key | Hex | Ink |
|---|---|---|
| peach | `#F4B584` | `#5a3520` |
| coral | `#F26B86` | `#4a1a26` |
| orange | `#EE7A3E` | `#4a1f0a` |
| salmon | `#F5A088` | `#4a221a` |
| yellow | `#F5D257` | `#4a3c10` |
| mint | `#9BD3B0` | `#1f3f2c` |
| sky | `#6FA8D8` | `#102a44` |
| lilac | `#B89DD0` | `#2c1f44` |

Default new card color: **peach**.

### Pin colors (random per card)
`#d6463a` (red), `#e9b834` (yellow), `#3a7ed6` (blue), `#3aa15a` (green), `#f5f1e6` (white). Cosmetic only — no semantics.

### Surfaces

The board floats on the page. There is **no wood frame**.

- **Page background.** Soft cool off-white:
  ```
  radial-gradient(ellipse 900px 700px at 12% -6%, rgba(180,200,230,0.35), transparent 60%),
  radial-gradient(ellipse 1100px 800px at 105% 110%, rgba(200,210,225,0.30), transparent 65%),
  linear-gradient(180deg, #eef0f4 0%, #e1e4ec 100%)
  ```
- **Cork.** Same as before: `linear-gradient(180deg, #c9a978 0%, #b89465 100%)` with noise dots. Border-radius 3px. Inset shadow `inset 0 0 28px rgba(60,30,10,.16)`.
- **Cork edge hairline.** `inset 0 0 0 1px rgba(40,30,15,.28)` — the boundary that reads cleanly on the new light page.
- **Board floating shadow.** Replaces the old wood frame:
  ```
  0 40px 80px -24px rgba(30,40,60,.28),
  0 14px 32px -12px rgba(30,40,60,.18),
  0 2px 6px rgba(30,40,60,.10)
  ```
- **Paper / chrome.** `#f6f2ec`.
- **Ink dark** `#2a1f15`. **Ink mid** `#6b5a48`. **Ink on cork** `#3a2410`.
- **URL chip text.** `#7a8295` dim, `#2a3142` bright (for the slug portion).

### Typography
- **Caveat** 600 16/1.05 — default card text. Mixed case allowed.
- **Permanent Marker** 14 uppercase letter-spacing 0.04em — auto-applied when text matches `/^[A-Z &+]{2,}$/`.
- **Manrope** 500 13/1.4 — UI chrome.
- **JetBrains Mono** 400 10–11 — annotations, shortcuts, URLs.

### Grid
- Columns: **Mon–Sun (7)**.
- Rows: 4–52 weeks, **default 26**.
- Header row 32px; week rail 64px.
- Grid lines: 0.5px `rgba(40,20,5,.22)`.

### Day-header badges (the only weekend differentiation)
| | Weekdays (Mon–Fri) | Weekend (Sat, Sun) |
|---|---|---|
| Badge fill | `#F4B584` (peach) | `#e9c79a` (lighter peach) |
| Font size | 18px | 16px |
| Opacity | 1.0 | 0.78 |
| Rotation | ±1.5° random | ±1.5° random |

The cells below these headers, their grid lines, and any cards inside them are **identical** to weekdays. No shading, no greying, no "weekend" label.

### Board sizing (fluid)
The board fills the available horizontal space. Cell metrics are computed, not fixed.

- `cellW = clamp(120px, (containerWidth − railW − horizontalMargin) / 7, 180px)`
- `cellH = round(cellW × 0.55)` — preserves the sticky-note aspect ratio.
- Card size scales proportionally: `cardScale = cellW / 56` (56px is the design baseline).
- The board scrolls vertically inside its container. 26 weeks × `cellH` will exceed a laptop viewport and that is expected.
- On very narrow viewports (< 720px), the board may overflow horizontally rather than shrink below the 120px floor. Mobile-first layout is deferred to v2.

### Card chrome
- Pin head: 5px radial gradient at `left: 3px, top: 50%` (× `cardScale`).
- Rotation: `±2°` random on create, persists per-card.
- Shadow (idle): `0 1.2px 2.5px rgba(0,0,0,.18), 0 4px 8px rgba(0,0,0,.10)`.
- Shadow (hover): `0 4px 8px rgba(0,0,0,.22), 0 10px 18px rgba(0,0,0,.14)`.
- Shadow (drag): `0 8px 18px rgba(0,0,0,.30), 0 2px 4px rgba(0,0,0,.20)`.
- Border radius: 1.5px.
- Text wraps to two lines max; ellipsis truncates a third.

### Thread
- Stroke: `#9c5a2e`, width 1.8, linecap round, opacity 0.92.
- Path: `M x1 y1 Q midX (midY + sag) x2 y2` where `sag = clamp(distance*0.06, 8, 22)`.
- Shadow filter: Gaussian blur σ=1, offset y=1.5, alpha 0.45.
- No arrowhead. Ever.

### Stacking offsets (multiple cards per cell)
For N > 1 cards sharing a (week, day) cell, sorted by `createdAt` ascending and indexed `i = 0..N-1`:
- `offset.x = (-1)^i * (4 + i*3)` px
- `offset.y = (-1)^i * (3 + i*2.5)` px
- `z` orders rendering. The most recently *interacted-with* card sits on top (highest `z`).
- The grid never grows to accommodate more cards.

---

## 5. Behavioral invariants

These are non-negotiable. Tests should pin them.

1. **URL = identity.** `/b/<slug>`. Unknown slug → create empty board at that slug, no error. Slugs use enough entropy that scanning / guessing is not a realistic attack — see §9 "Slug generation".
2. **Anyone with the link can edit** — _and the passphrase, if one has been set._ No auth, no roles, no view-only mode. By default a board has no passphrase; the owner may optionally set one (Phase 7.5) which client-side-encrypts the board. When a board is locked, the URL alone is no longer enough — the visitor must also know the passphrase to decrypt it. The "in the room" semantics are preserved: anyone who has both keys is in the room. There is no recovery flow.
3. **No save button.** Edits debounce 250ms then persist.
4. **Concurrent edits merge** last-writer-wins, per card and per thread. Sync mechanism is a 10-second poll (§9).
5. **Marker font auto-applies** via the all-caps regex; users opt out by typing lowercase.
6. **Pin color and rotation are stable per card** — chosen on create, persisted, never re-randomized.
7. **One Mon–Sun column set.** Seven days, no time-of-day subdivision. Sat and Sun may be muted **in the day-header badge only** per §4 — smaller text, lighter peach, reduced opacity. Grid lines, cells, and any cards inside them remain identical to weekdays. No 'weekend' label or shading inside cells; no functional differentiation.
8. **Shrinking the week range never deletes cards.** Off-board cards are preserved and restored on regrow. A confirmation dialog appears if shrink would cut off any cards.
9. **Deleting a card removes its threads.** No orphaned threads, ever.
10. **Thread endpoints are stable card IDs**, not array indices.
11. **Locked boards never round-trip plaintext through the server.** When a board is passphrase-locked, the only thing the server stores or returns is `{ ciphertext, iv, kdfSalt, kdfIters }`. Plaintext exists only in the browser memory of a session that has decrypted it. Loss of the passphrase = loss of the board; this is the price of the no-accounts model.

---

## 6. How we work

### TDD is the default
Every behavioral change follows red → green → refactor. Order:
1. Write the failing test (smallest possible).
2. Write the simplest code that makes it pass.
3. Refactor with tests green.

Acceptable to defer tests for purely visual exploration — but the moment behavior is involved, test first. The phased plan calls out which tests to write where.

### Definition of done (every change)
- All tests pass: `npm test`, `npm run test:e2e`.
- Lint clean: `npm run lint`.
- Types clean: `npm run typecheck`.
- New behavior has tests at the appropriate level.
- Visual changes have a screenshot in the PR description or phase review.
- No commented-out code, no `console.log`, no `any` without an `// eslint-disable-next-line` and a reason.

### Test pyramid
- **Unit (most)**: domain logic, helpers, pure UI components in isolation.
- **Integration**: React components + state, repository implementations.
- **E2E (fewest, broadest)**: the six workflows from the design spec, end to end in Playwright.

### Commits
Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`). One concern per commit. The phase number in the body: `Phase: 3`.

### Branches
One branch per phase: `phase-N-<short-name>`. Merge to `main` only after the phase review report is committed under `reviews/phase-N.md` and the quality gates pass.

---

## 7. Anti-patterns — do not

- Reintroduce the wood frame around the board. The board floats on the light page background via the elevated drop shadow in §4. The frame was deliberately removed in the v2 design drop.
- Apply any weekend treatment beyond the header-badge muting in §4. Sat and Sun cells, grid lines, and cards behave and look identical to weekdays.
- Add a calendar grid abstraction supporting hours, recurring events, or holidays.
- Add roles, sharing settings, comments, mentions, notifications, or @-references.
- Use icon-library icons in place of the spec's hand-drawn / emoji-free chrome.
- Animate the card rotation. Cards are placed, not slid into pose.
- Replace the threads with vector arrows, dashed lines, or anything with an arrowhead.
- Use Tailwind utility soup for the page background, cork, or card surfaces — those are bespoke and live in `tokens.ts`.
- Introduce a state-management library before Phase 6. The state is small; `useReducer` + context is sufficient.
- Persist directly from a component. All persistence goes through `BoardRepository`.
- Hard-code `cellW`/`cellH` in screens. Always derive from container width per §4 "Board sizing (fluid)".
- Adopt the flatter `src/` layout suggested in `design/handoff/`. Our `domain/persistence/ui/` split is enforced for testability.

---

## 8. Reference workflows

For full storyboards, read `design/workflows.jsx`. Summary:

| # | Workflow | Trigger | End state |
|---|---|---|---|
| 01 | Add card | Click empty cell | New card committed on Enter / blur |
| 02 | Move card | Drag a card | Snaps to nearest cell; threads follow live |
| 03 | Draw thread | Drag from card → card | Thread created, no label |
| 04 | Edit / recolor / delete | Click a card | Popover docks below with text input + swatches + Delete |
| 05 | Share / persist | Click Share | Dialog with URL + Copy. Edits persist with 250ms debounce |
| 06 | Resize board | Click "Weeks N" | Stepper 4–52; warning if shrink cuts cards |

### Keyboard shortcuts (locked)
| Key | Action |
|---|---|
| Enter | Commit card text |
| Esc | Cancel edit / cancel thread drag / close popover |
| Cmd/Ctrl-Z | Undo |
| Cmd/Ctrl-Shift-Z | Redo |
| Backspace (selected, not editing) | Delete card |
| Arrow keys (selected, not editing) | Move card 1 cell |
| Cmd/Ctrl-click on stacked cell | Cycle z-order through the stack |

---

## 9. Open decisions

Remaining open decisions for the named phase boundary.

- **Backend choice** (Phase 7 — resolved 2026-05-18). **Node + SQLite** via a single-file `node:http` + `better-sqlite3` server in `server/`. Schema is `boards(slug TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`; `payload` is an opaque JSON envelope the server never parses. Endpoints: `GET /b/:slug`, `PATCH /b/:slug`, `DELETE /b/:slug` — no per-entity routes. Local-dev and tests use the same code via an in-process `http.Server` on an ephemeral port (`:memory:` SQLite in tests, `data/dev.sqlite` in dev). Cloud deploy (Fly / Render with a persistent disk) is deferred to Phase 8. **Sync mechanism is locked: 10-second poll on the client** regardless of backend. The opaque-blob model is what makes Phase 7.5's `{ ciphertext, iv, kdfSalt, kdfIters }` envelope a zero-migration addition. Full rationale in `reviews/phase-7-backend-decision.md`.
- **Slug generation** (Phase 7). **Four random words + 4-digit suffix** in the pattern `adj-noun-adj-noun-NNNN` (e.g. `oak-thread-helmet-tractor-7421`). Word lists committed inline in `src/persistence/slugWords.ts` — ~500 adjectives + ~550 nouns as plain TS arrays, no external dep. With ≥ 500 of each this is `≥ 500² × 500² × 10⁴ ≈ 6 × 10¹⁴` combinations — bots and scanners cannot enumerate the space (~14 orders of magnitude is far above the rate-limit-resistance bar). Collisions are tolerated by the backend (slug uniqueness is not enforced on the client). The lists can grow without forcing a spec rewrite — the floor of `≥ 500 each` is what's pinned.
- **Per-board passphrase lock** (Phase 7.5). Optional, opt-in per board. PBKDF2-SHA-256 with `kdfIters ≥ 250_000` derives a 256-bit key from `passphrase + kdfSalt` (16 random bytes per board). Content encrypted with AES-GCM-256 and a per-write random IV. Server stores only the ciphertext envelope. Lost passphrase = lost board; this is by design (no accounts, no recovery email).
- **Domain / hosting** (Phase 8 / launch).

---

## 10. Change log

Material spec changes after a phase has shipped. Keep terse.

| Date | Phase touched | Change | Reason |
|---|---|---|---|
| 2026-05-16 | 2 | Days: Mon–Fri (5) → Mon–Sun (7). Board width fluid via `clamp(90, vw/7, 160)`. | Match physical reference; original 5-col + fixed width left half the laptop empty. |
| 2026-05-16 | 2 | Visual refresh: light page bg, wood frame removed, board floats via elevated shadow. Cell clamp bounds raised to `clamp(120, vw/7, 180)`. Sat/Sun header-badge muting permitted (smaller, lighter, opacity 0.78) — invariant 7 rewritten. | New design drop adopted from `design/handoff/`. |
| 2026-05-16 | 3 | Card type to gain `createdAt`, `updatedAt` (set on create, bumped on every mutation). | LWW merge needs timestamps; cheaper to add now than retrofit at Phase 7. |
| 2026-05-16 | 4 | Card type to gain `z: number` (persisted, monotonically increasing per board) for in-cell stack ordering. `offset: {x, y}` is **derived at render time** from cell occupancy via the §4 formula — not stored on `Card`. Cmd/Ctrl-click cycles stack z-order. | Stacking visual was underspecified; design drop pinned the formula. Storing the offset would duplicate state that is a pure function of (week, day, createdAt-sorted cards). |
| 2026-05-16 | 6 | Keyboard shortcuts added: arrow keys nudge selected card by one cell; Backspace deletes selected card (when no input focused). | Locked from design drop §9. |
| 2026-05-16 | 7 | Sync mechanism locked to 10-second poll (was TBD between polling/WS/SSE). Backend choice remains open. | Design drop concluded a poll suffices for v1's LWW model — simpler and avoids WS infra. |
| 2026-05-18 | 7 | Slug widened from `word-word-NNN` (2 + 3-digit, ~2 × 10⁹ combos) to `adj-noun-adj-noun-NNNN` (4 + 4-digit). Inline lists in `src/persistence/slugWords.ts` ship at ~540 adjectives + ~550 nouns → ~9 × 10¹⁴ combinations (spec floor: ≥ 500 of each, ≥ 6 × 10¹⁴). Invariant 1 footnote about slug entropy added. | "Anyone with the link can edit" only holds if the link can't be guessed. The original `oak-thread-942` shape was scannable; the four-word + four-digit shape makes brute discovery infeasible. The shipped lists are two orders of magnitude below the original ~5 × 10¹⁶ target but stay 14+ orders of magnitude above the "bot enumeration is realistic" bar — practical hand-curation of 3000+ categorized words is more cost than benefit. |
| 2026-05-18 | 7.5 (new) | Introduced **optional per-board passphrase lock** (PBKDF2 + AES-GCM, client-side encryption). New invariant 11: locked boards never round-trip plaintext. New section in BUILD_PLAN.md. §1 product paragraph updated; §5 invariant 2 amended with the passphrase footnote. | Users want to put company-scale info on boards without giving up the no-accounts model. Optional encryption is the in-between — casual boards stay frictionless, sensitive ones get a wall, identity-free. |
| 2026-05-18 | 7 | Backend choice resolved: **Node + SQLite** via `node:http` + `better-sqlite3`. One table, opaque `payload TEXT` per slug; three endpoints (`GET / PATCH / DELETE /b/:slug`). Wire format is a discriminated-union envelope `{ locked: false, board, updatedAt }` from day one; Phase 7.5 adds the `{ locked: true, ... }` arm with no migration. `DEMO_SLUG = 'oak-thread-942'` scrapped; `/` redirects to a freshly generated slug. `commitFromRemote(next)` added to `useBoardEditor` so poll-induced merges never enter the local undo stack. `PollDriver` injection mirrors the `Clock` pattern. Routing is plain `pathname` + `pushState` (no React Router). Threads kept without per-entity `updatedAt` — set-diff by id is enough since threads are immutable. | Phase 7 ships green without a cloud-account dependency (cloud cut-over → Phase 8 per `feedback_defer_blockers`). Same server runs locally and on Fly/Render. The opaque-blob model is the hard constraint that makes Phase 7.5 a zero-migration add. Full rationale in `reviews/phase-7-backend-decision.md`. |
