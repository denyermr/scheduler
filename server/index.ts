import { startServer } from './server';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? 'data/dev.sqlite';
// When STATIC_DIR is set (production), the same process also serves the
// built SPA + SPA fallback. In dev, leave it unset so Vite handles the
// frontend and the server is API-only.
const STATIC_DIR = process.env.STATIC_DIR;

void startServer({ dbPath: DB_PATH, port: PORT, staticDir: STATIC_DIR }).then(
  (handle) => {
    process.stdout.write(
      `Schedule Board server listening on http://0.0.0.0:${String(handle.port)}` +
        (STATIC_DIR !== undefined ? ` (serving SPA from ${STATIC_DIR})` : '') +
        '\n',
    );
  },
);
