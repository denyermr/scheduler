# Phase 0 Review — Foundation

## Summary

A working developer toolchain landed on `phase-0-foundation`. The five-command local quality gate (lint, typecheck, unit test, build, e2e) passes end to end. The pre-commit guard rejects `console.log` and bare `any`, and accepts `any` only when escaped with `// eslint-disable-next-line <rule> -- <reason>`. The only user-facing artefact is a "Hello board" smoke screen — no board logic, no state, no interactions, as instructed.

## What shipped

- Vite + React 18 + TypeScript scaffold in the repo root (no nested subdirectory). React pinned to **18.3.x** per CLAUDE.md §2.
- `tsconfig.app.json` and `tsconfig.node.json` both set `strict: true` and `noUncheckedIndexedAccess: true`.
- Vitest 4 + React Testing Library 16 + `@testing-library/jest-dom` + jsdom, with `tests/setup.ts` wiring jest-dom matchers into Vitest.
- Playwright 1.60 with **chromium, firefox, webkit** installed, configured to start `npm run preview` on port 4173 and run against the built bundle.
- ESLint 10 (flat config) with `typescript-eslint` strict preset, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, and `eslint-config-prettier`. A scoped block under `src/domain/**` bans `react`/`react-dom`/`react-dom/client` imports and the browser globals `window`/`document`/`localStorage`/`sessionStorage`.
- Prettier 3 with conflict resolution via `eslint-config-prettier`. `.prettierrc.json` + `.prettierignore` committed.
- Husky 9 + lint-staged 15. Pre-commit hook runs the custom guard script, then `lint-staged` (eslint on staged `*.{ts,tsx}` with `--max-warnings 0`), then `npm run typecheck`.
- Custom `scripts/check-staged.mjs` enforces the bare-`any` + `console.log` policy.
- Google Fonts (Caveat, Permanent Marker, Manrope, JetBrains Mono) in `index.html`. Body font Manrope, page background `#3a2410` per CLAUDE.md §4.
- `src/domain/types.ts` with empty `Card | Thread | Board | Color | Day | Week` aliases.
- `src/App.tsx` renders a centred "Hello board" in Manrope.
- npm scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `format`. No catch-all "check".
- GitHub Actions `.github/workflows/ci.yml` runs on PR + push to `main`: `npm ci → lint → typecheck → test → build → playwright install → test:e2e`. Playwright report uploaded as an artifact on failure.

## Tests added

| Level | Count | Files |
| --- | --- | --- |
| Unit | 1 | `tests/unit/domain.types.test.ts` |
| E2E | 1 | `tests/e2e/smoke.spec.ts` (× 3 browsers = 3 test runs) |

Coverage on `src/domain/`: not enforced this phase (the domain is empty placeholders). The 90% threshold kicks in at Phase 1, per `BUILD_PLAN.md`.

## Design adherence

- Body font and page background match CLAUDE.md §4 tokens (`#3a2410`, Manrope).
- The four required Google Fonts load.
- No design surfaces (cork, wood, cards, threads) are drawn yet — explicitly out of scope for Phase 0.

## Invariants pinned

None this phase — invariants from CLAUDE.md §5 are behavioural and start landing in Phase 1.

## Defects discovered

- The initial install pulled a vulnerable `esbuild` via Vitest 2. Bumped Vitest to `^4.1.6`; the audit is now clean (0 vulnerabilities).

## Tech debt accrued

- The custom pre-commit `any` guard is a regex check, not a TS-AST check, so it sees `any` inside string literals and treats it as a violation. Not an issue today, but if a future test fixture contains `any` in a string, the author will need to escape it via the same `// eslint-disable-next-line` pattern (one-line workaround). Cheap to revisit if it bites.

## Risks / unknowns for next phase

- Phase 1 will introduce real types and operations — the `tests/integration/` directory is not yet created; will be added there. Vitest config currently only matches `tests/unit/**`; will extend in Phase 1 to also pick up `tests/integration/**`.

## Quality gate status

Local, on commit `60eecfb`:

