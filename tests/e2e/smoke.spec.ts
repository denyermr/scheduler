import { test, expect } from '@playwright/test';

test('home page renders the schedule board chrome', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  await expect(page.getByText('scheduleboard.app /')).toBeVisible();
});

test('hero board shows all 5 day headers', async ({ page }) => {
  await page.goto('/');
  for (const label of ['MON', 'TUES', 'WED', 'THURS', 'FRI']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
});

test('hero board renders the 26 weeks and demo cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="week-row"]')).toHaveCount(26);
  // The hero demo set is 47 cards.
  await expect(page.locator('[data-testid="card-slot"]')).toHaveCount(47);
  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(4);
});
