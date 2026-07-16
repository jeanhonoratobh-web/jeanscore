/**
 * `StatCard` — labelled numeric statistic with count-up (Requirements 3.2,
 * 3.4, 30.2).
 *
 * Displays a single numeric value under an {@link I18nKey} label, styled solely
 * through Design_Tokens (Requirement 3.4). When `countUp` is enabled the value
 * animates from `0` to its final value over the `--duration-count` window
 * (800ms, Requirement 30.2). The animation is skipped entirely when the user
 * prefers reduced motion (Requirement 30.7): the final value is shown at once.
 */
import { useEffect, useRef, useState } from 'react';
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import { useReducedMotion } from '@hooks/index';
import styles from './StatCard.module.css';

/** Props for {@link StatCard}. */
export interface StatCardProps {
  /** i18n key resolved to the stat label (Requirement 3.3). */
  labelKey: I18nKey;
  /** Final numeric value to display. */
  value: number;
  /** When `true`, animate the value from `0` to `value` (Requirement 30.2). */
  countUp?: boolean;
}

/** Fallback count-up duration in ms if the token cannot be read. */
const DEFAULT_COUNT_DURATION_MS = 800;

/**
 * Reads the `--duration-count` Design_Token (e.g. `"800ms"`) as milliseconds,
 * keeping the animation duration sourced from tokens rather than a literal.
 */
function readCountDurationMs(): number {
  if (typeof window === 'undefined') return DEFAULT_COUNT_DURATION_MS;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--duration-count')
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COUNT_DURATION_MS;
}

/** Number of fractional digits in `value`, capped for display sanity. */
function decimalsOf(value: number): number {
  if (Number.isInteger(value)) return 0;
  const fraction = String(value).split('.')[1];
  return fraction ? Math.min(fraction.length, 2) : 0;
}

/**
 * Animates a number from `0` to `target` over `--duration-count`, honouring
 * reduced-motion (Requirements 30.2, 30.7).
 *
 * @param target - Final value.
 * @param enabled - Whether the count-up animation should run.
 * @returns The current display value; equals `target` immediately when the
 *   animation is disabled or reduced motion is preferred.
 */
function useCountUp(target: number, enabled: boolean): number {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState<number>(
    enabled && !prefersReducedMotion ? 0 : target,
  );
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || prefersReducedMotion) {
      setDisplay(target);
      return;
    }

    const duration = readCountDurationMs();
    const start = performance.now();

    const tick = (now: number): void => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(target * progress);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    setDisplay(0);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, enabled, prefersReducedMotion]);

  return display;
}

/**
 * Renders a themed, internationalized statistic card.
 *
 * @param props - See {@link StatCardProps}.
 * @returns The stat card element.
 */
export function StatCard({ labelKey, value, countUp = false }: StatCardProps): JSX.Element {
  const { t } = useI18n();
  const current = useCountUp(value, countUp);
  const decimals = decimalsOf(value);
  const formatted = current.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div className={styles.card}>
      <span className={styles.value}>{formatted}</span>
      <span className={styles.label}>{t(labelKey)}</span>
    </div>
  );
}
