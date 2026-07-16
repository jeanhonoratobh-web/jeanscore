/**
 * `PlayerCard` (Carta_FIFA) — the visual hero of the squad (Requirement 15).
 *
 * A page-independent, reusable collectible card that renders a player's
 * FIFA-style card: a 0-99 rating derived from the season average via
 * {@link mapScoreToRating}, the position abbreviation, photo, name, the raw
 * season score (Nota_da_Temporada) and vote count. The border color reflects
 * the card {@link Rarity} (from {@link calcRarity}) and a brightness gradient
 * animates **only** on hover, never automatically (Requirements 15.3, 15.4).
 *
 * All text is resolved via {@link useI18n} (never hardcoded, Requirement 3.3)
 * and every visual value comes from Design_Tokens through the co-located CSS
 * module (Requirement 3.4). Clicking the card invokes `onClick` so a page can
 * navigate to the player profile (Requirement 15.9); the optional share action
 * invokes `onShare` to generate a shareable image (Requirement 27.1).
 */
import type { KeyboardEvent } from 'react';
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import { calcRarity, mapScoreToRating } from '@domain/index';
import type { Player, Position, Rarity } from '@/types/domain';
import { Button } from '../controls/Button';
import styles from './PlayerCard.module.css';

/** Visual density / emphasis variant of the card. */
export type PlayerCardVariant = 'default' | 'compact' | 'legendary';

/** Props for {@link PlayerCard}. */
export interface PlayerCardProps {
  /** The player to render. */
  player: Player;
  /** Season average in `[0, 10]`, or `null` when the player has no ratings. */
  seasonAvg: number | null;
  /** Number of votes (Avaliações) that produced the season average. */
  votes: number;
  /** Visual variant; defaults to `'default'`. */
  variant?: PlayerCardVariant;
  /** Invoked with the player id when the card is activated (Requirement 15.9). */
  onClick?: (playerId: string) => void;
  /** Invoked with the player id to generate a shareable image (Requirement 27.1). */
  onShare?: (playerId: string) => void;
}

/** Maps a {@link Position} to its abbreviation i18n key (e.g. `GOL`, `ATA`). */
const POSITION_ABBR_KEY: Record<Position, I18nKey> = {
  Goalkeeper: 'position.goalkeeper.abbr',
  Defender: 'position.defender.abbr',
  Midfielder: 'position.midfielder.abbr',
  Attacker: 'position.attacker.abbr',
};

/** Maps a {@link Rarity} to the CSS-module class that colors its border/glow. */
const RARITY_CLASS: Record<Rarity, string> = {
  bronze: styles.bronze,
  silver: styles.silver,
  gold: styles.gold,
  legendary: styles.legendary,
};

/** Placeholder shown as an alt/label when the season score is absent. */
const EMPTY_SCORE = '—';

/**
 * Renders a themed, internationalized collectible player card.
 *
 * The rating shown in the top-left corner is the season average mapped to the
 * `[0, 99]` scale ({@link mapScoreToRating}); with no ratings yet it renders a
 * neutral placeholder. The border rarity comes from {@link calcRarity}, so a
 * `null` average yields a bronze card. When `onClick` is provided the whole
 * card becomes an activatable control (mouse + keyboard); the nested share
 * action stops propagation so sharing never triggers navigation.
 *
 * @param props - See {@link PlayerCardProps}.
 * @returns The player card element.
 */
export function PlayerCard({
  player,
  seasonAvg,
  votes,
  variant = 'default',
  onClick,
  onShare,
}: PlayerCardProps): JSX.Element {
  const { t } = useI18n();

  const rarity = calcRarity(seasonAvg);
  const rating = seasonAvg === null ? null : mapScoreToRating(seasonAvg);
  const positionAbbr = t(POSITION_ABBR_KEY[player.position]);
  const scoreLabel = seasonAvg === null ? EMPTY_SCORE : seasonAvg.toFixed(1);

  const isInteractive = onClick !== undefined;

  const handleActivate = (): void => {
    onClick?.(player.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  const className = [styles.card, RARITY_CLASS[rarity], styles[variant]].join(' ');

  return (
    <div
      className={className}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? player.name : undefined}
    >
      {/* Brightness gradient overlay — animates only on hover (Requirement 15.4). */}
      <span className={styles.glow} aria-hidden="true" />

      <header className={styles.topRow}>
        <span className={styles.rating}>{rating ?? EMPTY_SCORE}</span>
        <span className={styles.position}>{positionAbbr}</span>
      </header>

      <div className={styles.photoWrap}>
        {player.photo !== null ? (
          <img className={styles.photo} src={player.photo} alt={player.name} />
        ) : (
          <span className={styles.photoPlaceholder} aria-hidden="true">
            {player.name.charAt(0)}
          </span>
        )}
      </div>

      <div className={styles.info}>
        <p className={styles.name} title={player.name}>
          {player.name}
        </p>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t('player.seasonAverage')}</dt>
            <dd className={styles.statValue}>{scoreLabel}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t('player.votes')}</dt>
            <dd className={styles.statValue}>{votes}</dd>
          </div>
        </dl>
      </div>

      {onShare !== undefined && (
        <span
          className={styles.share}
          // Sharing must never bubble up to trigger card navigation.
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            labelKey="common.share"
            onClick={() => onShare(player.id)}
          />
        </span>
      )}
    </div>
  );
}
