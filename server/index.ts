import { startServer } from './server';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? 'data/dev.sqlite';
// When STATIC_DIR is set (production), the same process also serves the
// built SPA + SPA fallback. In dev, leave it unset so Vite handles the
// frontend and the server is API-only.
const STATIC_DIR = process.env.STATIC_DIR;
// Phase 7.5 create gate. When set, PATCH on a not-yet-existent slug
// requires the X-Site-Password header. Leave unset in dev / tests.
const SITE_PASSWORD = process.env.SITE_PASSWORD;

void startServer({
  dbPath: DB_PATH,
  port: PORT,
  staticDir: STATIC_DIR,
  sitePassword: SITE_PASSWORD,
}).then((handle) => {
  process.stdout.write(
    `Schedule Board server listening on http://0.0.0.0:${String(handle.port)}` +
      (STATIC_DIR !== undefined ? ` (serving SPA from ${STATIC_DIR})` : '') +
      (SITE_PASSWORD !== undefined ? ' (site-password gate ON)' : '') +
      '\n',
  );
});
