import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'reviews/phase-2-shots');
mkdirSync(outDir, { recursive: true });

const url = process.env.SB_URL ?? 'http://localhost:4174/';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 1400 },
  deviceScaleFactor: 2,
});
await page.goto(url);
await page.waitForSelector('[data-testid="board-surface"]');
// Let the web fonts settle.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/hero-page.png`, fullPage: true });
await page.locator('[data-testid="board-frame"]').screenshot({
  path: `${outDir}/hero-board.png`,
});
await page
  .locator('[data-testid="card"][data-card-id="card_demo_0000"]')
  .screenshot({ path: `${outDir}/hero-card-marker.png` });
await page
  .locator('[data-testid="card"][data-card-id="card_demo_0005"]')
  .screenshot({ path: `${outDir}/hero-card-caveat.png` });
await browser.close();
console.log('wrote screenshots →', outDir);
