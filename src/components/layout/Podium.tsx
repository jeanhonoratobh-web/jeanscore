/**
 * `Podium` — top-three ranking podium (Requirements 3.2, 26.2).
 *
 * Displays the 1st, 2nd and 3rd place of a ranking category with an entrance
 * animation that plays as the section is scrolled into view (Requirement 26.2).
 * The animation is suppressed when the user prefers reduced motion
 * (Requirement 30.7): in that case the podium renders in its final, visible
 * state immediately.
 *
 * All visual values come from Design_Tokens via a co-located CSS module
 * (Requirement 3.4); the numeric rating is rendered directly and player names
 * come from the ranking data.
 */
import { useEffect, useRef, useState } from 'react';
import type { RankingEntry } from '@/types/domain';
import { useReducedMotion } from '@hooks/useReducedMotion';
import styles from './Podium.module.css';

/** Props for {@link Podium}. */
export interface PodiumProps {
  /** The top three ranking entries (extra entries beyond three are ignored). */
  readonly top3: readonly RankingEntry[];
  /**
   * When `true` (default), the podium fades/rises into view on scroll. When
   * `false`, or when the user prefers reduced motion, it renders visible
   * immediately.
   */
  readonly animateOnScroll?: boolean;
}

/**
 * Reveals the podium when it scrolls into the viewport.
 *
 * Returns a ref to attach to the podium container plus a `visible` flag. When
 * animation is disabled (either `enabled === false` or reduced motion), the
 * flag starts `true` and no observer is created, so the podium is shown at once.
 *
 * @param enabled - Whether scroll-triggered reveal should be used.
 * @returns The container ref and the current visibility flag.
 */
function useScrollReveal(enabled: boolean): {
  ref: React.RefObject<HTMLOListElement>;
  visible: boolean;
} {
  const ref = useRef<HTMLOListElement>(null);
  const [visible, setVisible] = useState<boolean>(!enabled);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    // Without IntersectionObserver support, reveal immediately as a fallback.
    if (node === null || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, visible };
}

/** Visual ordering of medals so 1st place sits in the centre, raised. */
const MEDAL_CLASS: Record<number, string> = {
  1: styles.first,
  2: styles.second,
  3: styles.third,
};

/**
 * Renders the top-three podium.
 *
 * @param props - See {@link PodiumProps}.
 * @returns The podium element.
 */
export function Podium({ top3, animateOnScroll = true }: PodiumProps): JSX.Element {
  const reducedMotion = useReducedMotion();
  const animate = animateOnScroll && !reducedMotion;
  const { ref, visible } = useScrollReveal(animate);

  const entries = top3.slice(0, 3);

  return (
    <ol
      ref={ref}
      className={[styles.podium, visible ? styles.visible : styles.hidden].join(' ')}
    >
      {entries.map((entry) => (
        <li
          key={entry.playerId}
          className={[styles.step, MEDAL_CLASS[entry.rank] ?? ''].join(' ').trim()}
        >
          <span className={styles.rank}>{entry.rank}</span>
          <span className={styles.name}>{entry.playerName}</span>
          <span className={styles.avg}>{entry.avg.toFixed(1)}</span>
          <span className={styles.votes}>{entry.votes}</span>
        </li>
      ))}
    </ol>
  );
}
