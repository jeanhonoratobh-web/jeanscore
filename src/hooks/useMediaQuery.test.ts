/**
 * Unit tests for `useMediaQuery` and `useReducedMotion`
 * (Requirement 30.7 for reduced motion).
 *
 * jsdom does not implement `window.matchMedia`, so a small controllable mock
 * stands in for it, letting tests flip the match state and emit `change`
 * events to verify the hook subscribes and cleans up.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useMediaQuery } from './useMediaQuery';
import { useReducedMotion } from './useReducedMotion';

/** A single fake MediaQueryList whose match state can be toggled by tests. */
interface FakeMediaQueryList {
  matches: boolean;
  readonly media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  /** Emit a `change` event to all registered listeners. */
  emit(matches: boolean): void;
}

const registry = new Map<string, FakeMediaQueryList>();

/** Retrieves the fake list for `query`, failing loudly if it was never created. */
function getMql(query: string): FakeMediaQueryList {
  const mql = registry.get(query);
  if (!mql) {
    throw new Error(`No fake MediaQueryList registered for "${query}"`);
  }
  return mql;
}

/** Installs a controllable `window.matchMedia` and clears any prior registry. */
function installMatchMedia(): void {
  registry.clear();
  vi.stubGlobal('matchMedia', (query: string): FakeMediaQueryList => {
    const existing = registry.get(query);
    if (existing) {
      return existing;
    }
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mql: FakeMediaQueryList = {
      matches: false,
      media: query,
      addEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
        listeners.add(cb);
      }),
      removeEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
        listeners.delete(cb);
      }),
      emit(matches: boolean) {
        mql.matches = matches;
        for (const cb of listeners) {
          cb({ matches } as MediaQueryListEvent);
        }
      },
    };
    registry.set(query, mql);
    return mql;
  });
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    installMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reflects the initial match state', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates when the media query emits a change', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    act(() => {
      getMql('(min-width: 768px)').emit(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      getMql('(min-width: 768px)').emit(false);
    });
    expect(result.current).toBe(false);
  });

  it('removes its listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    const mql = getMql('(min-width: 768px)');
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });
});

describe('useReducedMotion', () => {
  beforeEach(() => {
    installMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tracks the prefers-reduced-motion: reduce query (Requirement 30.7)', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      getMql('(prefers-reduced-motion: reduce)').emit(true);
    });
    expect(result.current).toBe(true);
  });
});
