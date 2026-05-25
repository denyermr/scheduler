import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BACKEND_PORT = 8787;
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['html'], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      // Phase 7 backend — node:http + better-sqlite3. Uses an in-memory DB
      // so the e2e suite is hermetic between runs.
      // SITE_PASSWORD enables the Phase 7.5 create gate; matches
      // `E2E_SITE_PASSWORD` in tests/e2e/helpers.ts.
      command: `npm run server`,
      env: {
        PORT: String(BACKEND_PORT),
        DB_PATH: ':memory:',
        SITE_PASSWORD: 'e2e-site-pw-2026',
      },
      port: BACKEND_PORT,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 30_000,
    },
    {
      command: `npm run preview -- --port ${String(PORT)} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
});
