/**
 * `CompararPage` — the player comparison view (`pages/CompararPage.tsx`,
 * Requirement 17).
 *
 * Composes the reusable component library into the `/comparar` route: the user
 * picks two players from squad dropdowns (Requirement 17.1) and the page renders
 * a scouting-style, side-by-side comparison that recomputes instantly whenever a
 * selection changes, with no page reload (Requirement 17.7).
 *
 * The page loads the squad, every community rating and every fixture through
 * `useQuery` over the injected Services, then derives each selected player's
 * season analytics with the pure `domain` layer (season average, vote count,
 * best/worst match, recent form, regularity and per-competition averages). It
 * shows:
 *
 * - a {@link PlayerCard} per player as an identity overview (Requirement 17.2);
 * - an overlaid {@link RadarChart} plotting both attribute profiles on shared
 *   axes for direct visual comparison (Requirement 17.3);
 * - two {@link LineChart}s comparing each player's chronological evolution
 *   across the season (Requirement 17.4);
 * - a {@link StatisticsPanel} that highlights, per metric, the player with the
 *   superior value (Requirement 17.5) and shows "Dados insuficientes" for any
 *   metric a player lacks data for, without interrupting the other metrics
 *   (Requirement 17.6).
 *
 * While data loads the sections show {@link Skeleton}s (Requirement 17.8); a
 * load failure surfaces an {@link EmptyState} with a retry action, and an
 * {@link EmptyState} prompt is shown until two players are selected.
 *
 * Every visual value comes from Design_Tokens through the co-located CSS module
 * (Requirement 3.4) and every string is resolved via {@link useI18n}
 * (Requirements 2.4, 3.3).
 */
import { useMemo, useState } from 'react';
import { PlayerCard } from '@components/cards';
import { LineChart, RadarChart, type RadarSeries } from '@components/charts';
import { StatisticsPanel, type LabeledStat } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import {
  bestMatch,
  buildEvolution,
  calcAverage,
  calcStdDev,
  worstMatch,
  type EvolutionPoint,
} from '@domain/index';
import { useServices } from '@/context/ServicesContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import type { Fixture, GameScore, Player } from '@/types/domain';
import styles from './CompararPage.module.css';

/** Number of most-recent matches averaged into the "Forma Recente" metric. */
const RECENT_WINDOW = 3;

/** Score-scale span used to invert standard deviation into a regularity value. */
const SCORE_MAX = 10;

/**
 * Per-competition i18n label map, mirroring {@link CompetitionBadge}. Only the
 * monitored competitions are comparable rows; unknown ids are skipped so every
 * label stays a valid {@link I18nKey}.
 */
const COMPETITION_LABEL: Readonly<Record<number, I18nKey>> = {
  71: 'competition.serieA',
  73: 'competition.copaDoBrasil',
  13: 'competition.libertadores',
  629: 'competition.mineiro',
  999: 'competition.friendly',
};

/**
 * A player's season analytics used across every comparison section.
 *
 * Every scalar metric is `null` when the player has no data for it, letting the
 * {@link StatisticsPanel} render "Dados insuficientes" without breaking the
 * remaining metrics (Requirement 17.6).
 */
interface PlayerStats {
  /** Total number of individual ratings (Avaliações) received. */
  votes: number;
  /** Nota_da_Temporada: mean of per-match averages, or `null` with no data. */
  seasonAvg: number | null;
  /** Highest Nota_de_Jogo of the season, or `null` with no data. */
  bestAvg: number | null;
  /** Lowest Nota_de_Jogo of the season, or `null` with no data. */
  worstAvg: number | null;
  /** Mean Nota_de_Jogo across the last {@link RECENT_WINDOW} matches, or `null`. */
  recentAvg: number | null;
  /** Regularity in `[0, 10]` (`10 - stdDev`, clamped), or `null` with no data. */
  consistency: number | null;
  /** Mean Nota_de_Jogo per competition id. */
  byCompetition: Map<number, number>;
  /** Chronological evolution points feeding the comparative line chart. */
  evolution: EvolutionPoint[];
}

