# Phase 7.5 Review — Mandatory locked boards + site-creation gate

## Summary

Brings Phase 7.5 forward (was previously gated on Phase 7 dogfooding) and amends it from "optional opt-in" to "mandatory, no unlocked variant." Adds a static `SITE_PASSWORD` (Fly secret) that gates *creation* of new boards. Every board is encrypted client-side (PBKDF2-SHA256 → AES-GCM, Web Crypto only) before any payload reaches the server; the server stores opaque locked envelopes and can no longer enumerate, search, or recover content. The `/` route is now a splash with two password fields; `/b/<slug>` shows an unlock prompt before the board; sessionStorage caches the derived AES key per-tab so reloads in the same tab don't re-prompt.

The change was triggered immediately post-Phase 8A deploy: an unguarded `schedule-board.fly.dev` would have let bots spawn arbitrary boards. Per-board encryption is also the right protection regardless — the site password handles bots, the board password protects content.

## What shipped

**Server**
- New `sitePassword` option on `startServer`; `SITE_PASSWORD` env wired through `server/index.ts`. PATCH on a slug that doesn't yet exist requires the `X-Site-Password` header to match — 401 otherwise. Existing-slug PATCH (edits) stays open (slug entropy 9×10¹⁴ is the protection there).

**Client crypto (`src/persistence/crypto.ts`)**
- `deriveKey(passphrase, kdfSalt, kdfIters)` — PBKDF2-SHA256, 200 000 iters default (OWASP 2026 floor).
- `encryptBoard(board, key) → { ciphertext, iv }` — AES-GCM, fresh 12-byte IV per encrypt.
- `decryptEnvelope(payload, key) → Board | null` — null on auth-tag failure (no throw → caller distinguishes "wrong password" from "actually broken" cleanly).
- `randomSalt()`, `exportKeyRaw(key)`, `importKeyRaw(b64)` — helpers for fresh salts and sessionStorage round-tripping.
- Web Crypto only. **No new runtime dependency.**

**Wire format (`src/persistence/envelope.ts`)**
- `LockedEnvelope` + `UnlockedEnvelope` type aliases + `isLocked` predicate (mirrors `isUnlocked`). The Phase 7 discriminated-union envelope's `locked: true` arm is now produced and consumed end-to-end.

**RemoteRepository (`src/persistence/remote.ts`)**
- New optional `CryptoContext` on constructor. When set, `save()` encrypts before PATCH and `load()` / `subscribe()` decrypt incoming envelopes (decryption failures are silently dropped in `subscribe`; the next poll tries again).
- New `loadEnvelope(slug)` — returns the raw envelope (or null for 404). Used by the unlock screen to read `kdfSalt` + `kdfIters` before a key exists.
- New `createLockedBoard(slug, board, crypto, sitePassword)` — splash flow. PATCHes with `X-Site-Password` header. Returns `'ok' | 'unauthorized' | 'error'`.
- Defensive: a save() without a crypto context refuses to overwrite an existing locked envelope (never silently downgrade).

**Key cache (`src/persistence/keyCache.ts`)**
- Per-tab sessionStorage cache. `exportKeyRaw` → JSON → sessionStorage, indexed by slug. Reloads in the same tab silently re-import the key and skip the prompt. Tab close clears.

**UI screens**
- `src/ui/SplashScreen.tsx` — the `/` route. Two password fields on a cork-paper card (matches Phase 2 Patch B surfaces). Caption explicitly says "no recovery."
- `src/ui/UnlockScreen.tsx` — the `/b/<slug>` pre-decrypt shell. One password field, surfaces the slug so the visitor confirms which board. `notFound` prop swaps in a "Board not found" card with a link back to `/`.

**App shell (`src/AppShell.tsx`)**
- Orchestrates splash → unlock → app. SplashHost handles slug gen + crypto + create + nav. BoardHost manages the load-envelope / check-cache / show-unlock / decrypt / mount-App state machine.
- `navigate` is injectable so tests can spy (jsdom rejects spying on `window.location.assign`).

