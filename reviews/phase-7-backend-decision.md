# Phase 7 — backend & decision record

**Date:** 2026-05-18
**Branch:** `phase-7-backend-routing`
**Status:** Locked at kickoff; this doc is the first commit on the branch.

Phase 7 picks the backend, the slug shape's loose ends, the wire envelope, the
undo-stack rule for remote merges, the polling clock injection point, the
router, and the thread-LWW handling. Each decision is recorded with the
alternatives that were considered, so the rationale survives the conversation
that produced it.

---

## 1. Backend — **Node + SQLite, single-file `node:http` + `better-sqlite3`**

### Decision

A single-file Node server in `server/` exposing three endpoints under one slug:

```
GET    /b/:slug   → 200 { locked: false, board, updatedAt } | 404
PATCH  /b/:slug   → 204 (idempotent replace of the whole payload)
DELETE /b/:slug   → 204 (remove the row entirely)
```

Storage: SQLite via `better-sqlite3`, schema is one table:

```sql
CREATE TABLE IF NOT EXISTS boards (
  slug       TEXT    PRIMARY KEY,
  payload    TEXT    NOT NULL,           -- opaque JSON envelope
  updated_at INTEGER NOT NULL            -- ms epoch, mirrors envelope.updatedAt
);
```

`payload` is stored as an opaque string. The server never parses card / thread
structure — it returns whatever the client wrote. This is the hard constraint
from CLAUDE.md §9 and is what makes Phase 7.5 a zero-migration add (a locked
board's `payload` becomes a `{ locked: true, ciphertext, iv, kdfSalt, kdfIters,
updatedAt }` envelope; the column type doesn't change).

### Alternatives evaluated

| Criterion | CF Workers + Durable Objects | Supabase | **Node + SQLite (chosen)** |
|---|---|---|---|
| Time-to-first local boot | `wrangler dev` (extra CLI install) | `docker compose up` (Supabase CLI) | `npm run server` (in-tree) |
| Cost at 0 / 100 / 1000 boards | Workers Paid required ($5/mo flat — DO not on free) | Free tier (auto-pause hurts poll UX) | $0 localhost; $0–$5 on Fly/Render |
| Wipe-a-stale-board | `DELETE /b/:slug` → DO storage delete | SQL `DELETE` | `DELETE /b/:slug` → `DELETE FROM boards` |
| Local-dev / test harness | Wrangler stub or in-process Miniflare | Docker required | In-process `http.Server` on an ephemeral port — same code as prod |
| Opaque-blob fit | Trivial (KV semantics) | Possible (`jsonb`) but pays for Postgres as KV | Trivial (`payload TEXT`) |
| External cloud account needed to ship Phase 7 PR | Yes (CF + Workers Paid) | Yes (Supabase project) | **No** — cloud cut-over deferred to Phase 8 |
| New runtime deps | None on client (`fetch`) | `@supabase/supabase-js` on client | `better-sqlite3` on server only (devDep) |

### Why this and not the alternatives

The decisive factor is the `feedback_defer_blockers` policy: Phase 7 ships
green to `main` without me waiting on any cloud account. The same server file
is what we'd deploy to Fly / Render in Phase 8 (mount a 1 GB volume for the
SQLite file). Cloudflare would have given us a real production URL for the PR
demo, but at the cost of a paid plan ($5/mo flat for DO) and an additional CLI
in the dev loop. Supabase is overkill — we're using a database as a KV store
of opaque blobs, and the auto-pause behaviour on the free tier would break the
10s poll the moment a board went quiet.

### Local-dev / test story

- `npm run server` boots the HTTP server on `localhost:8787` against a
  `data/dev.sqlite` file (gitignored). The file is created on first write.
- The `vite` dev server proxies `/b/*` to `localhost:8787` so the browser
  origin matches and there's no CORS friction.
- `RemoteRepository` tests stand up an in-process `http.Server` listening on
  an ephemeral port (`server.listen(0)`), point the repository at it, and
  `server.close()` in `afterEach`. **Tests use an in-memory SQLite database
  (`:memory:`) so they're hermetic and don't touch disk.**
- E2E tests boot the same server once via Playwright's `webServer` config and
  reset its database between runs.

### `better-sqlite3` placement

`devDependencies`, not `dependencies`. The client bundle doesn't import from
`server/`, and the server isn't deployed in Phase 7. Phase 8's cloud cut-over
moves it (and the server) into whatever shape the deploy target wants
(probably a separate `package.json` under `server/` or a `dependencies`
promotion plus a `--production=false` install in the host's build step).

### Plan-then-install gate satisfied

- One new devDep: `better-sqlite3@^11.x`. Tiny native module, in continuous
  release since 2017, used in production by Discord / Sentry / Notion-class
  apps. Synchronous API matches the request/response shape of `node:http`
  with no async ceremony.
- No client-side deps added — `RemoteRepository` uses `fetch` directly.

---

## 2. Slug — `word-word-word-word-NNNN`, inline word lists, `DEMO_SLUG` scrapped

### Decision

- **Shape**: four words + four-digit suffix, e.g. `oak-thread-helmet-tractor-7421`.
  Generator pinned by a regex test (`/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{4}$/`)
  against ~500 samples. No global-uniqueness assertion — collisions are
  tolerated by the backend (the slug `INSERT` on a fresh `/b/:slug` GET is an
  `INSERT OR IGNORE`; if two clients race the slug, both get the same empty
  board and converge via LWW).
- **Word lists**: two plain TS arrays in `src/persistence/slug.ts` —
  `ADJECTIVES` (~1500) and `NOUNS` (~1500). Reviewable, no external dep, no
  surprise drift between releases.
- **`DEMO_SLUG = 'oak-thread-942'` scrapped**. `/` now redirects to a freshly
  generated slug on first paint. The existing localStorage entry under
  `sb:board:oak-thread-942` becomes orphaned for any dev who runs `main` on
  the same machine — single-line note in `reviews/phase-7.md` so the next
  reader knows where the dead state came from.
- **Router validation**: accepts any `[a-z0-9-]+` slug for forward-compat
  (legacy demo slug, future formats, hand-typed shorthand). Only the
  *generator* enforces the four-word shape.

### Why

Spec §9 pins the entropy target (~5 × 10¹⁶ combinations — bots can't
enumerate). The inline word-list call beats a dependency or a generated-asset
build step: the lists are static, browsable in PR diffs, and survive
`npm install` failures. Keeping the router permissive means we don't break
any URL anyone has already shared, including the demo slug if it's lingering
in someone's browser history.

---

## 3. Wire envelope — option (b), discriminated union from day one

### Decision

`GET /b/:slug` always returns a discriminated union:

```ts
type BoardEnvelope =
  | { locked: false; board: Board; updatedAt: number }
  | { locked: true;  ciphertext: string; iv: string; kdfSalt: string; kdfIters: number; updatedAt: number };
```

Phase 7 ships only the `locked: false` arm. Phase 7.5 adds the `locked: true`
arm — no migration of the unlocked path because clients already pattern-match
on `envelope.locked`.

### Why not option (a) (bare `Board`)

Option (a) would mean Phase 7 returns `Board` directly, and Phase 7.5 has to
change the return type to a discriminated union — every reader must be
audited. Shipping the union from day one forces clients to handle the
`locked` discriminator before any encryption is wired, which means 7.5 is
purely an additive cipher arm. The cost is one extra layer of unwrapping in
`RemoteRepository.load`; trivial.

---

## 4. Undo stack — `commitFromRemote(next)` skips `pushUndo`

### Decision

Add a third commit path to `useBoardEditor` alongside the existing
`commit(next)` + implicit `pushUndo` callers:

```ts
const commitFromRemote = useCallback((next: Board) => {
  boardRef.current = next;
  setBoard(next);
  // No pushUndo. No scheduleSave (the change is already on the server).
}, []);
```

`scheduleSave` is also skipped: the merge result is already what the server
holds, so re-writing it would be a wasted PATCH (and on a small race, would
overwrite a fresher local edit we haven't yet sent).

### Why

A poll-induced merge represents *someone else's* edit. If it pushed onto the
local undo stack, `Cmd-Z` would either:

1. Re-apply the remote change (because the next poll re-fetches it), or
2. Roll the *other user's* work back from your point of view.

Both are wrong. Google Docs / Figma don't let you undo a collaborator's
edits, and that's the model the spec implicitly assumes (CLAUDE.md §5
invariant 4: "concurrent edits merge last-writer-wins per card and per
thread").

### Pinned by

Two failing tests written first, in `tests/integration/remoteMerge.test.ts`:

1. *Incoming card change*: seed a board with one card; record `canUndo` and
   `undoStackSize`. Fire a poll that returns the same board with that card's
   `text` changed and `updatedAt` bumped. Assert: card text updates; both
   stack metrics are unchanged.
2. *Incoming card delete*: same setup; poll returns the board without that
   card. Assert: card is gone; both stack metrics are unchanged.

---

## 5. `PollDriver` — injectable, mirrors the `Clock` pattern

### Decision

```ts
export type PollDriver = (tick: () => Promise<void>) => () => void;

// Production:
export const intervalPollDriver: PollDriver = (tick) => {
  const handle = setInterval(() => { void tick(); }, 10_000);
  return () => { clearInterval(handle); };
};

// Tests:
export function manualPollDriver(): PollDriver & { fire: () => Promise<void> } {
  let stored: (() => Promise<void>) | null = null;
  const driver: PollDriver = (tick) => {
    stored = tick;
    return () => { stored = null; };
  };
  return Object.assign(driver, {
    fire: () => stored ? stored() : Promise.resolve(),
  });
}
```

`RemoteRepository` takes `pollDriver: PollDriver` in its constructor and
defaults to `intervalPollDriver` in production. Tests pass `manualPollDriver()`
and call `.fire()` to advance.

### Why this and not `vi.useFakeTimers()`-only

Fake timers tangle with React's act / RTL `waitFor` (Phase 6 review's first
defect: `vi.useFakeTimers()` in `beforeEach` deadlocked `waitFor` because RTL
polls via real-timer microtasks). Injecting the driver lets us fire the poll
synchronously inside a test without ever touching the global timer queue.

### 10s cadence pinned by

An integration test that uses the production driver against `vi.useFakeTimers()`
*after* the initial render is awaited (Phase 6's lesson). Asserts exactly one
`fetch` call per `vi.advanceTimersByTime(10_000)`.

---

## 6. Routing — plain `pathname` + `pushState`, no React Router

### Decision

A 30-LOC `src/state/useRoute.ts` exposing `{ slug: string, navigate(slug) }`.

- `/` → generates a fresh slug, calls `history.replaceState`, returns it.
- `/b/<slug>` → returns the slug.
- `<App>` reads `slug` from the route hook in production; tests still inject
  `slug` via the existing `AppProps.slug` prop (the new behaviour is
  *route-aware default* not *route-required*).

### Why not React Router

Two routes, zero query-string state, no nested layouts. React Router would be
the first runtime dep added since Phase 0 and the plan-then-install gate
fails on cost/benefit. Plain `pathname` parsing is enough and stays in the
existing zero-dep posture.

---

## 7. Thread `updatedAt` — not added; set-diff merge by id

### Decision

Threads stay as-is: `{ id, fromCardId, toCardId }`. The LWW merge treats the
thread collection as a set keyed by `id`, not a per-entity timestamped diff.

The merge rule for threads, given a local set L and an incoming set I from a
poll whose envelope carries `updatedAt = T`:

- A thread in both L and I: kept (identity is by id; threads can't be
  edited).
- A thread in L but not in I: kept iff the local board's most recent
  mutation is newer than T (i.e. we added it after the server snapshot was
  taken). Otherwise dropped (someone else deleted it).
- A thread in I but not in L: added iff T is newer than the local board's
  most recent mutation. Otherwise we just deleted it locally and the poll
  hasn't observed our delete yet — leave it dropped.

This collapses to "the server is the truth at time T; local writes since T
win" — which is exactly LWW at the board level for the thread collection.

### Why not add `Thread.updatedAt`

Threads are immutable in the data model — you can only create or delete
them, never edit them. A per-thread timestamp would carry no information the
board-level `updatedAt` doesn't already give us. Adding a field that's
identical to the board's mtime for every thread is dead weight, and (worse)
would invite future code that *reads* the field and assumes it changes
independently.

Documented in CLAUDE.md change log so a future reader doesn't try to add it
back.

---

## 8. Empty / error / loading — minimum viable, polish deferred to Phase 8

### Decision

- **Unknown slug** → backend `GET /b/:slug` returns 404 → `RemoteRepository`
  treats 404 as "no row yet", emits an empty `Board` at the current week
  count. First write creates the row server-side via `PATCH`'s upsert. Pinned
  by invariant 1 (CLAUDE.md §5).
- **Network error on initial load** → render an inline retry message in the
  cork surface area, keep the URL chip alive. Phase 8 polishes the look.
- **Offline window** → `scheduleSave`'s 250ms timer fires as today; the
  resulting `repository.save` rejects; the repository retains the most
  recent unflushed board in memory and retries every 10s (piggybacks on the
  poll cadence). On reconnect, the retry flushes. Pinned by the "30s offline
  window, no data loss" quality gate.

---

## What's *not* in this doc (out of scope for Phase 7)

- Cloud deploy target (Fly vs Render). Deferred to Phase 8 — local server is
  enough for the Phase 7 PR demo.
- Custom domain. v1 launch hostname is decided in Phase 8.
- Any Phase 7.5 crypto scaffolding. The envelope is the only concession.
- Real-time presence, cursors, comments, mentions, notifications. v2.
- Conflict warnings or "this card was edited elsewhere" toasts. The merge is
  silent.

---

## Commit slices that follow this doc

1. `docs: phase-7 backend decision` *(this commit — review doc + CLAUDE.md / BUILD_PLAN.md updates)*
2. `feat(persistence): slug generator (word⁴-NNNN)`
3. `feat(persistence): envelope type + LWW merge helper`
4. `feat(state): commitFromRemote — remote merges do not enter undo stack`
5. `feat(state): useRoute — / redirects to fresh slug, /b/:slug parses`
6. `feat(server): node http + sqlite — GET/PATCH/DELETE /b/:slug`
7. `feat(persistence): RemoteRepository — fetch + injectable PollDriver + offline queue`
8. `test(integration): unknown slug, debounced PATCH, 10s cadence, delete cascade, no focus steal, offline retry`
9. `feat(ui): Share dialog — Last edited Nm ago from server updatedAt`
10. `test(e2e): two-context cross-tab sync, LWW on color, remote delete cascade`
11. `docs: reviews/phase-7.md` + PR
