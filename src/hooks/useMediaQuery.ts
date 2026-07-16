/**
 * `useMediaQuery` — reactive boolean for a CSS media query.
 *
 * Wraps {@link Window.matchMedia} so components can respond to responsive
 * breakpoints and user preferences declaratively. It reports the current match
 * state and subscribes to changes, updating on every match transition and
 * cleaning up its listener on unmount. Guarded for non-browser environments
 * (e.g. SSR / tests without `matchMedia`), where it reports `false`.
 */
import { useEffect, useState } from 'react';

/**
 * Reads the current match state for `query`, tolerating environments without
 * `window.matchMedia` (returns `false`).
 *
 * @param query - A CSS media query string, e.g. `'(min-width: 768px)'`.
 * @returns Whether the query currently matches.
 */
function getMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(query).matches;
}

/**
 * Tracks whether `query` currently matches, re-rendering on every change.
 *
 * @param query - A CSS media query string, e.g. `'(min-width: 768px)'`.
 * @returns `true` while the media query matches, `false` otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => getMatches(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(query);
    // Sync eagerly in case the query changed between render and effect.
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}
