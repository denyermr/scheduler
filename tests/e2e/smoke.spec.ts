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

test('hero board renders the 26 weeks and demo cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="week-row"]')).toHaveCount(26);
  // The hero demo set is 57 cards (47 weekday + 7 weekend + 3 stacked at
  // (week 4, day 2) added in Phase 4 to showcase workflow 02).
  await expect(page.locator('[data-testid="card-slot"]')).toHaveCount(57);
  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(4);
});
