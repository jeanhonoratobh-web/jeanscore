/**
 * Unit tests for `useDebounce` (Requirement 13.1).
 *
 * Fake timers verify that the debounced value trails the live value by the
 * configured delay and that rapid changes restart the timer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 300));
    expect(result.current).toBe('a');
  });

  it('adopts the new value only after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('b');
  });

  it('restarts the timer on each change so only the last value lands', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 400ms total elapsed, but only 200ms since the last change.
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('abc');
  });
});