/** Empty-stats value for an unselected slot or a player with no ratings. */
const EMPTY_STATS: PlayerStats = {
  votes: 0,
  seasonAvg: null,
  bestAvg: null,
  worstAvg: null,
  recentAvg: null,
  consistency: null,
  byCompetition: new Map(),
  evolution: [],
};

/**
 * Computes a player's season analytics from their ratings.
 *
 * Ratings are grouped into per-fixture Notas_de_Jogo via {@link buildEvolution}
 * (chronologically ordered using the fixtures), then reduced into the season
 * average, peak/floor match averages, recent form, regularity and
 * per-competition averages. Competition is resolved by joining each fixture id
 * to its {@link Fixture.competition}, since {@link GameScore} carries no
 * competition of its own.
 *
 * @param playerScores - Every rating belonging to a single player.
 * @param fixtures - All fixtures, used for chronological order and competition.
 * @returns The player's {@link PlayerStats}; {@link EMPTY_STATS} shape when empty.
 */
function computeStats(
  playerScores: GameScore[],
  fixtures: Fixture[],
): PlayerStats {
  if (playerScores.length === 0) {
    return EMPTY_STATS;
  }

  const evolution = buildEvolution(playerScores, fixtures);
  const matchAverages = evolution.map((point) => point.average);
  const votes = evolution.reduce((total, point) => total + point.votes, 0);

  const seasonAvg = matchAverages.length > 0 ? calcAverage(matchAverages) : null;
  const best = bestMatch(playerScores);
  const worst = worstMatch(playerScores);
  const recent = evolution.slice(-RECENT_WINDOW).map((point) => point.average);
  const recentAvg = recent.length > 0 ? calcAverage(recent) : null;
  const consistency =
    matchAverages.length > 0
      ? Math.min(SCORE_MAX, Math.max(0, SCORE_MAX - calcStdDev(matchAverages)))
      : null;

  const competitionById = new Map<string, number>();
  for (const fixture of fixtures) {
    competitionById.set(fixture.id, fixture.competition);
  }
  const averagesByCompetition = new Map<number, number[]>();
  for (const point of evolution) {
    const competition = competitionById.get(point.fixtureId);
    if (competition === undefined) {
      continue;
    }
    const list = averagesByCompetition.get(competition);
    if (list === undefined) {
      averagesByCompetition.set(competition, [point.average]);
    } else {
      list.push(point.average);
    }
  }
  const byCompetition = new Map<number, number>();
  for (const [competition, averages] of averagesByCompetition) {
    byCompetition.set(competition, calcAverage(averages));
  }

  return {
    votes,
    seasonAvg,
    bestAvg: best?.average ?? null,
    worstAvg: worst?.average ?? null,
    recentAvg,
    consistency,
    byCompetition,
    evolution,
  };
}

/** Builds a player's radar profile on the shared attribute axes. */
function toRadarSeries(
  name: string,
  stats: PlayerStats,
  labels: Record<'average' | 'best' | 'worst' | 'consistency' | 'form', string>,
): RadarSeries {
  return {
    name,
    attributes: [
      { axis: labels.average, value: stats.seasonAvg ?? 0 },
      { axis: labels.best, value: stats.bestAvg ?? 0 },
      { axis: labels.worst, value: stats.worstAvg ?? 0 },
      { axis: labels.consistency, value: stats.consistency ?? 0 },
      { axis: labels.form, value: stats.recentAvg ?? 0 },
    ],
  };
}

/**
 * The player comparison page: two selectors driving an overlaid radar,
 * comparative evolution lines and a winner-highlighting statistics panel.
 *
 * @returns The `/comparar` route composition.
 */
