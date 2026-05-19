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
});