- [x] Lint clean — `npm run lint` (no output, exit 0)
- [x] Types clean — `npm run typecheck` (exit 0)
- [x] Unit + integration green — `npm test` (1 file, 1 test passed)
- [x] E2E green — `npm run test:e2e` (3 tests across chromium/firefox/webkit, 8.1s, all passed)
- [x] Production build succeeds — `npm run build` (140.92 KB JS / 0.32 KB CSS / 0.76 KB HTML)
- [n/a] Coverage threshold met (domain ≥ 90%) — domain is empty; threshold starts Phase 1
- [x] CI green on the head commit (`b48fda4`) — run [25971044626](https://github.com/denyermr/scheduler/actions/runs/25971044626), all 14 steps success, 1m 33s total. See Appendix § CI verification.

## Recommendation

Proceed to Phase 1.

## Appendix

### Installed dependencies (`npm ls --depth=0`)

```
schedule-board@0.0.0 /Users/matthewdenyer/schedule-board
+-- @eslint/js@10.0.1
+-- @playwright/test@1.60.0
+-- @testing-library/jest-dom@6.9.1
+-- @testing-library/react@16.3.2
+-- @types/node@24.12.4
+-- @types/react-dom@18.3.7
+-- @types/react@18.3.28
+-- @vitejs/plugin-react@6.0.2
+-- eslint-config-prettier@9.1.2
+-- eslint-plugin-react-hooks@7.1.1
+-- eslint-plugin-react-refresh@0.5.2
+-- eslint@10.4.0
+-- globals@17.6.0
+-- husky@9.1.7
+-- jsdom@25.0.1
+-- lint-staged@15.5.2
+-- prettier@3.8.3
+-- react-dom@18.3.1
+-- react@18.3.1
+-- typescript-eslint@8.59.3
+-- typescript@6.0.3
+-- vite@8.0.13
`-- vitest@4.1.6
```

### Pre-commit guard verification (Step 11)

Three deliberate breaks were attempted against the pre-commit hook on a clean working tree. Outputs verbatim from `git commit`:

**1. `console.log` injected** → rejected:

```
pre-commit guard failed:
  src/App.tsx:2: console.log is not allowed
husky - pre-commit script failed (code 1)
```

`git log` confirmed no commit was created.

**2. Bare `any` (no override)** → rejected:

```
pre-commit guard failed:
  src/App.tsx:2: bare `any` requires `// eslint-disable-next-line <rule> -- <reason>` on the line above
husky - pre-commit script failed (code 1)
```

`git log` confirmed no commit was created.

**3. `any` with `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- smoke test for the guardrail`** → accepted:

```
[STARTED] *.{ts,tsx} — 1 file
[STARTED] eslint --max-warnings 0
[COMPLETED] eslint --max-warnings 0
[COMPLETED] *.{ts,tsx} — 1 file
...
> schedule-board@0.0.0 typecheck
> tsc -b --noEmit

[phase-0-foundation 21f103f] test: any with eslint-disable + reason should pass
 1 file changed, 3 insertions(+)
```

That test commit (`21f103f`) was then reverted via `git reset --hard HEAD~1`, leaving the branch on `60eecfb chore: scaffold Phase 0 toolchain`.

### Deviations from CLAUDE.md (with rationale)

- **§2 says "ESLint", I used ESLint 10 (flat config) and TypeScript 6.** §2 does not pin a version. ESLint 10 / TS 6 are the current stable lines as of 2026-05. typescript-eslint v8 supports both. ESLint 8 / TS 5 are deprecated paths. No behavioural impact.
- **§2 says "Vite", I used Vite 8.** Latest stable; no breaking impact on React 18.
- **Vitest is on v4 (not v2/3).** The Vite 9 scaffold pulled Vitest 2 with a vulnerable transitive `esbuild`. Bumped to v4 to clear the audit. Vitest 4 is API-compatible with our usage (`describe`/`it`/`expect`).
- **React 18.3.1 is the only hard pin from §2.** Honoured: I overrode the Vite scaffold's React 19 default.
- **Playwright runs against `preview` (the built bundle), per BUILD_PLAN.md Phase 0 scope.**
- **CI uses Node 20 LTS.** §2 does not specify a Node version; chose the current LTS.

### CI verification

PR [#1](https://github.com/denyermr/scheduler/pull/1) — head commit `b48fda4`. Workflow run [25971044626](https://github.com/denyermr/scheduler/actions/runs/25971044626) — total wall-clock 1m 33s.

Per-step conclusions (from `gh api repos/denyermr/scheduler/actions/runs/25971044626/jobs`):

| Step | Conclusion | Duration |
| --- | --- | --- |
| Set up job | success | 1s |
| Checkout | success | 1s |
| Set up Node 20 | success | 1s |
| Install dependencies (`npm ci`) | success | 5s |
| Lint | success | 2s |
| Typecheck | success | 2s |
| Unit tests | success | 1s |
| Build | success | 3s |
| Install Playwright browsers | success | 55s |
| E2E tests | success | 13s |
| Upload Playwright report | success | 2s |

All five gate stages required by `BUILD_PLAN.md` Phase 0 (lint, typecheck, test, build, test:e2e) returned green in CI on the same commit that passed locally.
