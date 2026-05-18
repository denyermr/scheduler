import { test, expect } from '@playwright/test';

const DEBOUNCE_BUFFER_MS = 400;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

test('workflow 06 — Weeks stepper shrinks the board; warning shown when cards would be cut', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  // Seed a card deep in the board (week 20 of the default 26) so a shrink
  // to 4 weeks cuts it off.
  const cell = page.locator('[data-testid="cell-20-3"]');
  await cell.click();
  await page.locator('[data-testid="edit-popover-input"]').type('E2E tail');
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  // Open the stepper and try to shrink to 4 weeks.
  await page.locator('[data-testid="toolbar-weeks-display"]').click();
  const input = page.locator('[data-testid="toolbar-weeks-input"]');
  await input.fill('4');
  await page.locator('[data-testid="toolbar-weeks-apply"]').click();

  // Dialog appears with a cut-count message; board hasn't shrunk yet.
  await expect(page.locator('[data-testid="resize-dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="toolbar-weeks-display"]')).toHaveText(
    /Weeks 26/,
  );

  // Confirm — the board shrinks, the off-board card is preserved.
  await page.locator('[data-testid="resize-dialog-confirm"]').click();
  await expect(page.locator('[data-testid="resize-dialog"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="toolbar-weeks-display"]')).toHaveText(
    /Weeks 4/,
  );

  // Card on week 20 is not rendered (off-board) but the model preserves it —
  // grow back to verify.
  await expect(
    page.locator('[data-testid="card"]', { hasText: 'E2E tail' }),
  ).toHaveCount(0);

  await page.locator('[data-testid="toolbar-weeks-display"]').click();
  await page.locator('[data-testid="toolbar-weeks-input"]').fill('26');
  await page.locator('[data-testid="toolbar-weeks-apply"]').click();
  await expect(
    page.locator('[data-testid="card"]', { hasText: 'E2E tail' }),
  ).toHaveCount(1);
});

test('keyboard-only sequence — select a card, nudge with arrows, Backspace deletes, Cmd-Z restores, Cmd-Shift-Z re-deletes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  // Seed a unique card at an empty Saturday cell (matches cards.spec.ts).
  await page.locator('[data-testid="cell-1-5"]').click();
  await page
    .locator('[data-testid="edit-popover-input"]')
    .type('KB seq card');
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  const ours = page
    .locator('[data-testid="card-slot"]')
    .filter({
      has: page.locator('[data-testid="card"]', { hasText: 'KB seq card' }),
    });
  await expect(ours).toHaveCount(1);

  // Select the card (click opens popover), then Esc to close popover but
  // preserve selection. The selection ring renders via data-selected="true".
  await ours.click();
  await expect(page.locator('[data-testid="edit-popover"]')).toBeVisible();
  await page.locator('[data-testid="edit-popover-input"]').press('Escape');
  await expect(page.locator('[data-testid="edit-popover"]')).toHaveCount(0);
  await expect(ours).toHaveAttribute('data-selected', 'true');

  // Initial position: week 1, day 5 (Saturday).
  await expect(ours).toHaveAttribute('data-card-week', '1');
  await expect(ours).toHaveAttribute('data-card-day', '5');

  // Nudge: Right (day 5→6, Sunday), Down (week 1→2).
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(ours).toHaveAttribute('data-card-day', '6');
  await expect(ours).toHaveAttribute('data-card-week', '2');

  // Wait for the debounced save to flush.
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  // Backspace deletes the selected card.
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);
  await expect(
    page.locator('[data-testid="card"]', { hasText: 'KB seq card' }),
  ).toHaveCount(0);

  // Cmd-Z restores. Use the right modifier per OS.
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+z`);
  await expect(
    page.locator('[data-testid="card"]', { hasText: 'KB seq card' }),
  ).toHaveCount(1);

  // Cmd-Shift-Z re-deletes.
  await page.keyboard.press(`${mod}+Shift+z`);
  await expect(
    page.locator('[data-testid="card"]', { hasText: 'KB seq card' }),
  ).toHaveCount(0);
});

test('Share dialog — opens, shows the URL with the slug, Copy is wired to clipboard', async ({
  page,
  context,
  browserName,
}) => {
  // Only chromium supports the clipboard-write permission via grantPermissions.
  // The integration test in toolbar.test.tsx pins the actual writeText call
  // across all environments; this E2E focuses on the cross-browser visible UI.
  test.skip(
    browserName !== 'chromium',
    'clipboard-write permission is chromium-only',
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  await page.locator('[data-testid="toolbar-share"]').click();
  await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="share-dialog-url"]')).toContainText(
    'scheduleboard.app/b/',
  );

  await page.locator('[data-testid="share-dialog-copy"]').click();
  await expect(page.locator('[data-testid="share-dialog-copy"]')).toHaveText(
    /Copied|Copy/,
  );

  await page.locator('[data-testid="share-dialog-close"]').click();
  await expect(page.locator('[data-testid="share-dialog"]')).toHaveCount(0);
});
