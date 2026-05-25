import { test, expect } from '@playwright/test';
import { gotoFreshBoard } from './helpers';

const DEBOUNCE_BUFFER_MS = 400;

const E2E_TEXT_ADD = 'E2E spec — add';
const E2E_TEXT_RECOLOR = 'E2E spec — recolor';
const E2E_TEXT_DELETE = 'E2E spec — delete';

test('workflow 01 — add a card, type, Enter, reload still shows it', async ({
  page,
}) => {
  await gotoFreshBoard(page);
  const beforeCount = await page
    .locator('[data-testid="card-slot"]')
    .count();

  await page.locator('[data-testid="cell-0-5"]').click();
  await expect(page.locator('[data-testid="edit-popover"]')).toBeVisible();

  const input = page.locator('[data-testid="edit-popover-input"]');
  await expect(input).toBeFocused();
  await input.type(E2E_TEXT_ADD);
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_ADD }),
  ).toHaveCount(1);
  await input.press('Enter');
  await expect(page.locator('[data-testid="edit-popover"]')).toBeHidden();

  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  await page.reload();
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_ADD }),
  ).toHaveCount(1);
  await expect(page.locator('[data-testid="card-slot"]')).toHaveCount(
    beforeCount + 1,
  );
});

test('workflow 04 — recolor an existing card to coral, reload still coral', async ({
  page,
}) => {
  await gotoFreshBoard(page);

  await page.locator('[data-testid="cell-0-6"]').click();
  await page
    .locator('[data-testid="edit-popover-input"]')
    .type(E2E_TEXT_RECOLOR);
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  const ours = page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: E2E_TEXT_RECOLOR }),
  });
  await expect(ours).toHaveCount(1);
  await ours.click();
  await expect(page.locator('[data-testid="edit-popover"]')).toBeVisible();

  await page.locator('[data-testid="swatch-coral"]').click();
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_RECOLOR }),
  ).toHaveCSS('background-color', 'rgb(242, 107, 134)');

  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  await page.reload();
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_RECOLOR }),
  ).toHaveCSS('background-color', 'rgb(242, 107, 134)');
});

test('workflow 04 — Delete removes the card and persists across reload', async ({
  page,
}) => {
  await gotoFreshBoard(page);

  await page.locator('[data-testid="cell-0-5"]').click();
  await page
    .locator('[data-testid="edit-popover-input"]')
    .type(E2E_TEXT_DELETE);
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  const slot = page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: E2E_TEXT_DELETE }),
  });
  await expect(slot).toHaveCount(1);
  await slot.click();
  await page.locator('[data-testid="edit-popover-delete"]').click();
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_DELETE }),
  ).toHaveCount(0);
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  await page.reload();
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_DELETE }),
  ).toHaveCount(0);
});