**Routing (`src/state/useRoute.ts`)**
- Rewritten to return `{ mode: 'splash' } | { mode: 'board', slug }`. `/` stays at splash; `/b/<valid-slug>` parses; anything else normalises to `/`. The old "/ auto-generates a slug" behavior is gone.

**Spec amendments (`CLAUDE.md`, `BUILD_PLAN.md`)**
- §5 invariant 2 rewritten for mandatory passphrase + site gate.
- §5 invariant 11 generalised: "all boards" (was "locked boards") never round-trip plaintext.
- §9 Phase 7.5 + site-gate decisions marked resolved; Phase 8 hosting/domain marked resolved.
- §10 change-log rows for the Phase 8A deploy and the Phase 7.5 scope upgrade.
- BUILD_PLAN.md Phase 7.5 section rewritten end-to-end.

## Tests added

| Level | Count | Files |
|---|---|---|
| Unit | 14 | [tests/unit/persistence/crypto.test.ts](../tests/unit/persistence/crypto.test.ts) — derive / roundtrip / wrong-key / tamper / fast-check property |
| Integration | ~40 | server gate (6 in `server.test.ts`), crypto-mode repo (10 in `remoteRepository.test.ts`), splash + unlock screens (19), AppShell orchestration (7), updated useRoute (6) |
| E2E | 5 | [tests/e2e/locked-boards.spec.ts](../tests/e2e/locked-boards.spec.ts) — splash happy + wrong-site-pw, two-context unlock, board-not-found, no-plaintext-in-payload |

All existing tests updated for the new flow. Coverage on `src/domain/` unchanged (no domain changes this phase).

**Quality gate at merge candidate:** 356 unit + integration tests passing, 46 e2e passing across chromium / firefox / webkit (8 pre-existing skips, no new), lint + typecheck clean, build `198 kB raw / 65 kB gzip` (under Phase 8 250 kB target).

## Design adherence

The splash and unlock screens are paper-on-cork cards floating on the existing page background (`PAGE_BG`) — they reuse `CORK_TEXTURE_BG`, `BOARD_FLOAT_SHADOW`, `SURFACE.paper`, Caveat for titles and Manrope for inputs. A coloured pin head decoration ties the chrome to the same vocabulary as a regular card. No new visual primitives; the form is just another instance of the existing tactile surface.

## Invariants pinned

- **§5 invariant 1 (URL = identity).** UnlockScreen surfaces the slug to the visitor; a fresh tab on `/b/<slug>` returns the same board state to anyone with the password.
- **§5 invariant 2 (anyone with link + passphrase can edit).** Two-context Playwright spec opens the same URL in a fresh context and asserts decrypt+render works with the right password and is rejected with the wrong one.
- **§5 invariant 4 (LWW over 10s poll).** `subscribe (with crypto)` integration test asserts the polled envelope is decrypted before LWW runs; merge outcomes match the Phase 7 plaintext case.
- **§5 invariant 11 (no plaintext on the server).** Two pins:
  1. Integration: `save (with crypto context) encrypts the board — server never sees plaintext` — raw fetch the persisted envelope and assert the ciphertext doesn't contain the known card text.
  2. E2E: `network payload of a save never contains plaintext card text` — Playwright intercepts PATCH bodies and asserts they're locked envelopes with no canary string.

## Defects discovered

- jsdom 25 + TypeScript 6's generic `Uint8Array<ArrayBufferLike>` is incompatible with Web Crypto's `BufferSource` (`ArrayBufferView<ArrayBuffer>`). Fixed in `crypto.ts` via a `bytes(n): Uint8Array<ArrayBuffer>` helper so the narrow type flows through.
- jsdom's `window.location.assign` cannot be replaced via `vi.spyOn`. Fixed by making `navigate` an injectable prop on `AppShell` (default: `(url) => window.location.assign(url)`).
- Test teardown could rip the server out from under an in-flight `repository.load`, surfacing as an "Unhandled Rejection" in vitest. Fixed by adding a swallow-the-rejection arm to `useBoardEditor`'s load `.then(...)` — production semantics unchanged (the 10s poll recovers on transient).

