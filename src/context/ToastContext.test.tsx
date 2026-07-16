/**
 * Unit tests for ToastContext / ToastProvider / useToast (Requirement 31).
 */
import { act, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  DEFAULT_TOAST_DURATION_MS,
  ToastProvider,
  useToast,
} from './ToastContext';

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('useToast', () => {
  it('throws a descriptive error when used outside a ToastProvider', () => {
    // Silence the expected React error boundary console output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      /useToast must be used within a ToastProvider/,
    );
    spy.mockRestore();
  });
});

describe('ToastProvider queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('enqueues a toast and returns a unique id (Requirement 31.1)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = '';
    act(() => {
      id = result.current.showToast('success', 'rate.success');
    });

    expect(id).toBeTruthy();
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      id,
      kind: 'success',
      messageKey: 'rate.success',
    });
  });

  it('stacks multiple toasts in order without overlap (Requirement 31.3)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('info', 'toast.batchPartialSuccess', {
        successes: 3,
        failures: 1,
      });
      result.current.showToast('error', 'rate.error');
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts.map((t) => t.messageKey)).toEqual([
      'toast.batchPartialSuccess',
      'rate.error',
    ]);
    // ids are distinct
    expect(result.current.toasts[0]?.id).not.toBe(result.current.toasts[1]?.id);
  });

  it('carries interpolation params for a partial batch info toast (Requirement 31.5)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('info', 'toast.batchPartialSuccess', {
        successes: 5,
        failures: 2,
      });
    });

    expect(result.current.toasts[0]?.params).toEqual({
      successes: 5,
      failures: 2,
    });
  });

  it('auto-dismisses after the default duration (Requirement 31.1)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('success', 'rate.success');
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('keeps a toast until dismissed when duration is 0', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = '';
    act(() => {
      id = result.current.showToast('info', 'state.offline', undefined, {
        durationMs: 0,
      });
    });

    act(() => {
      vi.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS * 10);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismissToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismisses a specific toast by id and is a no-op for unknown ids', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let firstId = '';
    act(() => {
      firstId = result.current.showToast('success', 'rate.success', undefined, {
        durationMs: 0,
      });
      result.current.showToast('error', 'rate.error', undefined, {
        durationMs: 0,
      });
    });
    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.dismissToast(firstId);
      result.current.dismissToast('does-not-exist');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.messageKey).toBe('rate.error');
  });

  it('renders one keyed node per toast in an accessible live region (Requirement 31.3)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('success', 'rate.success', undefined, {
        durationMs: 0,
      });
    });

    const region = screen.getByRole('region', { name: 'notifications' });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'data-toast-kind',
      'success',
    );
  });
});
