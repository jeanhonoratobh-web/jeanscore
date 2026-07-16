/**
 * `PlayerHeader` — scouting-report header for a player (Requirements 3.2, 16.2).
 *
 * Renders the identity block at the top of the player profile: high-resolution
 * photo, full name, shirt number, translated Position, nationality, current
 * card Rarity and the season average (Nota_da_Temporada) (Requirement 16.2).
 *
 * The Rarity is conveyed visually through a Design_Token colour treatment
 * (bronze / silver / gold / legendary) rather than a literal label, keeping the
 * FIFA-card metaphor while avoiding hardcoded UI text. Every other label is
 * resolved from an {@link I18nKey} (Requirement 3.3) and all visual values come
 * from Design_Tokens via a co-located CSS module (Requirement 3.4).
 */
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/index';
import type { Player, Position, Rarity } from '@/types/domain';
import styles from './PlayerHeader.module.css';

/** Props for {@link PlayerHeader}. */
export interface PlayerHeaderProps {
  /** The player whose identity is displayed. */
  readonly player: Player;
  /** Season average (Nota_da_Temporada), or `null` when not yet rated. */
  readonly seasonAvg: number | null;
  /** Current card rarity, driving the visual colour treatment. */
  readonly rarity: Rarity;
}

/** Maps a {@link Position} to its translated-label i18n key. */
const POSITION_LABEL_KEY: Record<Position, I18nKey> = {
  Goalkeeper: 'position.goalkeeper',
  Defender: 'position.defender',
  Midfielder: 'position.midfielder',
  Attacker: 'position.attacker',
};

/**
 * Renders the player identity header.
 *
 * The shirt number and nationality render only when present on the player. When
 * `seasonAvg` is `null` a neutral placeholder is shown instead of a number.
 *
 * @param props - See {@link PlayerHeaderProps}.
 * @returns The player header element.
 */
export function PlayerHeader({ player, seasonAvg, rarity }: PlayerHeaderProps): JSX.Element {
  const { t } = useI18n();

  return (
    <header className={[styles.header, styles[rarity]].join(' ')} data-rarity={rarity}>
      <div className={styles.photoFrame}>
        {player.photo !== null ? (
          <img className={styles.photo} src={player.photo} alt={player.name} />
        ) : (
          <div className={styles.photoFallback} aria-hidden="true" />
        )}
      </div>

      <div className={styles.identity}>
        <h1 className={styles.name}>{player.name}</h1>

        <dl className={styles.meta}>
          {player.number !== null && (
            <div className={styles.metaItem}>
              <dt className={styles.metaLabel}>#</dt>
              <dd className={styles.metaValue}>{player.number}</dd>
            </div>
          )}

          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>{t('filter.position')}</dt>
            <dd className={styles.metaValue}>{t(POSITION_LABEL_KEY[player.position])}</dd>
          </div>

          {player.nationality !== null && (
            <div className={styles.metaItem}>
              <dd className={styles.metaValue}>{player.nationality}</dd>
            </div>
          )}
        </dl>

        <div className={styles.season}>
          <span className={styles.seasonLabel}>{t('player.seasonAverage')}</span>
          <span className={styles.seasonValue}>
            {seasonAvg !== null ? seasonAvg.toFixed(1) : t('state.noData')}
          </span>
        </div>
      </div>
    </header>
  );
}
