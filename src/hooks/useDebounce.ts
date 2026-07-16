/**
 * `useDebounce` — delays propagation of a rapidly changing value.
 *
 * Backs the 300ms debounce applied to search and filter inputs
 * (Requirement 13.1) so downstream work (queries, filtering) only runs once
 * typing settles instead of on every keystroke. The returned value trails the
 * live `value` by `delayMs`; each change restarts the timer, and the pending
 * timer is cleared on unmount or when inputs change so no stale update lands.
 */
import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `value` has
 * stayed unchanged for `delayMs` milliseconds (Requirement 13.1).
 *
 * @typeParam T - The value type.
 * @param value - The live value to debounce.
 * @param delayMs - Quiet period, in milliseconds, before adopting a new value.
 * @returns The most recent `value` that persisted for at least `delayMs`.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}
