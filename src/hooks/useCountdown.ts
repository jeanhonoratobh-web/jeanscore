/**
 * `useCountdown` — real-time countdown toward a future timestamp.
 *
 * Powers the homepage "Próxima Partida" countdown (Requirement 11.7): given a
 * target time it exposes the remaining days, hours, minutes and seconds and
 * re-renders every second until the target is reached. When the target is in
 * the past (or exactly now) the countdown reports all-zero segments and
 * `isComplete === true`, which the UI uses to swap in the "O jogo está
 * acontecendo agora!" message (Requirement 11.8) without a reload.
 *
 * The internal interval is registered on mount and cleared on unmount (and
 * whenever `targetTs` changes), so no timers leak between renders.
 */
import { useEffect, useState } from 'react';

/** Remaining time broken into calendar-style segments. */
export interface Countdown {
  /** Whole days remaining (never negative). */
  readonly days: number;
  /** Hours remaining within the current day, `0`–`23`. */
  readonly hours: number;
  /** Minutes remaining within the current hour, `0`–`59`. */
  readonly minutes: number;
  /** Seconds remaining within the current minute, `0`–`59`. */
  readonly seconds: number;
  /** `true` once the target timestamp has been reached or passed. */
  readonly isComplete: boolean;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Computes the countdown segments for a target timestamp relative to `nowMs`.
 *
 * Kept pure and separate from React state so the breakdown is trivially
 * testable and reused for the initial value and every tick.
 *
 * @param targetTs - Target time as a UNIX timestamp in **seconds**.
 * @param nowMs - Current time in milliseconds (e.g. {@link Date.now}).
 * @returns The remaining time as {@link Countdown}; all segments are `0` and
 *   `isComplete` is `true` once `nowMs` reaches or passes `targetTs`.
 */
export function computeCountdown(targetTs: number, nowMs: number): Countdown {
  const remaining = Math.floor(targetTs - nowMs / 1000);
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: true };
  }
  return {
    days: Math.floor(remaining / SECONDS_PER_DAY),
    hours: Math.floor((remaining % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((remaining % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: remaining % SECONDS_PER_MINUTE,
    isComplete: false,
  };
}

/**
 * Counts down to `targetTs`, re-rendering every second (Requirement 11.7).
 *
 * @param targetTs - Target time as a UNIX timestamp in **seconds**.
 * @returns The current {@link Countdown}, updated once per second until the
 *   target is reached, after which it stays at zero with `isComplete === true`.
 */
export function useCountdown(targetTs: number): Countdown {
  const [countdown, setCountdown] = useState<Countdown>(() =>
    computeCountdown(targetTs, Date.now()),
  );

  useEffect(() => {
    // Recompute immediately so the value reflects the new target before the
    // first tick fires a second later.
    setCountdown(computeCountdown(targetTs, Date.now()));

    const intervalId = setInterval(() => {
      setCountdown(computeCountdown(targetTs, Date.now()));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [targetTs]);

  return countdown;
}
