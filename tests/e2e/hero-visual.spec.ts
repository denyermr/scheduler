import { test, expect } from '@playwright/test';

test.describe('hero board visual regression', () => {
  test.use({ viewport: { width: 1280, height: 1400 } });

  // The baseline is anti-alias / font-renderer specific; we lock it on
  // chromium only and let the other browsers cover behavioural smoke tests.
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium baseline only');

  // Baselines are stamped per-platform. Until CI seeds its own Linux
  // baseline (Phase 8 cross-browser work), this spec only runs locally.
  // Set `SB_RUN_VISUAL=1` to force it on.
  test.skip(
    !!process.env['CI'] && !process.env['SB_RUN_VISUAL'],
    'visual regression baseline is host-specific; run locally or seed CI explicitly',
  );

  test('matches the committed baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="board-surface"]');
    // Wait for Google Fonts to load — otherwise the FOUT inflates the diff.
    await page.evaluate(() => document.fonts.ready);
    // Give the cork texture / pin-hole layout a tick to settle.
    await page.waitForTimeout(300);
    const frame = page.locator('[data-testid="board-frame"]');
    await expect(frame).toHaveScreenshot('hero-board.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
