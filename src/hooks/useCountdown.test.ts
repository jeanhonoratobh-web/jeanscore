/**
 * Unit tests for `useCountdown` (Requirements 11.7, 11.8).
 *
 * Uses fake timers so the per-second interval is deterministic, and asserts the
 * pure `computeCountdown` breakdown plus interval cleanup on unmount.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCountdown, computeCountdown } from './useCountdown';

describe('computeCountdown', () => {
  it('breaks remaining seconds into days/hours/minutes/seconds', () => {
    const nowMs = 0;
    // 1 day + 2 hours + 3 minutes + 4 seconds.
    const targetTs = 24 * 3600 + 2 * 3600 + 3 * 60 + 4;
    expect(computeCountdown(targetTs, nowMs)).toEqual({
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
      isComplete: false,
    });
  });

  it('reports all-zero and isComplete when the target is now or past', () => {
    expect(computeCountdown(100, 100 * 1000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    });
    expect(computeCountdown(100, 500 * 1000).isComplete).toBe(true);
  });
});

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the initial remaining time toward the target', () => {
    const { result } = renderHook(() => useCountdown(65));
    expect(result.current).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 5,
      isComplete: false,
    });
  });

  it('ticks down every second', () => {
    const { result } = renderHook(() => useCountdown(10));
    expect(result.current.seconds).toBe(10);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.seconds).toBe(7);
  });

  it('reaches isComplete when the target passes and stays at zero', () => {
    const { result } = renderHook(() => useCountdown(2));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isComplete).toBe(true);
    expect(result.current.seconds).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    });
  });

  it('clears the interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useCountdown(60));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
