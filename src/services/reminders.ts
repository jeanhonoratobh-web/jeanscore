/**
 * Pre-game reminder scheduling (`services/reminders.ts`).
 *
 * Implements the PWA pre-game reminders described in the design (PWA section)
 * and Requirement 34.4–34.6:
 *
 * - 34.4: WHERE the User grants notification permission, schedule a pre-game
 *   reminder for the next scheduled fixture.
 * - 34.5: WHEN the reminder time is reached, notify the User about the upcoming
 *   match with a Portuguese message.
 * - 34.6: IF permission is not granted, keep working normally without sending
 *   reminders and without re-prompting intrusively.
 *
 * This module lives **outside** the React tree, so it never touches `useI18n`
 * directly. Instead the caller resolves the message text (e.g. the
 * `pwa.reminder.matchSoon` key) and passes it in — keeping the two-language
 * rule (English keys → pt-BR text) enforced by the React layer.
 *
 * ## Scheduling approach
 *
 * On static hosting (GitHub Pages) there is no server able to push
 * notifications, so reminders are scheduled in-page with `setTimeout` and fired
 * through the Notification API. This works while the tab/app is alive. The
 * production-grade approach would register the schedule with the service worker
 * and use the Push API (or `showTrigger`/periodic sync where available) so
 * reminders survive the page being closed; that requires a push backend which
 * is out of scope for a purely static deployment.
 *
 * ## Silent degradation
 *
 * Every entry point is defensive: if the Notification API is unavailable
 * (SSR, unsupported browser) or permission is denied, the functions resolve to
 * a benign value and never throw (Requirement 34.6).
 */

import type { Fixture } from '@/types/domain';

/** Maximum delay `setTimeout` can represent (~24.8 days, 2^31 - 1 ms). */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Default lead time before kickoff: 30 minutes, in milliseconds. */
export const DEFAULT_REMINDER_LEAD_MS = 30 * 60 * 1000;

/** Handles for the timers currently scheduled, so they can be cancelled. */
const scheduledTimers = new Set<ReturnType<typeof setTimeout>>();

/**
 * Returns `true` when the Notification API is usable in this environment.
 *
 * Guards against non-browser contexts (SSR/tests) and browsers without the
 * Notification API so callers can degrade silently (Requirement 34.6).
 */
function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification === 'function';
}

/**
 * Requests permission to show reminder notifications, on demand.
 *
 * Intended to be wired to an explicit user action (e.g. an "Ativar lembretes de
 * jogo" toggle). To avoid nagging the User (Requirement 34.6):
 * - if the API is unavailable, resolves to `'denied'` without throwing;
 * - if permission was already `granted` or `denied`, returns that state without
 *   prompting again;
 * - only when the state is `'default'` (never asked) does it actually prompt.
 *
 * @returns The resulting {@link NotificationPermission}. Resolves to `'denied'`
 *   when notifications are unsupported.
 */
export async function requestReminderPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  // Already decided — never re-prompt intrusively (Requirement 34.6).
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    // Some browsers throw on the legacy callback form; degrade silently.
    return Notification.permission;
  }
}

/**
 * Schedules a single pre-game reminder for an upcoming fixture.
 *
 * The reminder fires `leadMs` before kickoff (`fixture.ts` is the kickoff time
 * in **seconds**). Scheduling is a no-op — resolving `null` without throwing —
 * when any of the following hold (Requirement 34.6):
 * - notifications are unsupported or permission is not `granted`;
 * - the reminder time is already in the past;
 * - the delay exceeds what a timer can represent (~24.8 days).
 *
 * When the timer fires it shows a Notification with the caller-supplied
 * `message` (Requirement 34.5), which should be the resolved
 * `pwa.reminder.matchSoon` text in pt-BR.
 *
 * @param fixture Upcoming fixture whose kickoff (`ts`, seconds) drives timing.
 * @param message Pre-resolved, localized reminder body (Requirement 34.5).
 * @param leadMs How long before kickoff to fire; defaults to
 *   {@link DEFAULT_REMINDER_LEAD_MS} (30 minutes).
 * @returns A cancel function for this reminder, or `null` when nothing was
 *   scheduled.
 */
export function scheduleFixtureReminder(
  fixture: Fixture,
  message: string,
  leadMs: number = DEFAULT_REMINDER_LEAD_MS,
): (() => void) | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  const kickoffMs = fixture.ts * 1000;
  const fireAt = kickoffMs - leadMs;
  const delay = fireAt - Date.now();

  // Past reminders or delays beyond the timer's range are skipped silently.
  if (delay <= 0 || delay > MAX_TIMEOUT_MS) {
    return null;
  }

  const title = `${fixture.homeTeam} × ${fixture.awayTeam}`;

  const timer = setTimeout(() => {
    scheduledTimers.delete(timer);
    try {
      // Fire-and-forget notification; the instance itself is not needed.
      void new Notification(title, { body: message, tag: `fixture-${fixture.id}` });
    } catch {
      // A notification may still fail (e.g. permission revoked mid-session);
      // degrade silently (Requirement 34.6).
    }
  }, delay);

  scheduledTimers.add(timer);

  return () => {
    clearTimeout(timer);
    scheduledTimers.delete(timer);
  };
}

/**
 * Cancels every reminder scheduled through {@link scheduleFixtureReminder}.
 *
 * Safe to call at any time (e.g. on logout or when the User disables
 * reminders); clears all pending timers and never throws.
 */
export function cancelReminders(): void {
  for (const timer of scheduledTimers) {
    clearTimeout(timer);
  }
  scheduledTimers.clear();
}
