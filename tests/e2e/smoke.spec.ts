import { test, expect } from '@playwright/test';

test('home page renders the schedule board chrome', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  await expect(page.getByText('scheduleboard.app /')).toBeVisible();
});

test('hero board shows all 7 day headers (Mon..Sun)', async ({ page }) => {
  await page.goto('/');
  for (const label of ['MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT', 'SUN']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
});

test('a fresh slug renders 26 empty weeks (Phase 7 — demo seed scrapped)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="week-row"]')).toHaveCount(26);
  // Phase 7: `/` redirects to a freshly-generated slug, which 404s on the
  // backend and renders an empty board (invariant 1). No demo cards anymore.
  await expect(page.locator('[data-testid="card-slot"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(0);
});
