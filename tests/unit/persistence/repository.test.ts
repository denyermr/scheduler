import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../../../src/persistence/memory';
import { LocalStorageRepository } from '../../../src/persistence/localStorage';
import { createBoard } from '../../../src/domain/board';
import { buildDemoBoard, DEMO_SLUG } from '../../../src/persistence/demoBoard';

describe('InMemoryRepository', () => {
  it('returns null for unknown slugs', async () => {
    const repo = new InMemoryRepository();
    await expect(repo.load('missing')).resolves.toBeNull();
  });

  it('returns boards seeded at construction', async () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const repo = new InMemoryRepository([['seeded', board]]);
    await expect(repo.load('seeded')).resolves.toBe(board);
  });

  it('returns boards set after construction', async () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const repo = new InMemoryRepository();
    repo.set('later', board);
    await expect(repo.load('later')).resolves.toBe(board);
  });
});

describe('LocalStorageRepository (Phase 2 stub)', () => {
  it('returns the demo board for any slug', async () => {
    const repo = new LocalStorageRepository();
    const a = await repo.load(DEMO_SLUG);
    const b = await repo.load('whatever');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.weeks).toBe(26);
    expect(a!.cards.length).toBe(54);
    expect(a!.threads.length).toBe(4);
  });

  it('produces stable card IDs across loads (deterministic)', async () => {
    const a = buildDemoBoard();
    const b = buildDemoBoard();
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
    expect(a.cards.map((c) => c.rotation)).toEqual(
      b.cards.map((c) => c.rotation),
    );
    expect(a.cards.map((c) => c.pin)).toEqual(b.cards.map((c) => c.pin));
  });

  it("uses CARD IDs (not array indices) for the demo threads — invariant 10", async () => {
    const board = buildDemoBoard();
    const cardIds = new Set(board.cards.map((c) => c.id));
    for (const t of board.threads) {
      expect(cardIds.has(t.fromCardId)).toBe(true);
      expect(cardIds.has(t.toCardId)).toBe(true);
      expect(t.fromCardId).toMatch(/^card_/);
      expect(t.toCardId).toMatch(/^card_/);
    }
  });
});
