/**
 * `AchievementCard` — an achievement catalog entry with its unlock state
 * (Requirement 10.4).
 *
 * A page-independent, reusable card that renders an {@link AchievementDef}: its
 * title and description (both resolved from i18n keys, Requirement 3.3) plus a
 * status label indicating whether it is unlocked or still pending. All visual
 * values come from Design_Tokens through the co-located CSS module (Requirement
 * 3.4); pending achievements are visually de-emphasized.
 */
import { useI18n } from '@i18n/index';
import type { AchievementDef } from '@/types/domain';
import styles from './AchievementCard.module.css';

/** Props for {@link AchievementCard}. */
export interface AchievementCardProps {
  /** The achievement definition (title/description keys) to render. */
  achievement: AchievementDef;
  /** Whether the achievement is unlocked for the user. */
  unlocked: boolean;
}

/**
 * Renders a themed, internationalized achievement card.
 *
 * The status label switches between the `achievements.unlocked` and
 * `achievements.pending` keys based on `unlocked`, and a modifier class
 * de-emphasizes pending achievements.
 *
 * @param props - See {@link AchievementCardProps}.
 * @returns The achievement card element.
 */
export function AchievementCard({ achievement, unlocked }: AchievementCardProps): JSX.Element {
  const { t } = useI18n();

  const title = t(achievement.titleKey);
  const description = t(achievement.descriptionKey);
  const statusLabel = unlocked ? t('achievements.unlocked') : t('achievements.pending');

  const className = [styles.card, unlocked ? styles.unlocked : styles.pending].join(' ');

  return (
    <div className={className}>
      <header className={styles.header}>
        <p className={styles.title} title={title}>
          {title}
        </p>
        <span className={styles.status}>{statusLabel}</span>
      </header>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
