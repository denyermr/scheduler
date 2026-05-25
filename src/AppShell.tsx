import { useEffect, useMemo, useState } from 'react';
import { App } from './App';
import { createBoard } from './domain/board';
import {
  KDF_ITERS_DEFAULT,
  decryptEnvelope,
  deriveKey,
  randomSalt,
} from './persistence/crypto';
import { type LockedEnvelope, isLocked } from './persistence/envelope';
import {
  cacheCryptoContext,
  readCachedCryptoContext,
} from './persistence/keyCache';
import { type CryptoContext, RemoteRepository } from './persistence/remote';
import { generateSlug } from './persistence/slug';
import { type Route, useRoute } from './state/useRoute';
import { SplashScreen } from './ui/SplashScreen';
import { UnlockScreen } from './ui/UnlockScreen';

/**
 * The top-level orchestrator for Phase 7.5. Routes between:
 *   - `/`         → splash (create a new locked board)
 *   - `/b/<slug>` → either unlock prompt or the board itself, depending on
 *                   whether the session has a cached key for this slug
 *
 * Production entry point. Tests can pass a `repoFactory` override to drive
 * the host components against InMemory or recorded-network repositories.
 */
export type AppShellProps = {
  route?: Route;
  repoFactory?: (crypto?: CryptoContext) => RemoteRepository;
  /** Override for tests — jsdom won't let us spy on `window.location.assign`. */
  navigate?: (url: string) => void;
};

const defaultRepoFactory = (crypto?: CryptoContext): RemoteRepository =>
  new RemoteRepository({ baseUrl: '', crypto });

const defaultNavigate = (url: string): void => {
  window.location.assign(url);
};

export function AppShell({
  route: routeProp,
  repoFactory = defaultRepoFactory,
  navigate = defaultNavigate,
}: AppShellProps = {}) {
  const detected = useRoute();
  const route = routeProp ?? detected;

  if (route.mode === 'splash') {
    return <SplashHost repoFactory={repoFactory} navigate={navigate} />;
  }
  return <BoardHost slug={route.slug} repoFactory={repoFactory} />;
}

type SplashHostProps = {
  repoFactory: (crypto?: CryptoContext) => RemoteRepository;
  navigate: (url: string) => void;
};

function SplashHost({ repoFactory, navigate }: SplashHostProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(sitePw: string, boardPw: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const slug = generateSlug();
      const kdfSalt = randomSalt();
      const kdfIters = KDF_ITERS_DEFAULT;
      const key = await deriveKey(boardPw, kdfSalt, kdfIters);
      const ctx: CryptoContext = { key, kdfSalt, kdfIters };
      const repo = repoFactory();
      const initialBoard = createBoard({
        startMonday: '2024-05-27',
        weeks: 26,
      });
      const result = await repo.createLockedBoard(
        slug,
        initialBoard,
        ctx,
        sitePw,
      );
      if (result === 'unauthorized') {
        setError('Site password incorrect.');
        setBusy(false);
        return;
      }
      if (result === 'error') {
        setError('Failed to create board. Try again.');
        setBusy(false);
        return;
      }
      await cacheCryptoContext(slug, ctx);
      navigate(`/b/${slug}`);
    } catch {
      setError('Unexpected error. Try again.');
      setBusy(false);
    }
  }

  return <SplashScreen onSubmit={onSubmit} busy={busy} error={error} />;
}

type BoardHostState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'unlock'; envelope: LockedEnvelope }
  | { kind: 'ready'; crypto: CryptoContext };

type BoardHostProps = {
  slug: string;
  repoFactory: (crypto?: CryptoContext) => RemoteRepository;
};

function BoardHost({ slug, repoFactory }: BoardHostProps) {
  const [state, setState] = useState<BoardHostState>({ kind: 'loading' });
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await readCachedCryptoContext(slug);
      if (cancelled) return;
      if (cached !== null) {
        setState({ kind: 'ready', crypto: cached });
        return;
      }
      const repo = repoFactory();
      let envelope: Awaited<ReturnType<typeof repo.loadEnvelope>>;
      try {
        envelope = await repo.loadEnvelope(slug);
      } catch {
        if (!cancelled) setState({ kind: 'notFound' });
        return;
      }
      if (cancelled) return;
      if (envelope === null || !isLocked(envelope)) {
        setState({ kind: 'notFound' });
        return;
      }
      setState({ kind: 'unlock', envelope });
    })();
    return (): void => {
      cancelled = true;
    };
  }, [slug, repoFactory]);

  const readyRepo = useMemo(() => {
    if (state.kind !== 'ready') return null;
    return repoFactory(state.crypto);
  }, [state, repoFactory]);

  if (state.kind === 'loading') {
    return null;
  }
  if (state.kind === 'notFound') {
    return <UnlockScreen slug={slug} onSubmit={() => undefined} notFound />;
  }
  if (state.kind === 'unlock') {
    const envelope = state.envelope;
    const onUnlock = async (pw: string): Promise<void> => {
      setUnlockBusy(true);
      setUnlockError(null);
      try {
        const key = await deriveKey(
          pw,
          envelope.kdfSalt,
          envelope.kdfIters,
        );
        const decrypted = await decryptEnvelope(
          { ciphertext: envelope.ciphertext, iv: envelope.iv },
          key,
        );
        if (decrypted === null) {
          setUnlockError('Wrong password.');
          setUnlockBusy(false);
          return;
        }
        const ctx: CryptoContext = {
          key,
          kdfSalt: envelope.kdfSalt,
          kdfIters: envelope.kdfIters,
        };
        await cacheCryptoContext(slug, ctx);
        setState({ kind: 'ready', crypto: ctx });
        setUnlockBusy(false);
      } catch {
        setUnlockError('Unexpected error.');
        setUnlockBusy(false);
      }
    };
    return (
      <UnlockScreen
        slug={slug}
        onSubmit={onUnlock}
        busy={unlockBusy}
        error={unlockError}
      />
    );
  }
  // ready
  if (readyRepo === null) return null;
  return <App slug={slug} repository={readyRepo} />;
}
