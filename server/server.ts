import { createServer, type Server, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, normalize, resolve, sep } from 'node:path';
import Database from 'better-sqlite3';

/**
 * Single-file backend per `reviews/phase-7-backend-decision.md` §1.
 *
 *   GET    /b/:slug   → 200 envelope-as-JSON | 404
 *   PATCH  /b/:slug   → 204 (idempotent replace; payload stored as opaque TEXT)
 *   DELETE /b/:slug   → 204
 *
 * Schema is a single table:
 *
 *   boards(slug TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)
 *
 * `payload` is the JSON envelope the client sent. The server never parses
 * card / thread structure — it only reads `updatedAt` from the body of a
 * PATCH so it can index by recency. This is the constraint that makes
 * Phase 7.5's `{ ciphertext, iv, kdfSalt, kdfIters }` envelope a
 * zero-migration addition.
 */

const SLUG_RE = /^\/b\/([a-z0-9-]+)\/?$/;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB — comfortably above a 26-week / 80-card board

export type StartOptions = {
  /** SQLite file path. Use ':memory:' for tests. */
  dbPath: string;
  /** Port to bind. 0 = ephemeral (the OS chooses). */
  port: number;
  /**
   * Directory of built SPA assets (Phase 8A). When set, the server also
   * serves the SPA: static files for known assets, index.html as the fallback
   * for client-side routes, and index.html for `GET /b/:slug` with
   * `Accept: text/html`. When unset (the test default), behavior is
   * unchanged — only the API exists.
   */
  staticDir?: string;
  /**
   * Site-wide password gating *creation* of new boards (Phase 7.5). When set,
   * PATCH on a slug that does not yet exist requires the `X-Site-Password`
   * header to match this value. Existing-slug PATCH is always allowed (slug
   * entropy is the protection for edits). When unset, the gate is off (used
   * by tests + dev where bot exposure is zero).
   */
  sitePassword?: string;
};

export type ServerHandle = {
  server: Server;
  port: number;
  close: () => Promise<void>;
};

export async function startServer(opts: StartOptions): Promise<ServerHandle> {
  if (opts.dbPath !== ':memory:') {
    mkdirSync(dirname(opts.dbPath), { recursive: true });
  }
  const db = new Database(opts.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      slug       TEXT    PRIMARY KEY,
      payload    TEXT    NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const getStmt = db.prepare(
    'SELECT payload, updated_at FROM boards WHERE slug = ?',
  );
  const putStmt = db.prepare(`
    INSERT INTO boards (slug, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  const delStmt = db.prepare('DELETE FROM boards WHERE slug = ?');

  const staticRoot =
    opts.staticDir !== undefined ? resolve(opts.staticDir) : null;

  const server = createServer((req, res) => {
    const url = req.url ?? '';
    const pathname = url.split('?')[0] ?? '';

    // /healthz — always available, regardless of staticDir. Cheap liveness
    // probe for Fly machine checks.
    if (req.method === 'GET' && pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    const match = SLUG_RE.exec(url);
    if (match === null) {
      // Outside the API surface. In prod (staticDir set), this is either a
      // static asset, a client-side route (→ index.html), or a 404.
      if (staticRoot !== null && req.method === 'GET') {
        serveStaticOrSpa(res, staticRoot, pathname);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const slug = match[1];
    if (slug === undefined) {
      res.writeHead(404).end();
      return;
    }

    switch (req.method) {
      case 'GET': {
        // `/b/:slug` is also the SPA route. Browser navigation arrives with
        // `Accept: text/html` — in prod mode, serve index.html and let the
        // client router pick up the slug. The Vite dev proxy does the same
        // thing.
        if (staticRoot !== null && acceptsHtml(req.headers.accept)) {
          serveIndexHtml(res, staticRoot);
          return;
        }
        const row = getStmt.get(slug) as
          | { payload: string; updated_at: number }
          | undefined;
        if (row === undefined) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('No board at this slug');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(row.payload);
        return;
      }
      case 'PATCH': {
        // Phase 7.5 site-creation gate: when sitePassword is configured AND
        // the slug doesn't exist yet, require X-Site-Password. Existing-slug
        // PATCH stays open. Constant-time-ish header comparison is overkill
        // for a personal-deployment anti-bot — a simple === is fine here.
        if (opts.sitePassword !== undefined) {
          const existing = getStmt.get(slug);
          if (existing === undefined) {
            const submitted = req.headers['x-site-password'];
            const value = Array.isArray(submitted) ? submitted[0] : submitted;
            if (value !== opts.sitePassword) {
              res.writeHead(401, { 'Content-Type': 'text/plain' });
              res.end('Site password required to create a new board');
              return;
            }
          }
        }
        readBody(req, MAX_BODY_BYTES)
          .then((body) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(body);
            } catch {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Body is not valid JSON');
              return;
            }
            const updatedAt = extractUpdatedAt(parsed);
            if (updatedAt === null) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Envelope is missing a numeric updatedAt');
              return;
            }
            putStmt.run(slug, body, updatedAt);
            res.writeHead(204).end();
          })
          .catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : 'Failed to read body';
            res.writeHead(413, { 'Content-Type': 'text/plain' });
            res.end(message);
          });
        return;
      }
      case 'DELETE': {
        delStmt.run(slug);
        res.writeHead(204).end();
        return;
      }
      default: {
        res.writeHead(405, { Allow: 'GET, PATCH, DELETE' });
        res.end();
        return;
      }
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(opts.port, () => {
      resolve();
    });
  });
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('Server failed to bind a numeric port.');
  }
  const port = addr.port;

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

function readBody(
  req: import('node:http').IncomingMessage,
  maxBytes: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error(`Body exceeds ${String(maxBytes)} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

function extractUpdatedAt(parsed: unknown): number | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as { updatedAt?: unknown };
  if (typeof obj.updatedAt !== 'number') return null;
  if (!Number.isFinite(obj.updatedAt)) return null;
  return obj.updatedAt;
}

function acceptsHtml(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header.join(',') : (header ?? '');
  return value.includes('text/html');
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStaticOrSpa(
  res: ServerResponse,
  staticRoot: string,
  pathname: string,
): void {
  // Resolve the requested path against the static root. `normalize` collapses
  // `..` segments; the explicit prefix check rejects anything that escapes.
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const fsPath = resolve(staticRoot, '.' + (safe.startsWith('/') ? safe : '/' + safe));
  if (fsPath !== staticRoot && !fsPath.startsWith(staticRoot + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (tryServeFile(res, fsPath)) return;

  // No file at that path. If it looks like a client-side route (no extension),
  // fall back to index.html so the SPA can pick it up. Anything with an
  // extension is a genuine 404 — don't mask broken assets.
  if (extname(pathname) === '') {
    serveIndexHtml(res, staticRoot);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function serveIndexHtml(res: ServerResponse, staticRoot: string): void {
  const indexPath = resolve(staticRoot, 'index.html');
  if (!tryServeFile(res, indexPath)) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('index.html missing from staticDir');
  }
}

function tryServeFile(res: ServerResponse, fsPath: string): boolean {
  try {
    const stat = statSync(fsPath);
    if (!stat.isFile()) return false;
    const contentType = CONTENT_TYPES[extname(fsPath).toLowerCase()] ?? 'application/octet-stream';
    const body = readFileSync(fsPath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}
