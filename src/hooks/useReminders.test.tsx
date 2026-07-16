/**
 * Unit tests for `useReminders` (Requirement 34.4–34.6).
 *
 * Verifies the next-fixture selection logic and the opt-in wiring: permission is
 * only requested via `enable`, a reminder is scheduled for the soonest upcoming
 * fixture once granted, and the hook degrades silently when unsupported/denied.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { useReminders, selectNextFixture } from './useReminders';
import { I18nProvider } from '@i18n/index';
import type { Fixture } from '@/types/domain';

/** Builds a fixture with an explicit status and kickoff offset (seconds). */
function makeFixture(
  id: string,
  secondsFromNow: number,
  status: Fixture['status'] = 'notstarted',
): Fixture {
  return {
    id,
    homeTeam: 'Cruzeiro',
    awayTeam: 'Rival',
    homeScore: null,
    awayScore: null,
    fixtureDate: '2099-01-01',
    ts: Math.floor(Date.now() / 1000) + secondsFromNow,
    competition: 1,
    stadium: null,
    status,
    liberado: false,
  };
}

/** Stubs the Notification API on the global scope. */
function stubNotification(
  permission: NotificationPermission,
  requestResult: NotificationPermission = permission,
): ReturnType<typeof vi.fn> {
  const ctor = vi.fn();
  const NotificationStub = ctor as unknown as {
    permission: NotificationPermission;
    requestPermission: () => Promise<NotificationPermission>;
  };
  NotificationStub.permission = permission;
  NotificationStub.requestPermission = vi.fn(async () => {
    // Mirror real browsers: the resolved decision becomes the live permission.
    NotificationStub.permission = requestResult;
    return requestResult;
  });
  vi.stubGlobal('Notification', NotificationStub);
  return ctor;
}

/** Wraps hooks in the I18nProvider so `useI18n` resolves. */
function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return createElement(I18nProvider, null, children);
}

describe('selectNextFixture', () => {
  it('returns the soonest upcoming, not-yet-played fixture', () => {
    const fixtures = [
      makeFixture('later', 7200),
      makeFixture('soon', 3600),
      makeFixture('past', -3600),
    ];
    expect(selectNextFixture(fixtures)?.id).toBe('soon');
  });

  it('ignores finished and in-progress fixtures', () => {
    const fixtures = [
      makeFixture('finished', 3600, 'finished'),
      makeFixture('inprogress', 1800, 'inprogress'),
      makeFixture('upcoming', 5400),
    ];
    expect(selectNextFixture(fixtures)?.id).toBe('upcoming');
  });

  it('returns null when nothing qualifies', () => {
    expect(selectNextFixture([])).toBeNull();
    expect(selectNextFixture([makeFixture('past', -60)])).toBeNull();
  });
});

describe('useReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports unsupported and denied when Notification is missing', () => {
    vi.stubGlobal('Notification', undefined);
    const { result } = renderHook(() => useReminders([makeFixture('a', 3600)]), {
      wrapper,
    });
    expect(result.current.supported).toBe(false);
    expect(result.current.permission).toBe('denied');
    expect(result.current.enabled).toBe(false);
  });

  it('does not schedule until the user opts in', () => {
    const ctor = stubNotification('default', 'granted');
    renderHook(() => useReminders([makeFixture('a', 3600)]), { wrapper });

    vi.advanceTimersByTime(3600 * 1000);
    expect(ctor).not.toHaveBeenCalled();
  });

  it('schedules a reminder for the next fixture after enable grants permission', async () => {
    const ctor = stubNotification('default', 'granted');
    const { result } = renderHook(
      () => useReminders([makeFixture('a', 3600)]),
      { wrapper },
    );

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.enabled).toBe(true);

    // Reminder fires 30 min before the 60-min kickoff.
    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it('degrades silently when the user denies permission', async () => {
    const ctor = stubNotification('default', 'denied');
    const { result } = renderHook(
      () => useReminders([makeFixture('a', 3600)]),
      { wrapper },
    );

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.enabled).toBe(false);
    act(() => {
      vi.advanceTimersByTime(3600 * 1000);
    });
    expect(ctor).not.toHaveBeenCalled();
  });
});
