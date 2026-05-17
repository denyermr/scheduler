import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Board } from './ui/Board';
import {
  FONTS,
  PAGE_BG,
  URL_CHIP_BRIGHT,
  URL_CHIP_DIM,
} from './ui/tokens';
import {
  DEMO_SLUG,
  LocalStorageRepository,
} from './persistence/localStorage';
import type { Board as BoardModel } from './domain/types';
import type { BoardRepository } from './persistence/repository';

const repository: BoardRepository = new LocalStorageRepository();

const DEFAULT_CONTAINER_WIDTH = 1440;

function useContainerWidth(): {
  ref: React.RefObject<HTMLDivElement>;
  width: number;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_CONTAINER_WIDTH);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      setWidth(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return (): void => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return (): void => ro.disconnect();
  }, []);

  return { ref, width };
}

export function App() {
  const [board, setBoard] = useState<BoardModel | null>(null);
  const { ref: stageRef, width: stageWidth } = useContainerWidth();

  useEffect(() => {
    void repository.load(DEMO_SLUG).then(setBoard);
  }, []);

  return (
    <main
      data-testid="page"
      style={{
        flex: 1,
        minHeight: '100vh',
        backgroundImage: PAGE_BG,
        backgroundColor: '#eef0f4',
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
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          <span
            data-testid="url-chip-dim"
            style={{ color: URL_CHIP_DIM, opacity: 0.7 }}
          >
            scheduleboard.app /{' '}
          </span>
          <span
            data-testid="url-chip-bright"
            style={{ fontFamily: FONTS.mono, color: URL_CHIP_BRIGHT }}
          >
            {DEMO_SLUG}
          </span>
        </div>
        {/* Toolbar lands in Phase 6 — placeholder reserves the row height. */}
        <div
          data-testid="toolbar-placeholder"
          aria-hidden
          style={{ width: 1, height: 36 }}
        />
      </header>
      <div
        ref={stageRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        {board && <Board board={board} containerWidth={stageWidth} />}
      </div>
    </main>
  );
}
