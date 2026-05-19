import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App.tsx';
import { useRoute } from './state/useRoute.ts';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

/**
 * Production-only wrapper: derives the slug from window.location.pathname
 * (and replaces / with a fresh slug). Tests render <App slug="…" /> directly
 * so jsdom's URL state doesn't leak into the test fixtures.
 *
 * Inline glue — too small to warrant its own file. The react-refresh rule
 * disagrees but it's an entry-point HMR concern only.
 */
// eslint-disable-next-line react-refresh/only-export-components -- entry-point glue, not a HMR boundary
function Routed() {
  const { slug } = useRoute();
  return <App slug={slug} />;
}

createRoot(rootElement).render(
  <StrictMode>
    <Routed />
  </StrictMode>,
);
