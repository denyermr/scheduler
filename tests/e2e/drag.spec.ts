import { test, expect, type Locator, type Page } from '@playwright/test';

const DEBOUNCE_BUFFER_MS = 400;
const PRESS_HOLD_BUFFER_MS = 200;

const E2E_TEXT_DRAG = 'E2E spec — drag';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no boundingBox for locator');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pressHoldDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Hold past DRAG_LIFT_MS so the state machine enters "lifted".
  await page.waitForTimeout(PRESS_HOLD_BUFFER_MS);
  // Multi-step move so the lift state sees pointer-move updates en route.
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test('workflow 02 — drag a card to a new cell, reload, persists at the new cell', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  // Seed our own card so we can identify it deterministically.
  await page.locator('[data-testid="cell-0-5"]').click();
  await page
    .locator('[data-testid="edit-popover-input"]')
    .type(E2E_TEXT_DRAG);
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  const ourCard = page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: E2E_TEXT_DRAG }),
  });
  await expect(ourCard).toHaveCount(1);

  // Drag to (week 2, day 4) — an empty Friday two weeks down.
  const target = page.locator('[data-testid="cell-2-4"]');
  const from = await centerOf(ourCard);
  const to = await centerOf(target);
  await pressHoldDrag(page, from, to);

  // After the drop, the card should sit inside (or visually within) cell 2-4.
  // The simplest assertion: bounding box of our card overlaps the target cell.
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);
  const movedBox = await ourCard.boundingBox();
  const targetBox = await target.boundingBox();
  if (!movedBox || !targetBox) throw new Error('no bounding box');
  expect(movedBox.x + movedBox.width / 2).toBeGreaterThanOrEqual(targetBox.x);
  expect(movedBox.x + movedBox.width / 2).toBeLessThanOrEqual(
    targetBox.x + targetBox.width,
  );
  expect(movedBox.y + movedBox.height / 2).toBeGreaterThanOrEqual(targetBox.y);
  expect(movedBox.y + movedBox.height / 2).toBeLessThanOrEqual(
    targetBox.y + targetBox.height,
  );

  // Reload — the new position survives.
  await page.reload();
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  const survivor = page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: E2E_TEXT_DRAG }),
  });
  await expect(survivor).toHaveCount(1);
  const reloadBox = await survivor.boundingBox();
  if (!reloadBox) throw new Error('no bounding box after reload');
  // Same target cell after reload.
  expect(reloadBox.x + reloadBox.width / 2).toBeGreaterThanOrEqual(
    targetBox.x,
  );
  expect(reloadBox.x + reloadBox.width / 2).toBeLessThanOrEqual(
    targetBox.x + targetBox.width,
  );
});

test('a stacked cell shows multiple cards with deterministic offsets visible', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();

  // The demo board seeds 3 cards at (4, 2) — exercises the §4 offset formula
  // for n = 3: offsets[0] = (+4, +3), [1] = (-7, -5.5), [2] = (+10, +8).
  const cell = page.locator('[data-testid="cell-4-2"]');
  const cellBox = await cell.boundingBox();
  if (!cellBox) throw new Error('cell has no bounding box');

  const cellRectArg = {
    x: cellBox.x,
    y: cellBox.y,
    width: cellBox.width,
    height: cellBox.height,
  };

  const centres = await page
    .locator('[data-testid="card-slot"]')
    .evaluateAll(
      (
        els: HTMLElement[],
        cb: { x: number; y: number; width: number; height: number },
      ) =>
        els
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })
          .filter((p) => {
            // Belong to (4, 2) if the slot's centre falls inside the cell's box.
            return (
              p.x >= cb.x &&
              p.x <= cb.x + cb.width &&
              p.y >= cb.y &&
              p.y <= cb.y + cb.height
            );
          }),
      cellRectArg,
    );

  expect(centres).toHaveLength(3);

  // §4 formula at n = 3 produces alternating-sign offsets — verify both
  // positive and negative are present along both axes.
  const cellCentreX = cellBox.x + cellBox.width / 2;
  const cellCentreY = cellBox.y + cellBox.height / 2;
  const xOffsets = centres.map((p) => p.x - cellCentreX);
  const yOffsets = centres.map((p) => p.y - cellCentreY);
  expect(xOffsets.some((dx) => dx > 0)).toBeTruthy();
  expect(xOffsets.some((dx) => dx < 0)).toBeTruthy();
  expect(yOffsets.some((dy) => dy > 0)).toBeTruthy();
  expect(yOffsets.some((dy) => dy < 0)).toBeTruthy();
  // Centres are pairwise distinct.
  const uniq = new Set(centres.map((p) => `${String(p.x)}:${String(p.y)}`));
  expect(uniq.size).toBe(3);
});
