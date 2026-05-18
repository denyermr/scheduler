import { createServer, type Server } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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

  const server = createServer((req, res) => {
    const url = req.url ?? '';
    const match = SLUG_RE.exec(url);
    if (match === null) {
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
