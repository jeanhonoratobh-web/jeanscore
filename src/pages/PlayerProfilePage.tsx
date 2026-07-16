/**
 * `PlayerProfilePage` — the scouting-report player profile (`pages/PlayerProfilePage.tsx`,
 * Requirements 16, 21).
 *
 * Composes the reusable component library into the `/jogador/:id` route: it
 * loads the squad, every community rating and the fixtures through `useQuery`
 * over the injected Services, resolves the target player from the `:id` path
 * parameter (or the `playerId` prop) and, when the id does not exist in the
 * squad, renders the 404 {@link NotFoundPage} with the "Jogador não encontrado"
 * message (Requirement 16.14).
 *
 * For a resolved player it aggregates the player's ratings with the pure
 * `domain` layer and composes, top to bottom: the {@link PlayerHeader} with the
 * current card Rarity (via {@link calcRarity}, Requirement 16.2), a
 * {@link RadarChart} attribute profile (Requirement 16.3), a season summary
 * (Requirement 16.4), Strengths/Weaknesses (Requirement 16.5,
 * {@link strengthsWeaknesses}), the community Trend (Requirement 16.6), the
 * Recent Form of the last five matches (Requirement 16.7), the evolution
 * {@link LineChart} (Requirement 16.8, {@link buildEvolution}), performance by
 * competition (Requirement 16.9), the score-distribution {@link Histogram}
 * (Requirement 16.11, {@link buildHistogram}) and the Nota_Permanente section
 * with the yearly-rating form (Requirements 21.1, 21.2).
 *
 * Every section shows a shape-preserving {@link Skeleton} while its data loads
 * (Requirement 16.12). All analytics are derived client-side with no extra
 * Supabase round-trips. Every visual value comes from Design_Tokens through the
 * co-located CSS module (Requirement 3.4) and every string is resolved via
 * {@link useI18n} (Requirements 2.4, 3.3).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RadarChart, LineChart, Histogram } from '@components/charts';
import type { RadarSeries } from '@components/charts';
import { CompetitionBadge } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { PlayerHeader } from '@components/layout';
import {
  bestMatch,
  buildEvolution,
  buildHistogram,
  calcAverage,
  calcRarity,
  calcStdDev,
  normalizeScore,
  strengthsWeaknesses,
  worstMatch,
} from '@domain/index';
import { useAuth } from '@/context/AuthContext';
import { useServices } from '@/context/ServicesContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { PermanentAggregate } from '@/types/service';
import type { Fixture, GameScore, Player } from '@/types/domain';
import { NotFoundPage } from './NotFoundPage';
import styles from './PlayerProfilePage.module.css';

/** Props for {@link PlayerProfilePage}. */
export interface PlayerProfilePageProps {
  /**
   * The player id to display. When omitted it is read from the current URL path
   * (`/jogador/:id`) so the page works before a router library is wired in.
   */
  readonly playerId?: string;
}

/** Number of most-recent matches shown in the Recent Form section (Requirement 16.7). */
const RECENT_FORM_LIMIT = 5;

/** Number of most-recent matches averaged for the community Trend (Requirement 16.6). */
const TREND_WINDOW = 3;

/** Delta band (in score points) within which the trend is considered stable. */
const TREND_EPSILON = 0.25;

/** Lowest permanent rating selectable in the form (Requirement 21.2). */
const PERMANENT_MIN = 0;
/** Highest permanent rating selectable in the form (Requirement 21.2). */
const PERMANENT_MAX = 10;
/** Step of the permanent rating scale (Requirement 21.2). */
const PERMANENT_STEP = 0.5;
/** Default permanent rating pre-selected in the form. */
const PERMANENT_DEFAULT = 6;

/** A player's per-fixture aggregate enriched with match context and order. */
interface PlayerMatch {
  /** Identifier of the fixture. */
  readonly fixtureId: string;
  /** Nota_de_Jogo: the mean of the player's ratings in the fixture. */
  readonly average: number;
  /** Number of ratings behind {@link PlayerMatch.average}. */
  readonly votes: number;
  /** Fixture date string (used as a label). */
  readonly fixtureDate: string;
  /** Home team of the fixture. */
  readonly homeTeam: string;
  /** Away team of the fixture. */
  readonly awayTeam: string;
  /** Numeric competition id, or `null` when the fixture is unknown. */
  readonly competition: number | null;
  /** Chronological sort key in seconds since the Unix epoch. */
  readonly ts: number;
}

