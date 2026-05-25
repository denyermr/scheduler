import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppShell } from '../../src/AppShell';
import { deriveKey, randomSalt } from '../../src/persistence/crypto';
import { cacheCryptoContext } from '../../src/persistence/keyCache';
import {
  RemoteRepository,
  type CryptoContext,
} from '../../src/persistence/remote';
import { startServer, type ServerHandle } from '../../server/server';
import { createBoard } from '../../src/domain/board';

const SITE_PASSWORD = 'shell-test-site-pw';
const TEST_ITERS = 1_000;
let handle: ServerHandle;
let baseUrl: string;

beforeEach(async () => {
  handle = await startServer({
    dbPath: ':memory:',
    port: 0,
    sitePassword: SITE_PASSWORD,
  });
  baseUrl = `http://127.0.0.1:${String(handle.port)}`;
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(async () => {
  await handle.close();
  sessionStorage.clear();
});

function typeInto(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

function repoFactory(crypto?: CryptoContext): RemoteRepository {
  return new RemoteRepository({ baseUrl, crypto });
}

async function makeCrypto(passphrase: string): Promise<CryptoContext> {
  const kdfSalt = randomSalt();
  const key = await deriveKey(passphrase, kdfSalt, TEST_ITERS);
  return { key, kdfSalt, kdfIters: TEST_ITERS };
}

describe('<AppShell /> — splash flow', () => {
  it('with the correct site password, creates a locked board and caches its key', async () => {
    const navigate = vi.fn();
    render(
      <AppShell
        route={{ mode: 'splash' }}
        repoFactory={repoFactory}
        navigate={navigate}
      />,
    );
    typeInto(screen.getByLabelText(/site password/i), SITE_PASSWORD);
    typeInto(screen.getByLabelText(/board password/i), 'my-board-pw');
    fireEvent.click(screen.getByRole('button', { name: /create board/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalled();
    });
    const url = String(navigate.mock.calls[0]?.[0]);
    expect(url).toMatch(/^\/b\/[a-z0-9-]+$/);
    const slug = url.slice('/b/'.length);
    expect(sessionStorage.getItem(`sb:key:${slug}`)).not.toBeNull();
  });

  it('with the WRONG site password, shows an inline error and does not navigate', async () => {
    const navigate = vi.fn();
    render(
      <AppShell
        route={{ mode: 'splash' }}
        repoFactory={repoFactory}
        navigate={navigate}
      />,
    );
    typeInto(screen.getByLabelText(/site password/i), 'wrong-site-pw');
    typeInto(screen.getByLabelText(/board password/i), 'my-board-pw');
    fireEvent.click(screen.getByRole('button', { name: /create board/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/incorrect/i);
    });
    expect(navigate).not.toHaveBeenCalled();
    const keys = Object.keys(sessionStorage).filter((k) =>
      k.startsWith('sb:key:'),
    );
    expect(keys).toHaveLength(0);
  });
});

describe('<AppShell /> — board flow', () => {
  it('renders notFound when the slug does not exist on the server', async () => {
    render(
      <AppShell
        route={{ mode: 'board', slug: 'ghost-slug-9999' }}
        repoFactory={repoFactory}
      />,
    );
    await screen.findByRole('heading', { name: /board not found/i });
  });

  it('renders the unlock prompt when the envelope exists but no key is cached', async () => {
    // Pre-create a locked board on the server
    const crypto = await makeCrypto('the-board-pw');
    const seedRepo = new RemoteRepository({ baseUrl });
    await seedRepo.createLockedBoard(
      'seeded-locked',
      createBoard({ startMonday: '2024-05-27', weeks: 4 }),
      crypto,
      SITE_PASSWORD,
    );

    render(
      <AppShell
        route={{ mode: 'board', slug: 'seeded-locked' }}
        repoFactory={repoFactory}
      />,
    );
    await screen.findByRole('heading', { name: /unlock board/i });
    expect(screen.getByLabelText(/board password/i)).toBeInTheDocument();
  });

  it('with the RIGHT password, decrypts and renders the App; key is cached for reloads', async () => {
    const crypto = await makeCrypto('right-pw');
    const seedRepo = new RemoteRepository({ baseUrl });
    await seedRepo.createLockedBoard(
      'right-pw-slug',
      createBoard({ startMonday: '2024-05-27', weeks: 4 }),
      crypto,
      SITE_PASSWORD,
    );

    render(
      <AppShell
        route={{ mode: 'board', slug: 'right-pw-slug' }}
        repoFactory={repoFactory}
      />,
    );
    await screen.findByRole('heading', { name: /unlock board/i });
    typeInto(screen.getByLabelText(/board password/i), 'right-pw');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    });

    await screen.findByTestId('page');
    expect(sessionStorage.getItem('sb:key:right-pw-slug')).not.toBeNull();
  });

  it('with the WRONG password, shows an inline error and keeps the prompt mounted', async () => {
    const crypto = await makeCrypto('right-pw');
    const seedRepo = new RemoteRepository({ baseUrl });
    await seedRepo.createLockedBoard(
      'wrong-pw-slug',
      createBoard({ startMonday: '2024-05-27', weeks: 4 }),
      crypto,
      SITE_PASSWORD,
    );

    render(
      <AppShell
        route={{ mode: 'board', slug: 'wrong-pw-slug' }}
        repoFactory={repoFactory}
      />,
    );
    await screen.findByRole('heading', { name: /unlock board/i });
    typeInto(screen.getByLabelText(/board password/i), 'wrong-pw');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/wrong password/i);
    });
    // Form still mounted; key not cached
    expect(screen.getByLabelText(/board password/i)).toBeInTheDocument();
    expect(sessionStorage.getItem('sb:key:wrong-pw-slug')).toBeNull();
  });

  it('with a cached key in sessionStorage, skips the unlock prompt entirely', async () => {
    const crypto = await makeCrypto('seed-pw');
    const seedRepo = new RemoteRepository({ baseUrl });
    await seedRepo.createLockedBoard(
      'cached-slug',
      createBoard({ startMonday: '2024-05-27', weeks: 4 }),
      crypto,
      SITE_PASSWORD,
    );
    await cacheCryptoContext('cached-slug', crypto);

    render(
      <AppShell
        route={{ mode: 'board', slug: 'cached-slug' }}
        repoFactory={repoFactory}
      />,
    );
    await screen.findByTestId('page');
    expect(
      screen.queryByRole('heading', { name: /unlock board/i }),
    ).not.toBeInTheDocument();
  });
});
