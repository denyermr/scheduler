import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'reviews/phase-2-patch-B-shots');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1300 },
  deviceScaleFactor: 2,
});
await page.goto(
  'http://localhost:4182/reviews/phase-2-patch-B-shots/design-host.html',
);
await page
  .waitForFunction(() => !!document.querySelector('div [style*="repeat"]'), null, {
    timeout: 10_000,
  })
  .catch(() => null);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/design-hero-1440.png` });
await browser.close();
console.log('wrote', `${outDir}/design-hero-1440.png`);
