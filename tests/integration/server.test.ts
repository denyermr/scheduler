import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, type ServerHandle } from '../../server/server';

let handle: ServerHandle;
let baseUrl: string;

beforeEach(async () => {
  handle = await startServer({ dbPath: ':memory:', port: 0 });
  baseUrl = `http://127.0.0.1:${String(handle.port)}`;
});

afterEach(async () => {
  await handle.close();
});

async function patch(slug: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/b/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('server — GET / PATCH / DELETE /b/:slug', () => {
  it('GET on an unknown slug returns 404', async () => {
    const res = await fetch(`${baseUrl}/b/unknown-slug-1234`);
    expect(res.status).toBe(404);
  });

  it('PATCH then GET round-trips the envelope verbatim', async () => {
    const envelope = {
      locked: false,
      board: {
        startMonday: '2024-05-27',
        weeks: 4,
        cards: [],
        threads: [],
      },
      updatedAt: 12345,
    };
    const put = await patch('oak-thread-helmet-tractor-7421', envelope);
    expect(put.status).toBe(204);

    const get = await fetch(`${baseUrl}/b/oak-thread-helmet-tractor-7421`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toMatch(/application\/json/);
    const echoed = (await get.json()) as typeof envelope;
    expect(echoed).toEqual(envelope);
  });

  it('PATCH is idempotent — later writes replace earlier ones', async () => {
    await patch('test-slug', {
      locked: false,
      board: { startMonday: '2024-05-27', weeks: 4, cards: [], threads: [] },
      updatedAt: 100,
    });
    await patch('test-slug', {
      locked: false,
      board: { startMonday: '2024-05-27', weeks: 6, cards: [], threads: [] },
      updatedAt: 200,
    });
    const res = await fetch(`${baseUrl}/b/test-slug`);
    const body = (await res.json()) as { updatedAt: number; board: { weeks: number } };
    expect(body.updatedAt).toBe(200);
    expect(body.board.weeks).toBe(6);
  });

  it('DELETE removes the row; subsequent GET is 404', async () => {
    await patch('to-delete', {
      locked: false,
      board: { startMonday: '2024-05-27', weeks: 4, cards: [], threads: [] },
      updatedAt: 100,
    });
    const del = await fetch(`${baseUrl}/b/to-delete`, { method: 'DELETE' });
    expect(del.status).toBe(204);
    const get = await fetch(`${baseUrl}/b/to-delete`);
    expect(get.status).toBe(404);
  });

  it('DELETE on an unknown slug is still 204 (idempotent)', async () => {
    const res = await fetch(`${baseUrl}/b/never-existed`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('PATCH with a non-JSON body returns 400', async () => {
    const res = await fetch(`${baseUrl}/b/bad-body`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('PATCH without numeric updatedAt returns 400', async () => {
    const res = await patch('missing-updated-at', {
      locked: false,
      board: { startMonday: '2024-05-27', weeks: 4, cards: [], threads: [] },
    });
    expect(res.status).toBe(400);
  });

  it('Paths outside /b/:slug return 404', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(404);
    const res2 = await fetch(`${baseUrl}/something/else`);
    expect(res2.status).toBe(404);
  });

  it('Unsupported HTTP methods return 405', async () => {
    const res = await fetch(`${baseUrl}/b/test-slug`, { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('Server stores the envelope opaquely (does not parse cards / threads)', async () => {
    // A weird payload — not a real board — survives because the server treats
    // the body as opaque text after extracting updatedAt.
    const weird = {
      locked: false,
      board: { startMonday: 'whatever', weeks: 0, cards: [{ id: 'x' }], threads: [] },
      updatedAt: 1,
      extra: 'a field the server has no opinion on',
    };
    const put = await patch('opaque-test', weird);
    expect(put.status).toBe(204);
    const res = await fetch(`${baseUrl}/b/opaque-test`);
    expect(await res.json()).toEqual(weird);
  });

  it('Server accepts forward-compat legacy slug shapes too', async () => {
    // Routing in the server is permissive — only [a-z0-9-]+ is enforced.
    const res = await patch('oak-thread-942', {
      locked: false,
      board: { startMonday: '2024-05-27', weeks: 4, cards: [], threads: [] },
      updatedAt: 1,
    });
    expect(res.status).toBe(204);
  });

  it('GET /healthz returns 200 ok (always available, no staticDir needed)', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

// Phase 8A — production mode: the same server process serves the built SPA
// alongside the /b/:slug API. Opt in by passing `staticDir`. When the option
// is absent (test default above), behavior is unchanged.
describe('server — production mode (staticDir)', () => {
  let prodHandle: ServerHandle;
  let prodBaseUrl: string;
  let staticDir: string;

  beforeEach(async () => {
    staticDir = mkdtempSync(join(tmpdir(), 'sb-static-'));
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>SB</title>');
    mkdirSync(join(staticDir, 'assets'), { recursive: true });
    writeFileSync(join(staticDir, 'assets', 'app.js'), 'export const app=1;');
    writeFileSync(join(staticDir, 'assets', 'app.css'), 'body{}');
    prodHandle = await startServer({ dbPath: ':memory:', port: 0, staticDir });
    prodBaseUrl = `http://127.0.0.1:${String(prodHandle.port)}`;
  });

  afterEach(async () => {
    await prodHandle.close();
    rmSync(staticDir, { recursive: true, force: true });
  });

  it('GET / serves index.html with text/html', async () => {
    const res = await fetch(`${prodBaseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('<title>SB</title>');
  });

  it('GET an existing asset serves the file with the right content-type', async () => {
    const js = await fetch(`${prodBaseUrl}/assets/app.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toMatch(/javascript/);
    expect(await js.text()).toContain('export const app');

    const css = await fetch(`${prodBaseUrl}/assets/app.css`);
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toMatch(/css/);
  });

  it('GET an unknown SPA route (no extension) falls back to index.html', async () => {
    const res = await fetch(`${prodBaseUrl}/some/client/route`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('<title>SB</title>');
  });

  it('GET an unknown file with an extension returns 404 (do not mask broken assets)', async () => {
    const res = await fetch(`${prodBaseUrl}/missing.js`);
    expect(res.status).toBe(404);
  });

  it('GET /b/:slug with Accept: text/html serves the SPA (browser navigation)', async () => {
    const res = await fetch(`${prodBaseUrl}/b/whatever-slug`, {
      headers: { Accept: 'text/html' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('GET /b/:slug with Accept: application/json still returns the API 404', async () => {
    const res = await fetch(`${prodBaseUrl}/b/never-existed`, {
      headers: { Accept: 'application/json' },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
  });

  it('PATCH /b/:slug still writes; subsequent GET (no Accept) returns the envelope JSON', async () => {
    const envelope = {
      locked: false,
      board: { startMonday: '2024-05-27', weeks: 4, cards: [], threads: [] },
      updatedAt: 7,
    };
    const put = await fetch(`${prodBaseUrl}/b/prod-write`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    expect(put.status).toBe(204);
    const get = await fetch(`${prodBaseUrl}/b/prod-write`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toMatch(/application\/json/);
    expect(await get.json()).toEqual(envelope);
  });

  it('Path traversal attempts cannot read outside staticDir', async () => {
    // fetch() normalizes `..` in URLs client-side, so percent-encode `../` to
    // get the literal escape sequence on the wire. The server must reject it
    // (or at worst, harmlessly 404 / serve the SPA shell) — never the host
    // file. `root:` is the canonical /etc/passwd sentinel.
    const res = await fetch(`${prodBaseUrl}/%2e%2e/%2e%2e/%2e%2e/etc/passwd`);
    const body = await res.text();
    expect(body).not.toContain('root:');
  });

  it('GET /healthz returns 200 ok in prod mode too', async () => {
    const res = await fetch(`${prodBaseUrl}/healthz`);
    expect(res.status).toBe(200);
  });
});

// Phase 7.5 — SITE_PASSWORD gate. PATCH for a slug that does not exist
// requires the `X-Site-Password` header. Existing-slug PATCH stays open
// (slug entropy is the protection for edits).
describe('server — SITE_PASSWORD create gate (Phase 7.5)', () => {
  let gatedHandle: ServerHandle;
  let gatedUrl: string;
  const SITE_PASSWORD = 'test-site-pw-2026';

  beforeEach(async () => {
    gatedHandle = await startServer({
      dbPath: ':memory:',
      port: 0,
      sitePassword: SITE_PASSWORD,
    });
    gatedUrl = `http://127.0.0.1:${String(gatedHandle.port)}`;
  });

  afterEach(async () => {
    await gatedHandle.close();
  });

  function lockedEnvelope(updatedAt: number) {
    return {
      locked: true,
      ciphertext: 'AAAA',
      iv: 'BBBB',
      kdfSalt: 'CCCC',
      kdfIters: 200_000,
      updatedAt,
    };
  }

  it('PATCH on a new slug WITHOUT X-Site-Password returns 401, no row inserted', async () => {
    const slug = 'never-created-without-pw';
    const res = await fetch(`${gatedUrl}/b/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lockedEnvelope(100)),
    });
    expect(res.status).toBe(401);
    const get = await fetch(`${gatedUrl}/b/${slug}`);
    expect(get.status).toBe(404);
  });

  it('PATCH on a new slug with WRONG X-Site-Password returns 401, no row inserted', async () => {
    const slug = 'never-created-wrong-pw';
    const res = await fetch(`${gatedUrl}/b/${slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Password': 'wrong-pw',
      },
      body: JSON.stringify(lockedEnvelope(100)),
    });
    expect(res.status).toBe(401);
    const get = await fetch(`${gatedUrl}/b/${slug}`);
    expect(get.status).toBe(404);
  });

  it('PATCH on a new slug with correct X-Site-Password returns 204, row inserted', async () => {
    const slug = 'created-with-pw';
    const res = await fetch(`${gatedUrl}/b/${slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Password': SITE_PASSWORD,
      },
      body: JSON.stringify(lockedEnvelope(100)),
    });
    expect(res.status).toBe(204);
    const get = await fetch(`${gatedUrl}/b/${slug}`);
    expect(get.status).toBe(200);
  });

  it('PATCH on an EXISTING slug without X-Site-Password is allowed (edits stay open)', async () => {
    const slug = 'edit-without-pw';
    // First, create with the site password
    await fetch(`${gatedUrl}/b/${slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Password': SITE_PASSWORD,
      },
      body: JSON.stringify(lockedEnvelope(100)),
    });
    // Then edit without it
    const res = await fetch(`${gatedUrl}/b/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lockedEnvelope(200)),
    });
    expect(res.status).toBe(204);
    const get = await fetch(`${gatedUrl}/b/${slug}`);
    const body = (await get.json()) as { updatedAt: number };
    expect(body.updatedAt).toBe(200);
  });

  it('401 response body does not echo the submitted password', async () => {
    const res = await fetch(`${gatedUrl}/b/echo-test`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Password': 'super-secret-that-must-not-leak',
      },
      body: JSON.stringify(lockedEnvelope(100)),
    });
    const body = await res.text();
    expect(body).not.toContain('super-secret-that-must-not-leak');
  });

  it('When NO sitePassword is configured, the server still works (gate is off)', async () => {
    const noGate = await startServer({ dbPath: ':memory:', port: 0 });
    const url = `http://127.0.0.1:${String(noGate.port)}`;
    const res = await fetch(`${url}/b/no-gate-create`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lockedEnvelope(100)),
    });
    expect(res.status).toBe(204);
    await noGate.close();
  });
});
