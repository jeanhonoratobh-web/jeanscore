/**
 * Unit tests for `useQuery` (Requirements 1.8, 32.3).
 *
 * Cover the request lifecycle (loading → success), stale-origin signalling via
 * {@link staleResult}, error handling that preserves the previous value, the
 * `refetch` action, re-running when `deps` change, and the `enabled` option.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useQuery, freshResult, staleResult } from './useQuery';

describe('useQuery', () => {
  it('starts loading and resolves fresh data on mount', async () => {
    const { result } = renderHook(() => useQuery(() => Promise.resolve(42), []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('treats a plain object value as fresh (not a QueryResult wrapper)', async () => {
    const value = { name: 'Cassio', value: 'decoy' };
    const { result } = renderHook(() => useQuery(() => Promise.resolve(value), []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe(value);
    expect(result.current.isStale).toBe(false);
  });

  it('flags a stale origin when the fetcher returns staleResult', async () => {
    const { result } = renderHook(() =>
      useQuery(() => Promise.resolve(staleResult(['a', 'b'])), []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(['a', 'b']);
    expect(result.current.isStale).toBe(true);
  });

  it('reports fresh origin when the fetcher returns freshResult', async () => {
    const { result } = renderHook(() =>
      useQuery(() => Promise.resolve(freshResult('ok')), []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe('ok');
    expect(result.current.isStale).toBe(false);
  });

  it('captures errors and stops loading', async () => {
    const { result } = renderHook(() =>
      useQuery(() => Promise.reject(new Error('network down')), []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('network down');
    expect(result.current.data).toBeUndefined();
  });

  it('preserves the previous value when a refetch fails', async () => {
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useQuery(fetcher, []));

    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // Content is kept so a failed refetch does not blank the screen.
    expect(result.current.data).toBe('first');
  });

  it('re-runs when deps change', async () => {
    const fetcher = vi.fn((id: number) => Promise.resolve(id * 10));

    const { result, rerender } = renderHook(
      ({ id }) => useQuery(() => fetcher(id), [id]),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => expect(result.current.data).toBe(10));

    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data).toBe(20));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not run while disabled, then runs when enabled', async () => {
    const fetcher = vi.fn(() => Promise.resolve('ready'));

    const { result, rerender } = renderHook(
      ({ enabled }) => useQuery(fetcher, [], { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toBe('ready'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
