import { test, expect } from '@playwright/test';
import { E2E_SITE_PASSWORD, gotoFreshBoard } from './helpers';

test.describe('Phase 7.5 — splash + unlock', () => {
  test('splash with correct passwords creates a board and lands on /b/<slug>', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /schedule board/i })).toBeVisible();
    await page.getByLabel(/site password/i).fill(E2E_SITE_PASSWORD);
    await page.getByLabel(/board password/i).fill('e2e-board-pw');
    await page.getByRole('button', { name: /create board/i }).click();
    await page.waitForURL(/\/b\/[a-z0-9-]+/);
    await expect(page.locator('[data-testid="board-surface"]')).toBeVisible();
  });

  test('splash with WRONG site password shows error, no navigation', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel(/site password/i).fill('definitely-wrong');
    await page.getByLabel(/board password/i).fill('any-board-pw');
    await page.getByRole('button', { name: /create board/i }).click();
    await expect(page.getByRole('alert')).toHaveText(/incorrect/i);
    await expect(page).toHaveURL(/\/$/);
  });

  test('opening a board in a fresh context requires the board password', async ({
    page,
    browser,
  }) => {
    // 1. First context: create board, capture URL + password
    const { slug, boardPassword } = await gotoFreshBoard(page, 'sharing-test-pw');
    const boardUrl = page.url();
    // Drop a card so the unlock has something distinguishable to render.
    await page.locator('[data-testid="cell-0-3"]').click();
    await page.locator('[data-testid="edit-popover-input"]').type('SECRET');
    await page.locator('[data-testid="edit-popover-input"]').press('Enter');
    await page.waitForTimeout(500);

    // 2. Second context = totally fresh sessionStorage
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(boardUrl);

    // Unlock prompt appears, board is NOT visible yet
    await expect(
      page2.getByRole('heading', { name: /unlock board/i }),
    ).toBeVisible();
    await expect(page2.getByText(`/b/${slug}`)).toBeVisible();
    await expect(page2.locator('[data-testid="board-surface"]')).toHaveCount(0);

    // Wrong password is rejected
    await page2.getByLabel(/board password/i).fill('totally-wrong-pw');
    await page2.getByRole('button', { name: /unlock/i }).click();
    await expect(page2.getByRole('alert')).toHaveText(/wrong password/i);
    await expect(page2.locator('[data-testid="board-surface"]')).toHaveCount(0);

    // Right password unlocks and shows the seeded SECRET card
    await page2.getByLabel(/board password/i).fill(boardPassword);
    await page2.getByRole('button', { name: /unlock/i }).click();
    await expect(page2.locator('[data-testid="board-surface"]')).toBeVisible();
    await expect(
      page2.locator('[data-testid="card"]', { hasText: 'SECRET' }),
    ).toHaveCount(1);

    await ctx2.close();
  });

  test('visiting a slug that does not exist shows "Board not found"', async ({
    page,
  }) => {
    await page.goto('/b/this-slug-was-never-created-9999');
    await expect(
      page.getByRole('heading', { name: /board not found/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /create a new board/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('network payload of a save never contains plaintext card text', async ({
    page,
  }) => {
    await gotoFreshBoard(page, 'no-leak-test-pw');
    const seenBodies: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes('/b/')) {
        const body = req.postData();
        if (body !== null) seenBodies.push(body);
      }
    });

    // Add a card with distinctive plaintext.
    const plaintext = 'XYZZY-PLAINTEXT-LEAK-CANARY';
    await page.locator('[data-testid="cell-0-2"]').click();
    await page.locator('[data-testid="edit-popover-input"]').type(plaintext);
    await page.locator('[data-testid="edit-popover-input"]').press('Enter');
    await page.waitForTimeout(500);

    expect(seenBodies.length).toBeGreaterThan(0);
    for (const body of seenBodies) {
      expect(body).not.toContain(plaintext);
      expect(body).toContain('"locked":true');
      expect(body).toContain('"ciphertext"');
    }
  });
});
