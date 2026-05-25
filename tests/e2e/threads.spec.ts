import { test, expect, type Locator, type Page } from '@playwright/test';
import { gotoFreshBoard } from './helpers';

const DEBOUNCE_BUFFER_MS = 400;
const FLASH_BUFFER_MS = 250;

const E2E_SRC_TEXT = 'E2E thread src';
const E2E_TGT_TEXT = 'E2E thread tgt';

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no boundingBox for locator');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function seedCardAtCell(
  page: Page,
  week: number,
  day: number,
  text: string,
): Promise<Locator> {
  await page.locator(`[data-testid="cell-${String(week)}-${String(day)}"]`).click();
  await page.locator('[data-testid="edit-popover-input"]').type(text);
  await page.locator('[data-testid="edit-popover-input"]').press('Enter');
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);
  return page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: text }),
  });
}

test('workflow 03 — drag from card handle to another card creates a thread; reload persists; click deletes', async ({
  page,
}) => {
  await gotoFreshBoard(page);

  // Phase 7 scrapped the demo seed; a fresh board has zero threads.
  const baseline = await page.locator('[data-testid="thread-path"]').count();

  // Seed two cards at empty cells well away from demo data. We pick different
  // rows AND non-adjacent columns so the seeded cards' bounding boxes never
  // overlap each other or a demo card, even at the largest cellW.
  const src = await seedCardAtCell(page, 0, 2, E2E_SRC_TEXT);
  const tgt = await seedCardAtCell(page, 3, 5, E2E_TGT_TEXT);

  // Hover the source card to reveal the thread handle.
  await src.hover();
  const handle = page.locator(
    `[data-testid="thread-handle"][data-card-id="${
      (await src.getAttribute('data-card-id')) ?? ''
    }"]`,
  );
  await expect(handle).toBeVisible();

  // Press-drag from the handle to the target card.
  const handleCentre = await centerOf(handle);
  const tgtCentre = await centerOf(tgt);
  await page.mouse.move(handleCentre.x, handleCentre.y);
  await page.mouse.down();
  // First move opens the drawing arm (dashed in-progress path).
  await page.mouse.move(handleCentre.x + 20, handleCentre.y + 10);
  await expect(page.locator('[data-testid="thread-drawing-path"]')).toBeVisible();
  // Land over the target card.
  await page.mouse.move(tgtCentre.x, tgtCentre.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(DEBOUNCE_BUFFER_MS);

  // A new thread now exists.
  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(
    baseline + 1,
  );
  await expect(page.locator('[data-testid="thread-drawing-path"]')).toHaveCount(0);

  // Reload — the new thread survives.
  await page.reload();
  await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(
    baseline + 1,
  );

  // Find the new thread's hit-path by inspecting the SVG paths and picking
  // the one whose endpoints are nearest the two seeded card centres. The
  // baseline threads are between demo cards far from (0, 4)/(0, 5), so the
  // shortest thread is ours.
  const surviveSrc = page.locator('[data-testid="card-slot"]').filter({
    has: page.locator('[data-testid="card"]', { hasText: E2E_SRC_TEXT }),
  });
  const surviveSrcId = await surviveSrc.getAttribute('data-card-id');
  // Click the hit-path of our thread. The hit element shares its data-thread-id
  // with the visible path; we read the new thread id from the DOM by inspecting
  // each path's d-attribute endpoints.
  const newThreadId: string | null = await page.evaluate(
    ({ srcId }: { srcId: string | null }) => {
      if (!srcId) return null;
      const cardEl = document.querySelector(
        `[data-card-id="${srcId}"]`,
      ) as HTMLElement | null;
      if (!cardEl) return null;
      const r = cardEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const paths = Array.from(
        document.querySelectorAll(
          'path[data-testid="thread-path"][data-thread-id]',
        ),
      );
      let best: string | null = null;
      let bestDist = Infinity;
      for (const p of paths) {
        const d = p.getAttribute('d') ?? '';
        const m = /^M\s+([-\d.]+)\s+([-\d.]+)\s+Q/.exec(d);
        if (!m) continue;
        const x1 = Number(m[1]);
        const y1 = Number(m[2]);
        const dist = Math.hypot(x1 - cx, y1 - cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = p.getAttribute('data-thread-id');
        }
      }
      return best;
    },
    { srcId: surviveSrcId },
  );
  expect(newThreadId).not.toBeNull();

  const hitLocator = page.locator(
    `path[data-testid="thread-hit"][data-thread-id="${newThreadId!}"]`,
  );
  // Hit-paths use SVG `pointer-events: stroke` — only clicks on the rendered
  // stroke fire. The center of the bounding box isn't reliably on the curve,
  // so dispatch the click directly on the element.
  await hitLocator.dispatchEvent('click');
  await page.waitForTimeout(FLASH_BUFFER_MS + DEBOUNCE_BUFFER_MS);

  await expect(page.locator('[data-testid="thread-path"]')).toHaveCount(
    baseline,
  );
});
