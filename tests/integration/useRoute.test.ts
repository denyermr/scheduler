import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRoute } from '../../src/state/useRoute';

function setPath(path: string): void {
  window.history.replaceState({}, '', path);
}

beforeEach(() => {
  setPath('/');
});

afterEach(() => {
  cleanup();
});

describe('useRoute (Phase 7.5)', () => {
  it('parses /b/<slug> as board mode', () => {
    setPath('/b/oak-thread-helmet-tractor-7421');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({
      mode: 'board',
      slug: 'oak-thread-helmet-tractor-7421',
    });
  });

  it('parses legacy / permissive slugs ([a-z0-9-]+) as board mode', () => {
    setPath('/b/oak-thread-942');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ mode: 'board', slug: 'oak-thread-942' });
  });

  it('on /, returns splash mode and does not change the URL', () => {
    setPath('/');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ mode: 'splash' });
    expect(window.location.pathname).toBe('/');
  });

  it('on an unknown path, normalizes to / and returns splash mode', () => {
    setPath('/foo');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ mode: 'splash' });
    expect(window.location.pathname).toBe('/');
  });

  it('on malformed /b/<slug> with uppercase or symbols, normalizes to / and returns splash', () => {
    setPath('/b/UPPER_CASE_BAD');
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ mode: 'splash' });
    expect(window.location.pathname).toBe('/');
  });

  it('the same hook instance keeps its route across re-renders (no thrashing)', () => {
    setPath('/b/stable-slug-name-here-0001');
    const hook = renderHook(() => useRoute());
    const first = hook.result.current;
    hook.rerender();
    const second = hook.result.current;
    expect(first).toBe(second);
  });
});
