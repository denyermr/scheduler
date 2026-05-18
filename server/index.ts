import { startServer } from './server';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? 'data/dev.sqlite';

void startServer({ dbPath: DB_PATH, port: PORT }).then((handle) => {
  process.stdout.write(
    `Schedule Board server listening on http://localhost:${String(handle.port)}\n`,
  );
});
