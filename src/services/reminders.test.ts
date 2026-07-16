/**
 * Unit tests for the pre-game reminder Service (`services/reminders.ts`).
 *
 * Covers Requirement 34.4–34.6:
 * - permission is requested on demand and never re-prompts once decided (34.6);
 * - a reminder fires before kickoff with the localized message (34.4, 34.5);
 * - unsupported / denied environments degrade silently, never throwing (34.6).
 *
 * The Notification API is stubbed on `window` so the timer-driven behaviour can
 * be exercised deterministically with fake timers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  requestReminderPermission,
  scheduleFixtureReminder,
  cancelReminders,
  DEFAULT_REMINDER_LEAD_MS,
} from './reminders';
import type { Fixture } from '@/types/domain';

/** Builds a fixture whose kickoff is `secondsFromNow` in the future. */
function fixtureInSeconds(secondsFromNow: number): Fixture {
  return {
    id: 'fx-1',
    homeTeam: 'Cruzeiro',
    awayTeam: 'Atlético',
    homeScore: null,
    awayScore: null,
    fixtureDate: '2099-01-01',
    ts: Math.floor(Date.now() / 1000) + secondsFromNow,
    competition: 1,
    stadium: null,
    status: 'notstarted',
    liberado: false,
  };
}

/**
 * Installs a stub Notification constructor with the given permission and
 * `requestPermission` behaviour. Returns the constructor mock so tests can
 * assert on notifications that were shown.
 */
function stubNotification(
  permission: NotificationPermission,
  requestResult: NotificationPermission = permission,
): { ctor: ReturnType<typeof vi.fn> } {
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
  // Expose on window/global for the Service's feature detection.
  vi.stubGlobal('Notification', NotificationStub);
  return { ctor };
}

describe('reminders service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cancelReminders();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('requestReminderPermission (34.6)', () => {
    it('returns "denied" without throwing when Notification is unsupported', async () => {
      vi.stubGlobal('Notification', undefined);
      await expect(requestReminderPermission()).resolves.toBe('denied');
    });

    it('prompts only when permission is "default"', async () => {
      const { ctor } = stubNotification('default', 'granted');
      const Notif = ctor as unknown as {
        requestPermission: ReturnType<typeof vi.fn>;
      };
      await expect(requestReminderPermission()).resolves.toBe('granted');
      expect(Notif.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('does not re-prompt when a decision was already made', async () => {
      const { ctor } = stubNotification('denied');
      const Notif = ctor as unknown as {
        requestPermission: ReturnType<typeof vi.fn>;
      };
      await expect(requestReminderPermission()).resolves.toBe('denied');
      expect(Notif.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('scheduleFixtureReminder (34.4, 34.5, 34.6)', () => {
    it('fires a notification with the message before kickoff when granted', () => {
      const { ctor } = stubNotification('granted');
      const leadMs = DEFAULT_REMINDER_LEAD_MS;
      // Kickoff 60 minutes out → reminder fires after 30 minutes.
      const fixture = fixtureInSeconds(60 * 60);

      const cancel = scheduleFixtureReminder(fixture, 'O jogo está chegando!', leadMs);
      expect(cancel).not.toBeNull();
      expect(ctor).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(ctor).toHaveBeenCalledTimes(1);
      expect(ctor).toHaveBeenCalledWith(
        'Cruzeiro × Atlético',
        expect.objectContaining({ body: 'O jogo está chegando!' }),
      );
    });

    it('returns null and schedules nothing when permission is denied', () => {
      const { ctor } = stubNotification('denied');
      const fixture = fixtureInSeconds(60 * 60);

      const cancel = scheduleFixtureReminder(fixture, 'msg');
      expect(cancel).toBeNull();

      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(ctor).not.toHaveBeenCalled();
    });

    it('returns null when notifications are unsupported (silent degradation)', () => {
      vi.stubGlobal('Notification', undefined);
      const fixture = fixtureInSeconds(60 * 60);
      expect(scheduleFixtureReminder(fixture, 'msg')).toBeNull();
    });

    it('returns null when the reminder time is already in the past', () => {
      stubNotification('granted');
      // Kickoff sooner than the lead time → reminder would be in the past.
      const fixture = fixtureInSeconds(5 * 60);
      expect(scheduleFixtureReminder(fixture, 'msg', DEFAULT_REMINDER_LEAD_MS)).toBeNull();
    });

    it('cancel() prevents the notification from firing', () => {
      const { ctor } = stubNotification('granted');
      const fixture = fixtureInSeconds(60 * 60);

      const cancel = scheduleFixtureReminder(fixture, 'msg', DEFAULT_REMINDER_LEAD_MS);
      cancel?.();

      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(ctor).not.toHaveBeenCalled();
    });
  });

  describe('cancelReminders', () => {
    it('cancels all scheduled reminders and never throws', () => {
      const { ctor } = stubNotification('granted');
      scheduleFixtureReminder(fixtureInSeconds(60 * 60), 'a', DEFAULT_REMINDER_LEAD_MS);
      scheduleFixtureReminder(fixtureInSeconds(90 * 60), 'b', DEFAULT_REMINDER_LEAD_MS);

      expect(() => cancelReminders()).not.toThrow();

      vi.advanceTimersByTime(90 * 60 * 1000);
      expect(ctor).not.toHaveBeenCalled();
    });
  });
});
