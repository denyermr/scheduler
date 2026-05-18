import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../../../src/persistence/memory';
import { LocalStorageRepository } from '../../../src/persistence/localStorage';
import { addCard, createBoard } from '../../../src/domain/board';
import { buildDemoBoard, DEMO_SLUG } from '../../../src/persistence/demoBoard';

function makeFakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    key(i: number): string | null {
      return Array.from(map.keys())[i] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

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

  it('save() round-trips through load()', async () => {
    const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const repo = new InMemoryRepository();
    await repo.save('roundtrip', board);
    await expect(repo.load('roundtrip')).resolves.toBe(board);
  });
});

describe('LocalStorageRepository — Phase 3 real persistence', () => {
  it('cache miss falls back to a freshly-seeded demo board', async () => {
    const storage = makeFakeStorage();
    const repo = new LocalStorageRepository(storage);
    const board = await repo.load('any-new-slug');
    expect(board).not.toBeNull();
    expect(board?.cards.length).toBe(57);
  });

  it('save() writes the slug-scoped key sb:board:<slug>', async () => {
    const storage = makeFakeStorage();
    const repo = new LocalStorageRepository(storage);
    const board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    await repo.save('my-slug', board);
    expect(storage.getItem('sb:board:my-slug')).not.toBeNull();
    expect(storage.getItem('sb:board:other-slug')).toBeNull();
  });

  it('round-trips a board through save → load with identical fields', async () => {
    const storage = makeFakeStorage();
    const repo = new LocalStorageRepository(storage);
    let board = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const r = addCard(board, {
      week: 1,
      day: 2,
      color: 'coral',
      text: 'hello',
      newId: () => 'card_x',
      clock: () => 1234,
    });
    board = r.board;
    await repo.save('rt', board);
    const loaded = await repo.load('rt');
    expect(loaded).toEqual(board);
  });

  it('save() to one slug does not pollute another slug', async () => {
    const storage = makeFakeStorage();
    const repo = new LocalStorageRepository(storage);
    const boardA = createBoard({ startMonday: '2024-05-27', weeks: 4 });
    const boardB = createBoard({ startMonday: '2024-05-27', weeks: 10 });
    await repo.save('a', boardA);
    await repo.save('b', boardB);
    const a = await repo.load('a');
    const b = await repo.load('b');
    expect(a?.weeks).toBe(4);
    expect(b?.weeks).toBe(10);
  });

  it('returns the demo board for the canonical demo slug on cache miss', async () => {
    const storage = makeFakeStorage();
    const repo = new LocalStorageRepository(storage);
    const board = await repo.load(DEMO_SLUG);
    expect(board?.cards.length).toBe(57);
    expect(board?.threads.length).toBe(4);
  });

  it('corrupt JSON falls back to the demo board (defensive)', async () => {
    const storage = makeFakeStorage();
    storage.setItem('sb:board:corrupt', '{not-json');
    const repo = new LocalStorageRepository(storage);
    const board = await repo.load('corrupt');
    expect(board?.cards.length).toBe(57);
  });

  it('produces stable card IDs across loads of the demo (deterministic)', () => {
    const a = buildDemoBoard();
    const b = buildDemoBoard();
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
    expect(a.cards.map((c) => c.rotation)).toEqual(
      b.cards.map((c) => c.rotation),
    );
    expect(a.cards.map((c) => c.pin)).toEqual(b.cards.map((c) => c.pin));
  });

  it('uses CARD IDs (not array indices) for the demo threads — invariant 10', () => {
    const board = buildDemoBoard();
    const cardIds = new Set(board.cards.map((c) => c.id));
    for (const t of board.threads) {
      expect(cardIds.has(t.fromCardId)).toBe(true);
      expect(cardIds.has(t.toCardId)).toBe(true);
      expect(t.fromCardId).toMatch(/^card_/);
      expect(t.toCardId).toMatch(/^card_/);
    }
  });

  it('default-fills missing Card.z on legacy Phase-3 loads (one card / cell)', async () => {
    const storage = makeFakeStorage();
    const legacy = {
      startMonday: '2024-05-27',
      weeks: 4,
      cards: [
        {
          id: 'card_legacy_1',
          week: 0,
          day: 0,
          color: 'peach',
          text: 'hi',
          rotation: 0,
          pin: '#d6463a',
          createdAt: 100,
          updatedAt: 100,
        },
      ],
      threads: [],
    };
    storage.setItem('sb:board:legacy', JSON.stringify(legacy));
    const repo = new LocalStorageRepository(storage);
    const board = await repo.load('legacy');
    expect(board?.cards[0]?.z).toBe(0);
  });

  it('default-fills z by createdAt order when a legacy cell has multiple cards', async () => {
    const storage = makeFakeStorage();
    const legacy = {
      startMonday: '2024-05-27',
      weeks: 4,
      cards: [
        // Same (week, day) — intentionally out of createdAt order in the array.
        {
          id: 'card_legacy_b',
          week: 0,
          day: 0,
          color: 'peach',
          text: 'middle',
          rotation: 0,
          pin: '#d6463a',
          createdAt: 200,
          updatedAt: 200,
        },
        {
          id: 'card_legacy_a',
          week: 0,
          day: 0,
          color: 'sky',
          text: 'oldest',
          rotation: 0,
          pin: '#3a7ed6',
          createdAt: 100,
          updatedAt: 100,
        },
        {
          id: 'card_legacy_c',
          week: 0,
          day: 0,
          color: 'mint',
          text: 'newest',
          rotation: 0,
          pin: '#3aa15a',
          createdAt: 300,
          updatedAt: 300,
        },
      ],
      threads: [],
    };
    storage.setItem('sb:board:legacy-stack', JSON.stringify(legacy));
    const repo = new LocalStorageRepository(storage);
    const board = await repo.load('legacy-stack');
    const byId = Object.fromEntries((board?.cards ?? []).map((c) => [c.id, c]));
    expect(byId['card_legacy_a']?.z).toBe(0);
    expect(byId['card_legacy_b']?.z).toBe(1);
    expect(byId['card_legacy_c']?.z).toBe(2);
  });

  it('preserves z when already present (Phase-4+ saves round-trip unchanged)', async () => {
    const storage = makeFakeStorage();
    const native = {
      startMonday: '2024-05-27',
      weeks: 4,
      cards: [
        {
          id: 'card_native_1',
          week: 0,
          day: 0,
          color: 'peach',
          text: 'x',
          rotation: 0,
          pin: '#d6463a',
          createdAt: 100,
          updatedAt: 100,
          z: 7,
        },
      ],
      threads: [],
    };
    storage.setItem('sb:board:native', JSON.stringify(native));
    const repo = new LocalStorageRepository(storage);
    const board = await repo.load('native');
    expect(board?.cards[0]?.z).toBe(7);
  });
});
