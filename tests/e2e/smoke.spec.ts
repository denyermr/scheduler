import { test, expect } from '@playwright/test';
import { gotoFreshBoard } from './helpers';

test('home page (/) renders the splash screen, not a board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/site password/i)).toBeVisible();
  await expect(page.getByLabel(/board password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /create board/i })).toBeVisible();
});

test('after splash submit, board chrome and 7 day headers render', async ({ page }) => {
  await gotoFreshBoard(page);
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  for (const label of ['MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT', 'SUN']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
});

test('a fresh slug renders 26 empty weeks (no demo seed)', async ({ page }) => {
  await gotoFreshBoard(page);
  await expect(page.locator('[data-testid="week-row"]')).toHaveCount(26);
  await expect(page.locator('[data-testid="card-slot"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(0);
});
