import { test, expect } from '@playwright/test';

const DEBOUNCE_BUFFER_MS = 400;

// Phase 3 spec card texts. Chosen to be unique against the demo board so
// selectors stay strict-mode-safe even though the demo seeds on cache miss.
const E2E_TEXT_ADD = 'E2E spec — add';
const E2E_TEXT_RECOLOR = 'E2E spec — recolor';
const E2E_TEXT_DELETE = 'E2E spec — delete';

test.beforeEach(async ({ page }) => {
  // Start each spec from a clean localStorage; the demo fallback will re-seed
  // on the next load, but our spec cards stay unique against it.
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

test('workflow 01 — add a card, type, Enter, reload still shows it', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  const beforeCount = await page
    .locator('[data-testid="card-slot"]')
    .count();

  // Click an empty Saturday cell in week 0 (no demo card lives there).
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

  // Let the 250 ms debounce flush before reloading.
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
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  // Seed a unique card we own end-to-end.
  await page.locator('[data-testid="cell-0-6"]').click();
  await page
    .locator('[data-testid="edit-popover-input"]')
    .type(E2E_TEXT_RECOLOR);
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  // Re-open it and recolor.
  const ours = page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: E2E_TEXT_RECOLOR }),
  });
  await expect(ours).toHaveCount(1);
  await ours.click();
  await expect(page.locator('[data-testid="edit-popover"]')).toBeVisible();

  await page.locator('[data-testid="swatch-coral"]').click();
  // Coral = #F26B86 → rgb(242, 107, 134).
  await expect(
    page.locator('[data-testid="card"]', { hasText: E2E_TEXT_RECOLOR }),
  ).toHaveCSS('background-color', 'rgb(242, 107, 134)');

  // Commit + wait for debounced save.
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
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

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
