import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'reviews/phase-2-patch-B-shots');
mkdirSync(outDir, { recursive: true });

const url = process.env.SB_URL ?? 'http://localhost:4181/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });

async function shot(width, height, suffix) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(url);
  await page.waitForSelector('[data-testid="board-surface"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/page-${suffix}.png`, fullPage: false });
  await page
    .locator('[data-testid="board-surface"]')
    .screenshot({ path: `${outDir}/board-${suffix}.png` });
  if (suffix === '1440') {
    // Closeup of the full day-header row to show Mon-Fri vs Sat-Sun differentiation.
    const surface = page.locator('[data-testid="board-surface"]');
    const box = await surface.boundingBox();
    if (box) {
      await page.screenshot({
        path: `${outDir}/day-headers.png`,
        clip: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: 48,
        },
      });
    }
  }
  await page.close();
}

await shot(1440, 900, '1440');
await shot(1024, 768, '1024');

await browser.close();
console.log('wrote →', outDir);
