import { test, expect } from '@playwright/test';

test('home page renders Hello board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Hello board')).toBeVisible();
});
