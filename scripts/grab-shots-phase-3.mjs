import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'reviews/phase-3-shots');
mkdirSync(outDir, { recursive: true });

const url = process.env.SB_URL ?? 'http://localhost:4173/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });

async function settle(page) {
  await page.waitForSelector('[data-testid="board-surface"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

// 1) Hero page (demo board) at 1440.
{
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  // Clean storage so the demo always seeds for the screenshot.
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await settle(page);
  await page.screenshot({
    path: `${outDir}/page-1440.png`,
    fullPage: false,
  });
  await page.close();
}

// 2) Editing-a-new-card with the EditPopover open.
{
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await settle(page);
  await page.locator('[data-testid="cell-0-5"]').click();
  await page
    .locator('[data-testid="edit-popover-input"]')
    .type('Dress + light');
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${outDir}/popover-new-card.png`,
    fullPage: false,
  });
  await page.close();
}

// 3) Editing an existing card — opens the popover with text pre-filled,
// hover to show the eight swatches + Delete.
{
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await settle(page);

  // Open the first existing card on the board.
  const firstCard = page.locator('[data-testid="card-slot"]').first();
  await firstCard.click();
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${outDir}/popover-existing-card.png`,
    fullPage: false,
  });

  // Click the coral swatch and screenshot the recolored card.
  await page.locator('[data-testid="swatch-coral"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${outDir}/popover-recolor.png`,
    fullPage: false,
  });
  await page.close();
}

await browser.close();
console.log('wrote →', outDir);
