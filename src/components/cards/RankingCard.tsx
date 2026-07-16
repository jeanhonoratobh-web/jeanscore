/**
 * `RankingCard` — one row of a computed ranking (Requirements 3.2, 26).
 *
 * A page-independent, reusable card that renders a single {@link RankingEntry}:
 * its display rank, the player's name and position, the average score and the
 * number of votes. Text resolves via {@link useI18n} (Requirement 3.3) and all
 * visual values come from Design_Tokens through the co-located CSS module
 * (Requirement 3.4). When `onClick` is provided the row becomes an activatable
 * control reporting the player id so a page can navigate to the profile.
 */
import type { KeyboardEvent } from 'react';
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import type { Position, RankingEntry } from '@/types/domain';
import styles from './RankingCard.module.css';

/** Props for {@link RankingCard}. */
export interface RankingCardProps {
  /** The ranking entry to render. */
  entry: RankingEntry;
  /** Display rank (1-based) shown in the leading badge. */
  rank: number;
  /** Invoked with the player id when the row is activated. */
  onClick?: (id: string) => void;
}

/** Maps a {@link Position} to its full-name i18n label key. */
const POSITION_KEY: Record<Position, I18nKey> = {
  Goalkeeper: 'position.goalkeeper',
  Defender: 'position.defender',
  Midfielder: 'position.midfielder',
  Attacker: 'position.attacker',
};

/**
 * Renders a themed, internationalized ranking row.
 *
 * The average is shown to one decimal place and the vote count is labelled via
 * the `player.votes` key. When `onClick` is provided the row is keyboard- and
 * mouse-activatable.
 *
 * @param props - See {@link RankingCardProps}.
 * @returns The ranking card element.
 */
export function RankingCard({ entry, rank, onClick }: RankingCardProps): JSX.Element {
  const { t } = useI18n();

  const isInteractive = onClick !== undefined;

  const handleActivate = (): void => {
    onClick?.(entry.playerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <div
      className={styles.card}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? entry.playerName : undefined}
    >
      <span className={styles.rank}>{rank}</span>

      <div className={styles.identity}>
        <span className={styles.name} title={entry.playerName}>
          {entry.playerName}
        </span>
        <span className={styles.position}>{t(POSITION_KEY[entry.position])}</span>
      </div>

      <div className={styles.metrics}>
        <span className={styles.avg}>{entry.avg.toFixed(1)}</span>
        <span className={styles.votes}>
          {entry.votes} {t('player.votes')}
        </span>
      </div>
    </div>
  );
}
