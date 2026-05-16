import { useEffect, useState } from 'react';
import { Board } from './ui/Board';
import { FONTS, SURFACE } from './ui/tokens';
import {
  DEMO_SLUG,
  LocalStorageRepository,
} from './persistence/localStorage';
import type { Board as BoardModel } from './domain/types';
import type { BoardRepository } from './persistence/repository';

const repository: BoardRepository = new LocalStorageRepository();

export function App() {
  const [board, setBoard] = useState<BoardModel | null>(null);

  useEffect(() => {
    void repository.load(DEMO_SLUG).then(setBoard);
  }, []);

  return (
    <main
      data-testid="page"
      style={{
        flex: 1,
        minHeight: '100vh',
        background: SURFACE.page,
        padding: '24px 28px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: '#d8c8a8',
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          <span style={{ opacity: 0.7 }}>scheduleboard.app / </span>
          <span style={{ fontFamily: FONTS.mono }}>{DEMO_SLUG}</span>
        </div>
        {/* Toolbar lands in Phase 6 — left as a placeholder so the page reserves
            its hero-layout chrome row. */}
        <div data-testid="toolbar-placeholder" aria-hidden style={{ width: 1, height: 36 }} />
      </header>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        {board && <Board board={board} />}
      </div>
    </main>
  );
}
