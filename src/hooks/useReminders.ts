/**
 * `useReminders` — PWA pre-game reminders wiring (`hooks/useReminders.ts`).
 *
 * Bridges the framework-agnostic reminder Service (`services/reminders.ts`) into
 * the React tree, implementing Requirement 34.4–34.6:
 *
 * - 34.4: WHERE the User grants notification permission, schedule a pre-game
 *   reminder for the **next scheduled fixture**.
 * - 34.5: WHEN the reminder time is reached, notify the User with a pt-BR
 *   message (resolved here through {@link useI18n} — `pwa.reminder.matchSoon`).
 * - 34.6: IF permission is not granted, keep working normally without sending
 *   reminders and without re-prompting intrusively.
 *
 * The Service purposely lives outside React and never touches i18n; this hook is
 * the single place that resolves the localized message and decides *when* to
 * schedule, keeping the two-language rule (English keys → pt-BR text) enforced by
 * the React layer.
 *
 * ## Opt-in only
 *
 * Permission is requested **only** from an explicit user action via
 * {@link UseRemindersResult.enable} (e.g. an "Ativar lembretes de jogo" button).
 * The hook never prompts on mount. Once permission is `granted`, scheduling is
 * automatic and re-runs whenever the upcoming fixture changes.
 *
 * ## Silent degradation
 *
 * When the Notification API is unavailable or permission is `denied`, every path
 * is a no-op: {@link UseRemindersResult.enable} resolves without throwing and no
 * timer is scheduled (Requirement 34.6).
 */
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@i18n/index';
import {
  cancelReminders,
  requestReminderPermission,
  scheduleFixtureReminder,
  DEFAULT_REMINDER_LEAD_MS,
} from '@/services';
import type { Fixture } from '@/types/domain';

/** Reactive result returned by {@link useReminders}. */
export interface UseRemindersResult {
  /** `true` when the Notification API exists in this environment. */
  readonly supported: boolean;
  /** Current notification permission (`'denied'` when unsupported). */
  readonly permission: NotificationPermission;
  /** Convenience flag: `true` when reminders are active (`permission === 'granted'`). */
  readonly enabled: boolean;
  /**
   * Requests permission on demand (opt-in) and updates {@link permission}.
   *
   * Safe to call from a click handler; never throws and never re-prompts once a
   * decision has been made (Requirement 34.6).
   */
  readonly enable: () => Promise<void>;
}

/** Returns `true` when the Notification API is usable in this environment. */
function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification === 'function';
}

/** Reads the current permission, defaulting to `'denied'` when unsupported. */
function currentPermission(): NotificationPermission {
  return isNotificationSupported() ? Notification.permission : 'denied';
}

/**
 * Picks the **next scheduled fixture** from a list (Requirement 34.4).
 *
 * The next fixture is the one with the soonest kickoff (`ts`, in seconds) that
 * is still in the future and has not finished or started; finished/in-progress
 * matches are ignored. Returns `null` when nothing qualifies.
 *
 * Exported for unit testing of the selection logic.
 *
 * @param fixtures - Fixtures to scan (any order).
 * @param nowMs - Current time in milliseconds (defaults to `Date.now()`).
 * @returns The soonest upcoming {@link Fixture}, or `null`.
 */
export function selectNextFixture(
  fixtures: readonly Fixture[],
  nowMs: number = Date.now(),
): Fixture | null {
  const nowSeconds = nowMs / 1000;
  let next: Fixture | null = null;
  for (const fixture of fixtures) {
    if (fixture.status === 'finished' || fixture.status === 'inprogress') {
      continue;
    }
    if (fixture.ts <= nowSeconds) {
      continue;
    }
    if (next === null || fixture.ts < next.ts) {
      next = fixture;
    }
  }
  return next;
}

/**
 * Wires PWA pre-game reminders for a list of fixtures.
 *
 * Tracks notification permission, exposes an opt-in {@link UseRemindersResult.enable}
 * action, and — once permission is `granted` — automatically schedules a reminder
 * for the next upcoming fixture, rescheduling whenever that fixture changes. All
 * paths degrade silently when notifications are unavailable or denied
 * (Requirement 34.6).
 *
 * @param fixtures - The known fixtures (e.g. from `FixtureService.getFixtures`).
 * @param leadMs - Lead time before kickoff to fire the reminder; defaults to
 *   {@link DEFAULT_REMINDER_LEAD_MS} (30 minutes).
 * @returns The reactive {@link UseRemindersResult}.
 */
export function useReminders(
  fixtures: readonly Fixture[],
  leadMs: number = DEFAULT_REMINDER_LEAD_MS,
): UseRemindersResult {
  const { t } = useI18n();
  const supported = isNotificationSupported();
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission);

  const enable = useCallback(async (): Promise<void> => {
    const result = await requestReminderPermission();
    setPermission(result);
  }, []);

  // The soonest upcoming fixture drives scheduling; its id/timestamp are the
  // only inputs that should trigger a reschedule.
  const nextFixture = selectNextFixture(fixtures);
  const nextId = nextFixture?.id ?? null;
  const nextTs = nextFixture?.ts ?? null;

  useEffect(() => {
    // Only schedule when the User has opted in and permission is granted
    // (Requirement 34.4); otherwise this is a silent no-op (Requirement 34.6).
    if (permission !== 'granted' || nextFixture === null) {
      return;
    }

    const cancel = scheduleFixtureReminder(
      nextFixture,
      t('pwa.reminder.matchSoon'),
      leadMs,
    );

    return () => {
      if (cancel !== null) {
        cancel();
      } else {
        // Defensive: ensure no stray timer survives a fixture change.
        cancelReminders();
      }
    };
    // `nextFixture` is recreated each render; depend on the stable id/timestamp
    // that actually determine the scheduled reminder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, nextId, nextTs, leadMs, t]);

  return {
    supported,
    permission,
    enabled: permission === 'granted',
    enable,
  };
}
