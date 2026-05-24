# Schedule Board

A digital recreation of a physical schedule board. See **[CLAUDE.md](./CLAUDE.md)** for the spec, tech stack, design tokens, invariants, and working conventions. The phased build plan lives in **[BUILD_PLAN.md](./BUILD_PLAN.md)**.

## Local development

```bash
npm ci
npm run dev       # Vite frontend on :5173
npm run server    # Backend API on :8787 (better-sqlite3 → data/dev.sqlite)
```

Vite proxies `/b/<slug>` API calls to the backend and serves the SPA for browser navigations to the same URL — that bypass lives in [vite.config.ts](./vite.config.ts).

## Production build (single combined process)

```bash
npm run build                                      # → dist/
STATIC_DIR=dist DB_PATH=data/prod.sqlite npm start # serves SPA + API on :8787
```

In production the same Node process serves both the built SPA assets and the `/b/:slug` API. `STATIC_DIR` is the switch — when set, the server adds static-file serving, SPA fallback for client-side routes, and serves `index.html` for `GET /b/:slug` requests with `Accept: text/html`. `/healthz` is always available.

## Deploy to Fly.io

The production target is a single Fly machine in `lhr` with a 1 GB persistent volume for the SQLite file. Single-machine by design — the 10s-poll sync model (CLAUDE.md §9) cannot horizontally scale.

One-time setup:

```bash
brew install flyctl
fly auth login
fly launch --copy-config --no-deploy            # respects the committed fly.toml
fly volumes create data --region lhr --size 1
fly deploy
```

Custom domain (the live deployment is at **schedule.potterstudio.net**):

```bash
fly certs add schedule.potterstudio.net
fly ips list                                    # shows the IPv4 + IPv6 to use
```

At the registrar for `potterstudio.net`, add:

- `A   schedule   <Fly shared IPv4>`
- `AAAA schedule   <Fly IPv6>`

(Or `CNAME schedule → <app>.fly.dev` since it's a subdomain — both work.)

Verify:

```bash
fly status                                       # machine healthy + cert issued
curl -sf https://schedule.potterstudio.net/healthz   # → "ok"
```

Build context is shaped by `.dockerignore` (excludes `node_modules`, `tests`, `coverage`, `design`, etc. — Fly's remote builders run a clean `npm ci` per stage).

## Tests

```bash
npm test               # vitest unit + integration
npm run test:e2e       # playwright
npm run typecheck
npm run lint
```

Domain layer (`src/domain/`) is enforced ≥90% line + branch coverage. ESLint forbids `Date.now()` / `new Date()` there — inject the `Clock` instead.

## Project status

See [reviews/](./reviews/) for the per-phase reports. Phase 0–7 are merged; Phase 8A (this deploy work) and Phase 8B (a11y / perf / cross-browser polish) finish the v1.