export function CompararPage(): JSX.Element {
  const { t } = useI18n();
  const services = useServices();

  const squad = useQuery<Player[]>(() => services.squad.getSquad(), []);
  const scores = useQuery<GameScore[]>(() => services.scores.getAllGameScores(), []);
  const fixtures = useQuery<Fixture[]>(() => services.fixtures.getFixtures(), []);

  const [firstId, setFirstId] = useState<string>('');
  const [secondId, setSecondId] = useState<string>('');

  const players = squad.data ?? [];
  const allScores = scores.data ?? [];
  const allFixtures = fixtures.data ?? [];

  // Group every rating by player once, so selecting/swapping a player only
  // re-reads a slice and never re-queries Supabase (Requirement 17.7).
  const scoresByPlayer = useMemo(() => {
    const map = new Map<string, GameScore[]>();
    for (const score of allScores) {
      const list = map.get(score.playerId);
      if (list === undefined) {
        map.set(score.playerId, [score]);
      } else {
        list.push(score);
      }
    }
    return map;
  }, [allScores]);

  const firstPlayer = players.find((player) => player.id === firstId) ?? null;
  const secondPlayer = players.find((player) => player.id === secondId) ?? null;

  const firstStats = useMemo(
    () =>
      firstPlayer === null
        ? EMPTY_STATS
        : computeStats(scoresByPlayer.get(firstPlayer.id) ?? [], allFixtures),
    [firstPlayer, scoresByPlayer, allFixtures],
  );
  const secondStats = useMemo(
    () =>
      secondPlayer === null
        ? EMPTY_STATS
        : computeStats(scoresByPlayer.get(secondPlayer.id) ?? [], allFixtures),
    [secondPlayer, scoresByPlayer, allFixtures],
  );

  const isInitialLoading =
    (squad.loading && squad.data === undefined) ||
    (scores.loading && scores.data === undefined) ||
    (fixtures.loading && fixtures.data === undefined);

  const loadFailed = squad.error !== null && squad.data === undefined;

  const bothSelected = firstPlayer !== null && secondPlayer !== null;

  const retry = (): void => {
    squad.refetch();
    scores.refetch();
    fixtures.refetch();
  };

  // Shared radar axis labels, resolved once (Requirements 3.3, 17.3).
  const radarLabels = {
    average: t('compare.axis.average'),
    best: t('compare.axis.best'),
    worst: t('compare.axis.worst'),
    consistency: t('compare.axis.consistency'),
    form: t('compare.axis.form'),
  } as const;

  const radarSeries: RadarSeries[] = bothSelected
    ? [
        toRadarSeries(firstPlayer.name, firstStats, radarLabels),
        toRadarSeries(secondPlayer.name, secondStats, radarLabels),
      ]
    : [];

  // Comparative statistics rows (Requirement 17.5); each `null` value renders as
  // "Dados insuficientes" via the StatisticsPanel (Requirement 17.6).
  const stats: LabeledStat[] = bothSelected
    ? [
        {
          labelKey: 'player.seasonAverage',
          left: firstStats.seasonAvg,
          right: secondStats.seasonAvg,
        },
        {
          labelKey: 'player.votes',
          left: firstStats.votes > 0 ? firstStats.votes : null,
          right: secondStats.votes > 0 ? secondStats.votes : null,
        },
        {
          labelKey: 'compare.metric.recentForm',
          left: firstStats.recentAvg,
          right: secondStats.recentAvg,
        },
        {
          labelKey: 'compare.metric.bestMatch',
          left: firstStats.bestAvg,
          right: secondStats.bestAvg,
        },
        {
          labelKey: 'compare.metric.worstMatch',
          left: firstStats.worstAvg,
          right: secondStats.worstAvg,
        },
        {
          labelKey: 'compare.metric.consistency',
          left: firstStats.consistency,
          right: secondStats.consistency,
        },
      ]
    : [];

  // Per-competition comparison rows over the union of both players' competitions
  // (Requirement 17.2); a competition only one player contested renders as
  // "Dados insuficientes" for the other (Requirement 17.6).
  const competitionStats: LabeledStat[] = useMemo(() => {
    if (!bothSelected) {
      return [];
    }
    const competitions = new Set<number>([
      ...firstStats.byCompetition.keys(),
      ...secondStats.byCompetition.keys(),
    ]);
    return [...competitions]
      .filter((competition) => COMPETITION_LABEL[competition] !== undefined)
      .sort((a, b) => a - b)
      .map((competition) => ({
        labelKey: COMPETITION_LABEL[competition],
        left: firstStats.byCompetition.get(competition) ?? null,
        right: secondStats.byCompetition.get(competition) ?? null,
      }));
  }, [bothSelected, firstStats, secondStats]);

  return (
    <section className={styles.page} aria-busy={isInitialLoading}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('compare.title')}</h1>
        <p className={styles.subtitle}>{t('compare.subtitle')}</p>
      </header>

      {/* Player selectors — always available once the squad loads (Requirement 17.1). */}
      {!isInitialLoading && !loadFailed && (
        <div className={styles.selectors}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="compare-first">
              {t('compare.selectFirst')}
            </label>
            <select
              id="compare-first"
              className={styles.select}
              value={firstId}
              onChange={(event) => setFirstId(event.target.value)}
            >
              <option value="">{t('compare.selectFirst')}</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>

          <span className={styles.versus} aria-hidden="true">
            ×
          </span>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="compare-second">
              {t('compare.selectSecond')}
            </label>
            <select
              id="compare-second"
              className={styles.select}
              value={secondId}
              onChange={(event) => setSecondId(event.target.value)}
            >
              <option value="">{t('compare.selectSecond')}</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Loading: section skeletons (Requirement 17.8). */}
      {isInitialLoading && (
        <div className={styles.skeletons}>
          <Skeleton shape="card" count={2} />
          <Skeleton shape="chart" />
          <Skeleton shape="chart" />
        </div>
      )}

      {/* Load failure: explicit state with retry. */}
      {!isInitialLoading && loadFailed && (
        <EmptyState messageKey="compare.loadError" actionKey="common.retry" onAction={retry} />
      )}

      {/* Prompt until two players are selected (Requirement 17.1). */}
      {!isInitialLoading && !loadFailed && !bothSelected && (
        <EmptyState messageKey="compare.selectPrompt" />
      )}

      {/* Full comparison (Requirements 17.2-17.6). */}
      {!isInitialLoading && !loadFailed && bothSelected && (
        <div className={styles.comparison}>
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>{t('compare.overview.title')}</h2>
            <div className={styles.overview}>
              <PlayerCard
                player={firstPlayer}
                seasonAvg={firstStats.seasonAvg}
                votes={firstStats.votes}
              />
              <PlayerCard
                player={secondPlayer}
                seasonAvg={secondStats.seasonAvg}
                votes={secondStats.votes}
              />
            </div>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>{t('compare.radar.title')}</h2>
            <RadarChart series={radarSeries} />
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>{t('compare.evolution.title')}</h2>
            <div className={styles.evolution}>
              <figure className={styles.evolutionItem}>
                <figcaption className={styles.evolutionCaption}>
                  {firstPlayer.name}
                </figcaption>
                <LineChart points={firstStats.evolution} />
              </figure>
              <figure className={styles.evolutionItem}>
                <figcaption className={styles.evolutionCaption}>
                  {secondPlayer.name}
                </figcaption>
                <LineChart points={secondStats.evolution} />
              </figure>
            </div>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>{t('compare.stats.title')}</h2>
            <div className={styles.names}>
              <span className={styles.name}>{firstPlayer.name}</span>
              <span />
              <span className={styles.name}>{secondPlayer.name}</span>
            </div>
            <StatisticsPanel stats={stats} />
          </section>

          {competitionStats.length > 0 && (
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>{t('compare.byCompetition.title')}</h2>
              <StatisticsPanel stats={competitionStats} />
            </section>
          )}
        </div>
      )}
    </section>
  );
}
