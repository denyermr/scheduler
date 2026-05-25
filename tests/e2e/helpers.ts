import type { Page } from '@playwright/test';

/**
 * Site password the Playwright webServer launches with (see playwright.config.ts).
 * Tests use this to drive the Phase 7.5 splash flow.
 */
export const E2E_SITE_PASSWORD = 'e2e-site-pw-2026';

/**
 * Convenience for tests that just need *a* live board to act on. Goes to /,
 * fills both passwords on the splash, waits for /b/<slug> to load, returns
 * the slug + boardPassword for any follow-up assertions.
 *
 * Phase 7.5 made the splash mandatory; previously tests went straight to
 * /b/<auto-slug>. This helper preserves the "I just want a board" shorthand.
 */
export async function gotoFreshBoard(
  page: Page,
  boardPassword = 'e2e-board-pw',
): Promise<{ slug: string; boardPassword: string }> {
  await page.goto('/');
  await page.getByLabel(/site password/i).fill(E2E_SITE_PASSWORD);
  await page.getByLabel(/board password/i).fill(boardPassword);
  await page.getByRole('button', { name: /create board/i }).click();
  // Wait for navigation to /b/<slug>
  await page.waitForURL(/\/b\/[a-z0-9-]+/);
  await page.locator('[data-testid="board-surface"]').waitFor();
  const url = new URL(page.url());
  const slug = url.pathname.replace(/^\/b\//, '');
  return { slug, boardPassword };
}
