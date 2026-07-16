/**
 * `MatchCard` — a compact summary of a fixture (Requirement 19).
 *
 * A page-independent, reusable card that renders a match: the two teams, the
 * score (or a placeholder before kickoff), the competition label, stadium,
 * lifecycle status and, when available, the squad's community average score.
 * All text resolves through {@link useI18n} (Requirement 3.3) and every visual
 * value comes from Design_Tokens via the co-located CSS module (Requirement
 * 3.4). When `onClick` is provided the card becomes an activatable control that
 * reports the fixture id so a page can navigate to the match detail.
 */
import type { KeyboardEvent } from 'react';
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import type { Fixture, FixtureStatus } from '@/types/domain';
import styles from './MatchCard.module.css';

/** Props for {@link MatchCard}. */
export interface MatchCardProps {
  /** The fixture to render. */
  fixture: Fixture;
  /** Community squad average for the match, or `null`/absent when unavailable. */
  squadAverage?: number | null;
  /** Invoked with the fixture id when the card is activated. */
  onClick?: (fixtureId: string) => void;
}

/** Maps a {@link FixtureStatus} to its i18n label key. */
const STATUS_KEY: Record<FixtureStatus, I18nKey> = {
  notstarted: 'match.status.notstarted',
  inprogress: 'match.status.inprogress',
  finished: 'match.status.finished',
  postponed: 'match.status.postponed',
};

/**
 * Maps a competition id to its i18n label key (Série A = 71, Copa do Brasil =
 * 73, Copa Libertadores = 13). Unknown ids fall back to a friendly label.
 */
const COMPETITION_KEY: Record<number, I18nKey> = {
  71: 'competition.serieA',
  73: 'competition.copaDoBrasil',
  13: 'competition.libertadores',
};

/** Placeholder shown when a score is not yet available. */
const EMPTY_SCORE = '—';

/**
 * Renders a themed, internationalized match card.
 *
 * The score renders each side's goals, using a neutral placeholder when a goal
 * count is `null` (before the match is played). The squad average section is
 * only shown when a finite value is supplied. When `onClick` is provided the
 * whole card is keyboard- and mouse-activatable.
 *
 * @param props - See {@link MatchCardProps}.
 * @returns The match card element.
 */
export function MatchCard({ fixture, squadAverage, onClick }: MatchCardProps): JSX.Element {
  const { t } = useI18n();

  const competitionKey = COMPETITION_KEY[fixture.competition] ?? 'competition.friendly';
  const homeScore = fixture.homeScore ?? EMPTY_SCORE;
  const awayScore = fixture.awayScore ?? EMPTY_SCORE;
  const hasAverage = squadAverage !== null && squadAverage !== undefined;

  const isInteractive = onClick !== undefined;

  const handleActivate = (): void => {
    onClick?.(fixture.id);
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
      aria-label={isInteractive ? `${fixture.homeTeam} ${fixture.awayTeam}` : undefined}
    >
      <header className={styles.header}>
        <span className={styles.competition}>{t(competitionKey)}</span>
        <span className={styles.status}>{t(STATUS_KEY[fixture.status])}</span>
      </header>

      <div className={styles.scoreboard}>
        <span className={styles.team}>{fixture.homeTeam}</span>
        <span className={styles.score}>
          {homeScore}
          <span className={styles.scoreSep} aria-hidden="true">
            ×
          </span>
          {awayScore}
        </span>
        <span className={styles.team}>{fixture.awayTeam}</span>
      </div>

      <footer className={styles.footer}>
        {fixture.stadium !== null && (
          <span className={styles.stadium}>{fixture.stadium}</span>
        )}
        {hasAverage && (
          <span className={styles.average}>
            <span className={styles.averageLabel}>{t('match.averageScore')}</span>
            <span className={styles.averageValue}>{squadAverage.toFixed(1)}</span>
          </span>
        )}
      </footer>
    </div>
  );
}
