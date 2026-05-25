import { useState } from 'react';

/** Permissive shape: any URL-safe lowercase slug works (forward-compat for
 *  legacy 2-word slugs, hand-typed shorthand, future formats). The four-word
 *  shape is enforced only by the *generator*, not the router. */
const SLUG_RE = /^[a-z0-9-]+$/;

const PREFIX = '/b/';

export type Route =
  | { mode: 'splash' }
  | { mode: 'board'; slug: string };

/**
 * Read the current URL and classify it as either splash (`/`) or board
 * (`/b/<valid-slug>`). Any other path is redirected to `/` via
 * `replaceState` so the URL bar stays clean for the splash.
 *
 * Resolved synchronously in `useState`'s initializer so the first render
 * already has the right mode — no flash. No popstate subscription:
 * back/forward between routes is a full page reload by design (phase 7.5
 * doesn't offer in-app navigation between boards).
 */
export function useRoute(): Route {
  const [route] = useState<Route>(() => resolve());
  return route;
}

function resolve(): Route {
  const path = window.location.pathname;
  if (path.startsWith(PREFIX)) {
    const cleaned = path.slice(PREFIX.length).replace(/\/$/, '');
    if (cleaned.length > 0 && SLUG_RE.test(cleaned)) {
      return { mode: 'board', slug: cleaned };
    }
  }
  // Anything else: splash. Normalize the URL to `/` for cleanliness.
  if (path !== '/') {
    window.history.replaceState({}, '', '/');
  }
  return { mode: 'splash' };
}