/** Aggregated Nota_de_Jogo per competition (Requirement 16.9). */
interface CompetitionPerformance {
  /** Numeric competition id, or `null` when the fixture is unknown. */
  readonly competition: number | null;
  /** Mean of the per-match Notas_de_Jogo played in the competition. */
  readonly average: number;
  /** Total number of ratings received across the competition. */
  readonly votes: number;
}

/** The community-trend direction shown in the Trend section (Requirement 16.6). */
type TrendKind = 'up' | 'down' | 'stable';

/**
 * Reads the player id from the current URL path (`/jogador/:id`), tolerating the
 * GitHub Pages base subpath, a trailing slash and any query/hash suffix.
 *
 * @returns The decoded player id, or an empty string when the path has none.
 */
function readPlayerIdFromPath(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const marker = '/jogador/';
  const { pathname } = window.location;
  const index = pathname.indexOf(marker);
  if (index === -1) {
    return '';
  }
  const rest = pathname.slice(index + marker.length);
  const segment = rest.split('/')[0]?.split('?')[0]?.split('#')[0] ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Builds the router-relative detail-page path for a fixture. It is consumed by a
 * React Router {@link Link}, so the router `basename` prepends the GitHub Pages
 * subpath automatically (Requirement 16.13).
 */
function matchHref(fixtureId: string): string {
  return `/jogo/${encodeURIComponent(fixtureId)}`;
}

/** Parses a date string into whole epoch seconds, collapsing invalid input to `0`. */
function parseDateToSeconds(date: string): number {
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

/**
 * Aggregates a player's ratings into one enriched {@link PlayerMatch} per
 * fixture, ordered chronologically (oldest → newest).
 *
 * Ratings are grouped by fixture and averaged into the fixture's Nota_de_Jogo;
 * the fixture's competition and kickoff time come from the fixtures lookup when
 * available, falling back to parsing the score's `fixtureDate`.
 */
function aggregatePlayerMatches(
  scores: readonly GameScore[],
  fixtureById: Map<string, Fixture>,
): PlayerMatch[] {
  const groups = new Map<string, GameScore[]>();
  for (const score of scores) {
    const list = groups.get(score.fixtureId);
    if (list === undefined) {
      groups.set(score.fixtureId, [score]);
    } else {
      list.push(score);
    }
  }

  const matches: PlayerMatch[] = [];
  for (const [fixtureId, group] of groups) {
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    const fixture = fixtureById.get(fixtureId);
    matches.push({
      fixtureId,
      average: calcAverage(group.map((s) => s.score)),
      votes: group.length,
      fixtureDate: first.fixtureDate,
      homeTeam: first.homeTeam,
      awayTeam: first.awayTeam,
      competition: fixture ? fixture.competition : null,
      ts: fixture ? fixture.ts : parseDateToSeconds(first.fixtureDate),
    });
  }

  matches.sort((a, b) => a.ts - b.ts || a.fixtureId.localeCompare(b.fixtureId));
  return matches;
}

/**
 * Aggregates the per-match Notas_de_Jogo by competition (Requirement 16.9),
 * ordered by average descending.
 */
function performanceByCompetition(matches: readonly PlayerMatch[]): CompetitionPerformance[] {
  const groups = new Map<number | null, { averages: number[]; votes: number }>();
  for (const match of matches) {
    const bucket = groups.get(match.competition);
    if (bucket === undefined) {
      groups.set(match.competition, { averages: [match.average], votes: match.votes });
    } else {
      bucket.averages.push(match.average);
      bucket.votes += match.votes;
    }
  }

  const result: CompetitionPerformance[] = [];
  for (const [competition, { averages, votes }] of groups) {
    result.push({ competition, average: calcAverage(averages), votes });
  }
  result.sort((a, b) => b.average - a.average);
  return result;
}

/** Options for the permanent-rating select, from 0 to 10 in 0.5 steps. */
const PERMANENT_OPTIONS: readonly number[] = Array.from(
  { length: (PERMANENT_MAX - PERMANENT_MIN) / PERMANENT_STEP + 1 },
  (_, index) => PERMANENT_MIN + index * PERMANENT_STEP,
);

/**
 * The Player Profile page: a full scouting report for a single player.
 *
 * @param props - See {@link PlayerProfilePageProps}.
 * @returns The player profile route composition, or the 404 page when the id is
 *   unknown.
 */
export function PlayerProfilePage({ playerId: playerIdProp }: PlayerProfilePageProps): JSX.Element {
  const { t } = useI18n();
  const services = useServices();
  const { session } = useAuth();

  const playerId = useMemo(
    () => playerIdProp ?? readPlayerIdFromPath(),
    [playerIdProp],
  );
  const year = new Date().getFullYear();

  const squadQuery = useQuery<Player[]>(() => services.squad.getSquad(), []);
  const scoresQuery = useQuery<GameScore[]>(() => services.scores.getAllGameScores(), []);
  const fixturesQuery = useQuery<Fixture[]>(() => services.fixtures.getFixtures(), []);
  const permanentQuery = useQuery<Map<string, PermanentAggregate>>(
    () => services.scores.getPermanentScores(year),
    [year],
  );

  // Permanent-rating form state (Requirements 21.1-21.3).
  const [permanentScore, setPermanentScore] = useState<number>(PERMANENT_DEFAULT);
  const [permanentMessage, setPermanentMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const player = useMemo<Player | null>(
    () => (squadQuery.data ?? []).find((p) => p.id === playerId) ?? null,
    [squadQuery.data, playerId],
  );

  const fixtureById = useMemo(() => {
    const map = new Map<string, Fixture>();
    for (const fixture of fixturesQuery.data ?? []) {
      map.set(fixture.id, fixture);
    }
    return map;
  }, [fixturesQuery.data]);

  const playerScores = useMemo(
    () => (scoresQuery.data ?? []).filter((score) => score.playerId === playerId),
    [scoresQuery.data, playerId],
  );

  const matches = useMemo(
    () => aggregatePlayerMatches(playerScores, fixtureById),
    [playerScores, fixtureById],
  );

  const squadLoading = squadQuery.loading && squadQuery.data === undefined;
  const analyticsLoading =
    (scoresQuery.loading && scoresQuery.data === undefined) ||
    (fixturesQuery.loading && fixturesQuery.data === undefined);

  // While the squad is still resolving we cannot know the player yet: show a
  // shape-preserving skeleton shell (Requirement 16.12).
  if (squadLoading) {
    return (
      <section className={styles.page} aria-busy="true">
        <Skeleton shape="card" />
        <div className={styles.sections}>
          <Skeleton shape="chart" />
          <Skeleton shape="list" count={4} />
          <Skeleton shape="chart" />
        </div>
      </section>
    );
  }

  // Unknown id → 404 with "Jogador não encontrado" (Requirement 16.14).
  if (player === null) {
    return <NotFoundPage variant="player" />;
  }

  // ---- Derived analytics (pure, from the domain layer) --------------------
  const perMatchAverages = matches.map((match) => match.average);
  const seasonAvg = matches.length > 0 ? calcAverage(perMatchAverages) : null;
  const totalVotes = playerScores.length;
  const rarity = calcRarity(seasonAvg);

  const profile = strengthsWeaknesses(playerScores);
  const best = bestMatch(playerScores);
  const worst = worstMatch(playerScores);

  const recentMatches = matches.slice(-TREND_WINDOW);
  const recentAvg = recentMatches.length > 0 ? calcAverage(recentMatches.map((m) => m.average)) : 0;
  const trendDelta = recentAvg - (seasonAvg ?? 0);
  const trendKind: TrendKind =
    matches.length < 2 || Math.abs(trendDelta) <= TREND_EPSILON
      ? 'stable'
      : trendDelta > 0
        ? 'up'
        : 'down';

  const consistency = matches.length > 0 ? Math.max(0, 10 - calcStdDev(perMatchAverages)) : 0;
  const radarSeries: RadarSeries[] = [
    {
      name: player.name,
      attributes: [
        { axis: t('player.radar.axis.average'), value: seasonAvg ?? 0 },
        { axis: t('player.radar.axis.peak'), value: best?.average ?? 0 },
        { axis: t('player.radar.axis.recent'), value: recentAvg },
        { axis: t('player.radar.axis.consistency'), value: consistency },
        { axis: t('player.radar.axis.floor'), value: worst?.average ?? 0 },
      ],
    },
  ];

  const recentForm = matches.slice(-RECENT_FORM_LIMIT).reverse();
  const evolutionPoints = buildEvolution(playerScores, fixturesQuery.data ?? []);
  const byCompetition = performanceByCompetition(matches);
  const histogramBins = buildHistogram(playerScores.map((score) => score.score));

  const permanentAggregate = permanentQuery.data?.get(playerId) ?? null;

  const trendLabelKey =
    trendKind === 'up' ? 'player.trend.up' : trendKind === 'down' ? 'player.trend.down' : 'player.trend.stable';

  /** Submits the current permanent rating for the player and this year (Requirement 21.3). */
  const submitPermanent = async (): Promise<void> => {
    if (session === null) {
      return;
    }
    setSubmitting(true);
    setPermanentMessage(null);
    const result = await services.scores.savePermanentScore({
      playerId: player.id,
      playerName: player.name,
      username: session.username,
      year,
      score: normalizeScore(permanentScore),
    });
    setSubmitting(false);
    if (result.ok) {
      setPermanentMessage({ kind: 'success', text: t('player.permanentScore.success') });
      permanentQuery.refetch();
    } else {
      // Duplicate submissions surface the translated "already rated" message
      // (Requirement 21.4); any other error is shown as-is.
      setPermanentMessage({ kind: 'error', text: result.error });
    }
  };

  return (
    <section className={styles.page} aria-busy={analyticsLoading}>
      <PlayerHeader player={player} seasonAvg={seasonAvg} rarity={rarity} />

      <div className={styles.sections}>
        {/* Attribute radar (Requirement 16.3). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.radar.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="chart" />
          ) : matches.length > 0 ? (
            <RadarChart series={radarSeries} />
          ) : (
            <EmptyState messageKey="state.noData" />
          )}
        </article>

        {/* Season summary (Requirement 16.4). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.seasonSummary.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="text" count={3} />
          ) : (
            <dl className={styles.summaryGrid}>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t('player.seasonAverage')}</dt>
                <dd className={styles.statValue}>
                  {seasonAvg !== null ? seasonAvg.toFixed(1) : t('state.noData')}
                </dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t('player.seasonSummary.matches')}</dt>
                <dd className={styles.statValue}>{matches.length}</dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t('player.votes')}</dt>
                <dd className={styles.statValue}>{totalVotes}</dd>
              </div>
            </dl>
          )}
        </article>

        {/* Strengths & weaknesses (Requirement 16.5). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.strengths.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="list" count={3} />
          ) : profile.strengths.length > 0 ? (
            <ul className={styles.list}>
              {profile.strengths.slice(0, RECENT_FORM_LIMIT).map((match) => (
                <li key={match.fixtureId} className={styles.listItem}>
                  <span className={styles.matchLabel}>
                    {match.homeTeam} x {match.awayTeam}
                  </span>
                  <span className={styles.matchScore}>{match.average.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState messageKey="state.noData" />
          )}
        </article>

        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.weaknesses.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="list" count={3} />
          ) : profile.weaknesses.length > 0 ? (
            <ul className={styles.list}>
              {profile.weaknesses.slice(0, RECENT_FORM_LIMIT).map((match) => (
                <li key={match.fixtureId} className={styles.listItem}>
                  <span className={styles.matchLabel}>
                    {match.homeTeam} x {match.awayTeam}
                  </span>
                  <span className={styles.matchScore}>{match.average.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState messageKey="state.noData" />
          )}
        </article>

        {/* Community trend (Requirement 16.6). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.trend.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="text" count={1} />
          ) : (
            <p className={`${styles.trend} ${styles[`trend_${trendKind}`]}`}>{t(trendLabelKey)}</p>
          )}
        </article>

        {/* Recent form — last 5 matches (Requirement 16.7). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.recentForm.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="list" count={RECENT_FORM_LIMIT} />
          ) : recentForm.length > 0 ? (
            <ul className={styles.list}>
              {recentForm.map((match) => (
                <li key={match.fixtureId} className={styles.listItem}>
                  <Link className={styles.matchLink} to={matchHref(match.fixtureId)}>
                    <span className={styles.matchLabel}>
                      {match.homeTeam} x {match.awayTeam}
                    </span>
                    {match.competition !== null && (
                      <CompetitionBadge competition={match.competition} />
                    )}
                    <span className={styles.matchDate}>{match.fixtureDate}</span>
                    <span className={styles.matchScore}>{match.average.toFixed(1)}</span>
                    <span className={styles.matchVotes}>
                      {match.votes} {t('player.votes')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState messageKey="player.recentForm.empty" />
          )}
        </article>

        {/* Performance timeline (Requirement 16.8). */}
        <article className={`${styles.section} ${styles.wide}`}>
          <h2 className={styles.sectionTitle}>{t('player.evolution.title')}</h2>
          {analyticsLoading ? <Skeleton shape="chart" /> : <LineChart points={evolutionPoints} />}
        </article>

        {/* Performance by competition (Requirement 16.9). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.byCompetition.title')}</h2>
          {analyticsLoading ? (
            <Skeleton shape="list" count={3} />
          ) : byCompetition.length > 0 ? (
            <ul className={styles.list}>
              {byCompetition.map((entry) => (
                <li key={entry.competition ?? 'unknown'} className={styles.listItem}>
                  <span className={styles.matchLabel}>
                    {entry.competition !== null ? (
                      <CompetitionBadge competition={entry.competition} />
                    ) : (
                      t('state.noData')
                    )}
                  </span>
                  <span className={styles.matchScore}>{entry.average.toFixed(1)}</span>
                  <span className={styles.matchVotes}>
                    {entry.votes} {t('player.votes')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState messageKey="state.noData" />
          )}
        </article>

        {/* Score distribution histogram (Requirement 16.11). */}
        <article className={`${styles.section} ${styles.wide}`}>
          <h2 className={styles.sectionTitle}>{t('player.histogram.title')}</h2>
          {analyticsLoading ? <Skeleton shape="chart" /> : <Histogram bins={histogramBins} />}
        </article>

        {/* Nota_Permanente (Requirements 21.1, 21.2). */}
        <article className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('player.permanentScore.title')}</h2>

          <dl className={styles.summaryGrid}>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>{t('player.permanentScore.average')}</dt>
              <dd className={styles.statValue}>
                {permanentAggregate !== null ? permanentAggregate.avg.toFixed(1) : t('state.noData')}
              </dd>
            </div>
            {permanentAggregate !== null && (
              <div className={styles.stat}>
                <dt className={styles.statLabel}>{t('player.votes')}</dt>
                <dd className={styles.statValue}>{permanentAggregate.votes}</dd>
              </div>
            )}
          </dl>

          {session !== null ? (
            <form
              className={styles.permForm}
              onSubmit={(event) => {
                event.preventDefault();
                void submitPermanent();
              }}
            >
              <label className={styles.permLabel} htmlFor="permanent-score">
                {t('player.permanentScore.scoreLabel')}
              </label>
              <select
                id="permanent-score"
                className={styles.permSelect}
                value={permanentScore}
                onChange={(event) => setPermanentScore(Number(event.target.value))}
              >
                {PERMANENT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value.toFixed(1)}
                  </option>
                ))}
              </select>
              <button type="submit" className={styles.permSubmit} disabled={submitting}>
                {t('player.permanentScore.submit')}
              </button>
              {permanentMessage !== null && (
                <p
                  className={
                    permanentMessage.kind === 'success' ? styles.permSuccess : styles.permError
                  }
                  role="status"
                >
                  {permanentMessage.text}
                </p>
              )}
            </form>
          ) : (
            <EmptyState messageKey="player.permanentScore.loginRequired" />
          )}
        </article>
      </div>
    </section>
  );
}
