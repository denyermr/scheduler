import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRoute } from '../../src/state/useRoute';

const SLUG_SHAPE = /^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{4}$/;
const PERMISSIVE_SHAPE = /^[a-z0-9-]+$/;

function setPath(path: string): void {
  window.history.replaceState({}, '', path);
}

beforeEach(() => {
  setPath('/');
});

afterEach(() => {
  cleanup();
});

describe('useRoute', () => {
  it('parses the slug from /b/<slug>', () => {
    setPath('/b/oak-thread-helmet-tractor-7421');
    const { result } = renderHook(() => useRoute());
    expect(result.current.slug).toBe('oak-thread-helmet-tractor-7421');
  });

  it('parses legacy / forward-compat slugs (the permissive [a-z0-9-]+ shape)', () => {
    setPath('/b/oak-thread-942');
    const { result } = renderHook(() => useRoute());
    expect(result.current.slug).toBe('oak-thread-942');
    expect(result.current.slug).toMatch(PERMISSIVE_SHAPE);
  });

  it('on /, generates a fresh slug and replaces the URL', () => {
    setPath('/');
    const { result } = renderHook(() => useRoute());
    expect(result.current.slug).toMatch(SLUG_SHAPE);
    expect(window.location.pathname).toBe(`/b/${result.current.slug}`);
  });

  it('on an unknown path (e.g. /foo), generates a fresh slug and replaces', () => {
    setPath('/foo');
    const { result } = renderHook(() => useRoute());
    expect(result.current.slug).toMatch(SLUG_SHAPE);
    expect(window.location.pathname).toBe(`/b/${result.current.slug}`);
  });

  it('the same hook instance keeps its slug across re-renders (no thrashing)', () => {
    setPath('/b/stable-slug-name-here-0001');
    const hook = renderHook(() => useRoute());
    const first = hook.result.current.slug;
    hook.rerender();
    const second = hook.result.current.slug;
    expect(first).toBe(second);
  });

  it('rejects malformed /b/<slug> with uppercase or symbols, generates fresh', () => {
    // Anything not matching [a-z0-9-]+ as the second segment is treated as
    // unknown and falls through to generation.
    setPath('/b/UPPER_CASE_BAD');
    const { result } = renderHook(() => useRoute());
    expect(result.current.slug).toMatch(SLUG_SHAPE);
    expect(window.location.pathname).toBe(`/b/${result.current.slug}`);
  });
});
