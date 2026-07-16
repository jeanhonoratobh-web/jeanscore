/**
 * Countdown — real-time counter to the next match (Requirements 11.7, 11.8,
 * 30.5).
 *
 * Wraps the {@link useCountdown} hook to render the remaining days, hours,
 * minutes and seconds until `targetTs`, updating every second without a reload.
 * When the target is reached the counter is replaced by the localized live
 * message `home.nextMatch.live` ("O jogo está acontecendo agora!",
 * Requirement 11.8) and the optional `onZero` callback fires exactly once.
 *
 * Digit changes animate with a vertical flip (Requirement 30.5) defined in CSS
 * and disabled under `prefers-reduced-motion` (Requirement 30.7). All text is
 * resolved via {@link I18nKey}s (Requirements 2.4, 3.3) and styling comes
 * exclusively from Design_Tokens (Requirement 3.4).
 */
import { useEffect, useRef } from 'react';
import { useCountdown } from '@hooks/useCountdown';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import styles from './Countdown.module.css';

/** Props for {@link Countdown}. */
export interface CountdownProps {
  /** Target time as a UNIX timestamp in **seconds** (kickoff of the match). */
  readonly targetTs: number;
  /**
   * Invoked once when the countdown reaches zero, letting the parent refetch
   * or update surrounding UI. Safe to omit.
   */
  readonly onZero?: () => void;
}

/** Ordered day → second segments and their label keys. */
const SEGMENT_LABELS: readonly { readonly key: keyof CountdownSegments; readonly labelKey: I18nKey }[] = [
  { key: 'days', labelKey: 'countdown.days' },
  { key: 'hours', labelKey: 'countdown.hours' },
  { key: 'minutes', labelKey: 'countdown.minutes' },
  { key: 'seconds', labelKey: 'countdown.seconds' },
];

/** The numeric segments read from the countdown hook. */
interface CountdownSegments {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

/** Zero-pads a segment to two digits for a stable, tabular display. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Renders the live countdown, swapping to the "match is live" message at zero.
 *
 * @param props - See {@link CountdownProps}.
 * @returns The countdown segments, or the localized live message once complete.
 */
export function Countdown({ targetTs, onZero }: CountdownProps): JSX.Element {
  const { t } = useI18n();
  const countdown = useCountdown(targetTs);
  const firedRef = useRef(false);

  useEffect(() => {
    if (countdown.isComplete && !firedRef.current) {
      firedRef.current = true;
      onZero?.();
    }
    // Reset the latch if the target moves into the future again (new fixture).
    if (!countdown.isComplete) {
      firedRef.current = false;
    }
  }, [countdown.isComplete, onZero]);

  if (countdown.isComplete) {
    return (
      <p className={styles.live} role="status" aria-live="polite">
        {t('home.nextMatch.live')}
      </p>
    );
  }

  return (
    <div className={styles.root} role="timer" aria-live="off">
      {SEGMENT_LABELS.map(({ key, labelKey }) => (
        <div key={key} className={styles.segment}>
          {/* `key` prop on the value forces a remount each tick so the flip
              animation replays for the changed digit (Requirement 30.5). */}
          <span key={countdown[key]} className={styles.value}>
            {pad(countdown[key])}
          </span>
          <span className={styles.label}>{t(labelKey)}</span>
        </div>
      ))}
    </div>
  );
}
