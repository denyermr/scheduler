import { useState } from 'react';
import { generateSlug } from '../persistence/slug';

/** Permissive shape: any URL-safe lowercase slug works (forward-compat for
 *  legacy 2-word slugs, hand-typed shorthand, future formats). The four-word
 *  shape is enforced only by the *generator*, not the router. */
const SLUG_RE = /^[a-z0-9-]+$/;

const PREFIX = '/b/';

/**
 * Read the current slug from `window.location.pathname`, generating a fresh
 * one and replacing the URL if the path isn't an existing /b/<slug>.
 *
 * Resolved synchronously in `useState`'s initializer so the first render
 * already has the right slug — no flash of an old / generated URL.
 *
 * No popstate subscription: a Schedule Board session edits a single board.
 * Phase 7 doesn't offer in-app board navigation, so back/forward between
 * boards is a full page reload — exactly the behavior the user expects.
 */
export function useRoute(): { slug: string } {
  const [slug] = useState(() => resolveOrGenerate());
  return { slug };
}

function resolveOrGenerate(): string {
  const path = window.location.pathname;
  if (path.startsWith(PREFIX)) {
    const candidate = path.slice(PREFIX.length);
    // Strip a trailing slash if present, then validate.
    const cleaned = candidate.endsWith('/')
      ? candidate.slice(0, -1)
      : candidate;
    if (cleaned.length > 0 && SLUG_RE.test(cleaned)) {
      return cleaned;
    }
  }
  // Fall through: generate and replaceState so reloads land on the same board.
  const fresh = generateSlug();
  window.history.replaceState({}, '', `${PREFIX}${fresh}`);
  return fresh;
}
