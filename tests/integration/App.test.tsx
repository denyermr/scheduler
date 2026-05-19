import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/App';
import { buildDemoBoard } from '../../src/persistence/demoBoard';
import { InMemoryRepository } from '../../src/persistence/memory';
import { URL_CHIP_BRIGHT, URL_CHIP_DIM } from '../../src/ui/tokens';

// Phase 7: <App /> defaults to RemoteRepository, which needs a real backend.
// These tests inject an InMemoryRepository with a seeded board so they remain
// component-level (the network layer is covered by RemoteRepository tests).
function renderWithRepo() {
  const board = buildDemoBoard();
  const repo = new InMemoryRepository([['demo-board', board]]);
  return render(<App repository={repo} slug="demo-board" />);
}

describe('<App /> page chrome (Amendment B)', () => {
  it('paints the soft cool off-white page background — not the v1 dark brown', () => {
    renderWithRepo();
    const page = screen.getByTestId('page');
    const inline = page.getAttribute('style') ?? '';
    // Set as `background-image` so jsdom preserves the multi-gradient stack.
    expect(inline).toContain('linear-gradient(180deg, #eef0f4 0%, #e1e4ec 100%)');
    expect(inline).toContain('background-color: rgb(238, 240, 244)');
    expect(inline).not.toContain('#3a2410');
    expect(inline).not.toContain('rgb(58, 36, 16)');
  });

  it('renders the URL chip in the new cool-grey colors', () => {
    renderWithRepo();
    const dim = screen.getByTestId('url-chip-dim');
    const bright = screen.getByTestId('url-chip-bright');
    expect(dim.style.color.toLowerCase()).toBe('rgb(122, 130, 149)'); // #7a8295
    expect(bright.style.color.toLowerCase()).toBe('rgb(42, 49, 66)'); // #2a3142
    expect(URL_CHIP_DIM).toBe('#7a8295');
    expect(URL_CHIP_BRIGHT).toBe('#2a3142');
  });

  it('eventually renders the demo board', async () => {
    renderWithRepo();
    await waitFor(() =>
      expect(screen.getByTestId('board-surface')).toBeInTheDocument(),
    );
  });
});