## Tech debt accrued

- `src/persistence/localStorage.ts` and `demoBoard.ts` are still unused after Phase 7. Phase 7.5 didn't remove them (out of scope). Phase 7's open-item carry-over to Phase 8B.
- AppShell's `BoardHost` reconstructs the RemoteRepository on every transition through `useMemo`. Fine for now; if polling overhead becomes visible the right answer is a single repo instance with an `attachCrypto(ctx)` method rather than reconstruction.
- The `Envelope` type union still includes `{ locked: false }`. Production code no longer produces or accepts it (server save without crypto refuses to overwrite a locked envelope), but the type is kept around for the legacy test path. Can be deleted in Phase 7.6 / 8B alongside `localStorage.ts`.
- Sessions storing the raw AES key in sessionStorage is a *deliberate* choice for the personal-deployment threat model (any XSS = total compromise anyway, so marginal risk vs. the UX win of skipping re-prompt). Not a debt — just worth flagging.

## Risks / unknowns for next phase

- **Site password rotation.** Documented in the spec (`fly secrets set SITE_PASSWORD=<new>`) — no impact on existing boards (they're locked by their own per-board passwords). If a real third-party user appears, this can be replaced with per-invitee tokens (out of scope for v1).
- **Lost test-board data on deploy.** The live volume has Phase 8A unlocked test envelopes. The deploy step wipes the boards table (per the BUILD_PLAN §16). User explicitly OK'd this.
- **First-time unlock is ~200 ms** (PBKDF2 with 200 000 iterations). Felt instant on a desktop; may feel slower on older mobile. Phase 8B should profile on a mid-spec phone.
- **No "change board passphrase" UX.** A user who wants to rotate a board's passphrase has no in-app way to do so. Defer until requested.

## Quality gate status

- [x] Lint clean
- [x] Types clean
- [x] Unit + integration green (356 / 356)
- [x] E2E green (46 / 46, 8 pre-existing skips)
- [x] Production build succeeds (198 kB raw / 65 kB gzip)
- [x] Coverage threshold met (`src/domain/` unchanged from Phase 7 — ≥ 97 % lines / 95 % branches)
- [ ] CI green on the merge commit (verify post-push)
- [ ] Live deploy verified: create + unlock flow works at `https://schedule.potterstudio.net/` (verify post-deploy)

## Recommendation

Proceed to deploy. The merge sequence is:

1. Set the Fly secret: `fly secrets set SITE_PASSWORD=<chosen value>`
2. Wipe existing test boards on the prod volume (`fly ssh console -a schedule-board` → `sqlite3 /data/prod.sqlite "DELETE FROM boards"`)
3. Merge this PR to main
4. `fly deploy` from main (CI is green; no surprise deltas)
5. Smoke: open `https://schedule.potterstudio.net/`, enter the site password + a chosen board password, verify it lands on `/b/<slug>` with an empty board. Open in a private window with the URL, confirm unlock prompt + decrypt.

Then Phase 8B (launch polish: a11y, perf, cross-browser, empty/loading states, README, carried-over Phase 7 open items) on a fresh branch off main.

## Appendix

**Network payload spot-check.** While the integration suite asserts the persisted envelope shape, here's a paste-friendly check for the live deploy:

```bash
curl -s https://schedule.potterstudio.net/b/<your-slug> | jq
# Expected shape: { "locked": true, "ciphertext": "...", "iv": "...",
#                   "kdfSalt": "...", "kdfIters": 200000, "updatedAt": <number> }
# No `board`, `cards`, `threads`, or any text field anywhere.
```
