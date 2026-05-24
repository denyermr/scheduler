# Phase 8A Review — Deploy to Fly.io + custom domain

## Summary

Splits Phase 8 from BUILD_PLAN.md into two PRs so the app can go live before the launch-readiness polish. This PR (8A) makes the existing two-process dev setup (Vite + Node API) collapse into a single production Node process that serves the built SPA *and* the `/b/:slug` API from the same port, adds the Fly.io deployment scaffolding (Dockerfile, `.dockerignore`, `fly.toml`), and documents the deploy steps in the README. Phase 8B (a11y / perf / cross-browser / empty-error-loading states / carried-over Phase 7 open items) follows in a separate PR once the live URL has been dogfooded.

## What shipped

- Production-mode server: `staticDir` option on `startServer` enables static-file serving, an extension-aware SPA fallback for unknown client-side routes, and an `Accept: text/html`-aware branch on `GET /b/:slug` that serves `index.html` for browser navigations (matches the existing Vite dev proxy behavior).
- `/healthz` endpoint — always available regardless of `staticDir`, used by Fly's HTTP machine check.
- Path-traversal hardening: requests that resolve outside `staticRoot` return 403; URL-encoded `..` traversal sequences cannot read host files.
- `STATIC_DIR` env wiring in `server/index.ts` (unset in dev → API-only; set in prod → combined process).
- `tsx` and `better-sqlite3` reclassified from `devDependencies` → `dependencies` so `npm ci --omit=dev` produces a runnable runtime image. No new packages added.
- `Dockerfile`: 2-stage build (`node:22-slim`), `npm ci` for the SPA build stage, `npm ci --omit=dev` for the runtime stage. `better-sqlite3` picks up its prebuilt glibc binary — no `python3` / `make` / `g++` needed.
- `.dockerignore`: excludes `node_modules`, `dist`, `tests`, `coverage`, `design`, `.claude`, etc. to keep the build context lean.
- `fly.toml`: single shared-CPU machine in `lhr`, 1 GB volume mounted at `/data`, `auto_stop_machines = "stop"` for cost, `/healthz` HTTP check, env defaults baked in.
- `eslint.config.js`: added `.claude` to `globalIgnores` so eslint stops scanning stale parallel-agent worktrees (pre-existing 415-error noise that was blocking the gate).
- README expanded with local dev quickstart, production single-process command, and the Fly + DNS playbook for `schedule.potterstudio.net`.

## Tests added

| Level | Count | Files |
|---|---|---|
| Integration | 8 | [tests/integration/server.test.ts](../tests/integration/server.test.ts) — new `production mode (staticDir)` describe block + healthz test in the existing block |
| Unit | 0 | (Static-serving logic is exercised end-to-end via the integration suite — no useful unit boundary inside the request handler.) |
| E2E | 0 | (Existing 31 e2e specs still pass against the dev configuration. A production-mode e2e webserver is a Phase 8B item — pulled forward only if 8B's cross-browser work needs it.) |

Coverage on `src/domain/`: unchanged (no domain changes this phase).

The 8 new server tests cover: `/healthz` always-available, prod-mode `GET /` serves `index.html`, asset content-types, SPA fallback for extensionless paths, 404 for missing extensioned files (no mime confusion), `Accept`-based branching on `/b/:slug`, JSON API still works alongside, and path-traversal hardening.

## Design adherence

No visual changes. The production server reproduces the Vite dev proxy's behavior exactly — `Accept: text/html` → SPA, otherwise → API — so the runtime behavior across `dev`, `npm start` locally, and Fly deploy is observably identical.

## Invariants pinned

- **Invariant 1 (URL = identity).** The SPA-fallback test for `GET /b/:slug` with `Accept: text/html` pins that the production server, like the dev proxy, lets the client-side router pick up arbitrary slugs without server-side state.
- **Invariant 4 (LWW sync over 10s poll).** Unchanged this phase — the existing `RemoteRepository` continues to talk to the same server, just now hosted on Fly.

## Defects discovered

- The `eslint.config.js` did not ignore `.claude/worktrees/`, so any developer with prior parallel-agent worktrees got 415 spurious parser errors from eslint trying to handle multiple tsconfig roots. Fixed in this PR (one-line addition to `globalIgnores`).

## Tech debt accrued

- None. The deploy slice is small and self-contained — no abstractions introduced, no temporary shims.

## Risks / unknowns for next phase

- The Fly machine is `shared-cpu-1x` / 256 MB. If the 26-week board at 80 cards turns out to need more memory during a poll cycle, bump to 512 MB — that's a one-line `fly.toml` change, no code impact.
- `auto_stop_machines = "stop"` means a ~1 s cold start after idle. Acceptable for a personal tool; revisit if the URL is shared publicly enough that cold starts become user-visible.
- No backup / snapshot scheme yet for the Fly volume. Fine for an MVP, but losing the volume means losing every board. Phase 8B (or earlier if a real user appears) should add `fly volumes snapshots list` to a periodic check.
- Production-mode behavior is exercised in the unit/integration suite but not in Playwright. If a regression slips between `dev` and `prod` startup paths it won't be caught until smoke-testing the live URL. Adding a prod-mode Playwright project is a Phase 8B candidate.

## Quality gate status

- [x] Lint clean
- [x] Types clean
- [x] Unit + integration green (300/300 + 8 new)
- [x] E2E green (31 passed, 8 pre-existing skipped — Phase 7 known list)
- [x] Production build succeeds (188 kB raw / 62.55 kB gzip — under the 250 kB Phase 8 target)
- [x] Coverage threshold met (domain unchanged, ≥ 97% lines / 95% branches per Phase 7)
- [ ] CI green on the merge commit (verify post-push)
- [ ] Live URL responds at `https://schedule.potterstudio.net/` and `/healthz` (verify post-deploy)

## Recommendation

Proceed to deploy after this PR is merged: `fly volumes create data --region lhr --size 1` → `fly deploy` → `fly certs add schedule.potterstudio.net` → add DNS records at the `potterstudio.net` registrar. Then start Phase 8B on a fresh branch off `main`.

## Appendix

Local prod-mode smoke run (before Docker):

```
$ STATIC_DIR=dist DB_PATH=:memory: PORT=8788 npm start
Schedule Board server listening on http://0.0.0.0:8788 (serving SPA from dist)

$ curl -s -w "%{http_code} %{content_type}\n" -o /dev/null http://localhost:8788/
200 text/html; charset=utf-8

$ curl -s http://localhost:8788/healthz
ok

$ curl -s -w "%{http_code} %{content_type}\n" -o /dev/null \
       -H "Accept: text/html" http://localhost:8788/b/foo
200 text/html; charset=utf-8

$ curl -s -w "%{http_code}\n" -o /dev/null \
       -H "Accept: application/json" http://localhost:8788/b/foo
404
```

Docker build was not run locally (Docker daemon not started). `fly deploy` uses Fly's remote builders by default, which will validate the `Dockerfile` end-to-end on the first deploy.
