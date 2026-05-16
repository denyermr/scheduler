# CLAUDE.md — Schedule Board

This file is read at the start of every Claude Code session. It is the source of truth for **what** we're building, **how** we work, and **what's already decided**. The phased work is in `BUILD_PLAN.md`.

---

## 1. Product

A digital recreation of a physical schedule board (animation-studio reference). Grid of days × weeks; colored cards pinned to cells; threads connecting related cards. URL is the identity — anyone with the link can edit. No accounts, no save button, no permissions.

**North star: tactile, not slick.** Cork surface, wood frame, ±2° card rotation, drop-shadows, pin heads, string-with-sag threads. Resist any drift toward calendar-app or productivity-SaaS conventions.

The full design spec lives in `design/` (HTML + JSX artboards). Treat it as authoritative for visual decisions.

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
| Persistence (Phase 7) | TBD at Phase 7 boundary — candidates: Cloudflare Workers + Durable Objects, Supabase, Node + SQLite + WS |

Do **not** introduce additional runtime dependencies without justification in the phase review.

---

## 3. Source layout

```
/
├── design/                  # The handed-off design files (read-only reference)
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
│   │   ├── Board.tsx        # Grid, frame, rails, headers, cork
│   │   ├── Card.tsx         # Single card primitive
│   │   ├── Thread.tsx       # SVG thread path
│   │   ├── Toolbar.tsx
│   │   ├── EditPopover.tsx
│   │   ├── ShareDialog.tsx
│   │   └── tokens.ts        # Colors, fonts, surface gradients
│   ├── state/               # React state wiring (hooks, context)
│   └── app.tsx
├── tests/
│   ├── unit/                # Mirrors src/ structure
│   ├── integration/
│   └── e2e/                 # Playwright
├── reviews/                 # Phase review reports (one per phase)
└── CLAUDE.md, BUILD_PLAN.md, README.md
```

Keep the domain layer **pure**: no React, no DOM, no localStorage, no `Date.now()` directly. Inject a clock if needed. This makes the logic testable in isolation and swappable.

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
- Cork: `linear-gradient(180deg, #c9a978 0%, #b89465 100%)` with noise dots (see `Board.tsx`).
- Wood frame: `linear-gradient(180deg, #b8845a 0%, #a06c3e 40%, #8a5530 100%)`.
- Page background: `#3a2410`.
- Paper / chrome: `#f6f2ec`.
- Ink dark: `#2a1f15`. Ink mid: `#6b5a48`.

### Typography
- **Caveat** 600 16/1.05 — default card text. Mixed case allowed.
- **Permanent Marker** 14 uppercase letter-spacing 0.04em — auto-applied when text matches `/^[A-Z &+]{2,}$/`.
- **Manrope** 500 13/1.4 — UI chrome.
- **JetBrains Mono** 400 10–11 — annotations, shortcuts, URLs.

### Grid
- Columns: Mon–Fri (5).
- Rows: 4–52 weeks, **default 26**.
- Default cell: 56×38; scales with viewport.
- Header row 32px; week rail 64px.
- Grid lines: 0.5px `rgba(40,20,5,.22)`.

### Card chrome
- Pin head: 5px radial gradient at `left: 3px, top: 50%`.
- Rotation: `±2°` random on create, persists per-card.
- Shadow: `0 1.2px 2.5px rgba(0,0,0,.18), 0 4px 8px rgba(0,0,0,.10)`.
- Border radius: 1.5px (almost square — paper, not plastic).

### Thread
- Stroke: `#9c5a2e`, width 1.8, linecap round, opacity 0.92.
- Path: `M x1 y1 Q midX (midY + sag) x2 y2` where `sag = clamp(distance*0.06, 8, 22)`.
- Shadow filter: Gaussian blur σ=1, offset y=1.5, alpha 0.45.
- No arrowhead. Ever.

---

## 5. Behavioral invariants

These are non-negotiable. Tests should pin them.

1. **URL = identity.** `/b/<slug>`. Unknown slug → create empty board at that slug, no error.
2. **Anyone with the link can edit.** No auth, no roles, no view-only mode.
3. **No save button.** Edits debounce 250ms then persist.
4. **Concurrent edits merge** last-writer-wins, per card and per thread.
5. **Marker font auto-applies** via the all-caps regex; users opt out by typing lowercase.
6. **Pin color and rotation are stable per card** — chosen on create, persisted, never re-randomized.
7. **One Mon–Fri column set.** No weekends, no time-of-day subdivision.
8. **Shrinking the week range never deletes cards.** Off-board cards are preserved and restored on regrow. A confirmation dialog appears if shrink would cut off any cards.
9. **Deleting a card removes its threads.** No orphaned threads, ever.
10. **Thread endpoints are stable card IDs**, not array indices. (The design files use indices for brevity; the implementation does not.)

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
- New behavior has tests at the appropriate level (see §7).
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

- Add a calendar grid abstraction that supports weekends, hours, or recurring events.
- Add roles, sharing settings, comments, mentions, notifications, or @-references.
- Use icon-library icons in place of the spec's hand-drawn / emoji-free chrome.
- Animate the card rotation. Cards are placed, not slid into pose.
- Replace the threads with vector arrows, dashed lines, or anything with an arrowhead.
- Use Tailwind utility soup for the cork, wood, or card surfaces — those are bespoke and live in `tokens.ts`.
- Introduce a state-management library before Phase 6. The state is small; `useReducer` + context is sufficient.
- Persist directly from a component. All persistence goes through `BoardRepository`.

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

---

## 9. Open decisions

These are intentionally unresolved and will be made at the named phase boundary.

- **Backend choice** (Phase 7 boundary). Options to evaluate: Cloudflare Workers + Durable Objects (good for per-board state, cheap), Supabase (postgres + realtime), Node + SQLite + WebSockets (full control). Decision documented in `reviews/phase-7.md`.
- **Realtime mechanism** (Phase 7). Polling vs WebSockets vs SSE. Tied to backend choice.
- **Slug generation** (Phase 7). Adjective-noun-number (e.g. `oak-thread-942`) per design mocks, but exact word list TBD.
- **Domain / hosting** (Phase 8 / launch).
