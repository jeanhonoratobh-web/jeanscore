/**
 * `HomePage` — the product's landing composition (Requirement 11).
 *
 * A page-level composition (no bespoke visual elements — every piece is a
 * reusable library component, Requirement 3.5) that renders the mandatory
 * homepage hierarchy (Requirement 11.1):
 *
 *  1. Hero (`HeroSection`)
 *  2. Última Partida (`MatchCard`) — last finished fixture + community average (11.3)
 *  3. Jogador da Semana (`PlayerCard`) — top Nota_de_Jogo in the latest match (11.4)
 *  4. Time da Comunidade do Mês — preview with a link to the full view (11.5)
 *  5. Melhores Jogadores — the 5 highest season averages (`PlayerCard`) (11.6)
 *  6. Próxima Partida (`Countdown`) — live counter to the next fixture (11.7, 11.8)
 *  7. Atividade da Comunidade — recent community ratings (11.9)
 *  8. Jogadores em Alta — players with the strongest recent rise (11.9)
 *  9. Últimas Avaliações — most recently rated matches (`MatchCard`) (11.10)
 * 10. Navegação Rápida — shortcuts to Elenco, Jogos, Rankings, Avaliar (11.11)
 *
 * Data is loaded through {@link useQuery} over the injected Services (squad,
 * fixtures, scores); each section renders a {@link Skeleton} while its data is
 * loading (Requirement 11.12). Every derived value (last/next match, player of
 * the week, top players, trends, latest rated matches) is computed by the pure
 * `domain` layer or small local helpers, keeping the page a thin composition.
 *
 * Clicking any player in any section navigates to that player's profile at
 * `/jogador/:id` (Requirement 11.13); clicking a match navigates to
 * `/jogo/:id`. Navigation is client-side via React Router — card clicks use
 * {@link useNavigate} and the inline links use {@link Link} — so navigation
 * stays within the SPA (no reload) and resolves correctly under the configured
 * base path.
 *
 * All text is resolved via {@link useI18n} (Requirement 3.3) and every visual
 * value comes from Design_Tokens through the co-located CSS module
 * (Requirement 3.4).
 */
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import { useServices } from '@/context';
import { useQuery } from '@hooks/index';
import { HeroSection } from '@components/layout';
import { PlayerCard, MatchCard } from '@components/cards';
import { Countdown, Skeleton, EmptyState } from '@components/feedback';
import { buildRankings, trendingPlayers, calcAverage } from '@domain/index';
import type { Fixture, GameScore, Player } from '@/types/domain';
import styles from './HomePage.module.css';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Number of players shown in "Melhores Jogadores" (Requirement 11.6). */
const TOP_PLAYERS_LIMIT = 5;
/** Number of players shown in "Jogadores em Alta" (Requirement 11.9). */
const TRENDING_LIMIT = 5;
/** Number of entries shown in "Atividade da Comunidade" (Requirement 11.9). */
const ACTIVITY_LIMIT = 6;
/** Number of matches shown in "Últimas Avaliações" (Requirement 11.10). */
const LATEST_RATINGS_LIMIT = 3;

/** Route templates for router-agnostic navigation. */
const PLAYER_ROUTE = (playerId: string): string => `/jogador/${encodeURIComponent(playerId)}`;
const MATCH_ROUTE = (fixtureId: string): string => `/jogo/${encodeURIComponent(fixtureId)}`;

/** Quick-navigation shortcuts (Requirement 11.11). */
const QUICK_NAV: readonly { readonly href: string; readonly labelKey: I18nKey }[] = [
  { href: '/elenco', labelKey: 'home.quickNav.squad' },
  { href: '/jogos', labelKey: 'home.quickNav.matches' },
  { href: '/rankings', labelKey: 'home.quickNav.rankings' },
  { href: '/avaliar', labelKey: 'home.quickNav.rate' },
];

// ---------------------------------------------------------------------------
// Pure derivation helpers
// ---------------------------------------------------------------------------

/** A player's aggregated Nota_de_Jogo within a single match. */
interface PlayerMatchScore {
  readonly playerId: string;
  readonly avg: number;
  readonly votes: number;
}

/**
 * Returns the most recent finished fixture (by kickoff timestamp), or `null`
 * when the squad has no finished matches yet (Requirement 11.3).
 */
function findLastMatch(fixtures: Fixture[]): Fixture | null {
  const finished = fixtures.filter((fixture) => fixture.status === 'finished');
  if (finished.length === 0) {
    return null;
  }
  return finished.reduce((latest, fixture) => (fixture.ts > latest.ts ? fixture : latest));
}

/**
 * Returns the soonest fixture whose kickoff is still in the future relative to
 * `nowSeconds`, or `null` when none is scheduled (Requirement 11.7).
 */
function findNextMatch(fixtures: Fixture[], nowSeconds: number): Fixture | null {
  const upcoming = fixtures.filter((fixture) => fixture.ts > nowSeconds);
  if (upcoming.length === 0) {
    return null;
  }
  return upcoming.reduce((soonest, fixture) => (fixture.ts < soonest.ts ? fixture : soonest));
}

/**
 * Averages every individual rating submitted for a fixture (its community
 * Nota_de_Jogo média), or `null` when the fixture has no ratings.
 */
function matchAverage(scores: GameScore[], fixtureId: string): number | null {
  const values = scores.filter((score) => score.fixtureId === fixtureId).map((s) => s.score);
  return values.length === 0 ? null : calcAverage(values);
}

/**
 * Returns the player with the highest Nota_de_Jogo in the given fixture, i.e.
 * the "Jogador da Semana" for the latest match (Requirement 11.4), or `null`
 * when the fixture has no ratings.
 */
function playerOfMatch(scores: GameScore[], fixtureId: string): PlayerMatchScore | null {
  const byPlayer = new Map<string, number[]>();
  for (const score of scores) {
    if (score.fixtureId !== fixtureId) {
      continue;
    }
    const list = byPlayer.get(score.playerId);
    if (list) {
      list.push(score.score);
    } else {
      byPlayer.set(score.playerId, [score.score]);
    }
  }

  let best: PlayerMatchScore | null = null;
  for (const [playerId, ratings] of byPlayer) {
    const avg = calcAverage(ratings);
    if (best === null || avg > best.avg) {
      best = { playerId, avg, votes: ratings.length };
    }
  }
  return best;
}

/** Counts how many individual ratings each player received (for trend cards). */
function votesByPlayer(scores: GameScore[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const score of scores) {
    counts.set(score.playerId, (counts.get(score.playerId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Returns the fixture ids most recently rated by the community, newest first
 * (Requirement 11.10). A fixture's recency is the latest `createdAt` among its
 * ratings.
 */
function latestRatedFixtureIds(scores: GameScore[], limit: number): string[] {
  const latestByFixture = new Map<string, string>();
  for (const score of scores) {
    const current = latestByFixture.get(score.fixtureId);
    if (current === undefined || score.createdAt.localeCompare(current) > 0) {
      latestByFixture.set(score.fixtureId, score.createdAt);
    }
  }
  return [...latestByFixture.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, limit)
    .map(([fixtureId]) => fixtureId);
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

/** Props for the internal {@link Section} wrapper. */
interface SectionProps {
  readonly titleKey: I18nKey;
  readonly children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Renders the JeanScore homepage in the mandatory section hierarchy
 * (Requirement 11.1), wiring each section to the loaded squad, fixtures and
 * ratings and showing a per-section Skeleton while data loads.
 *
 * @returns The homepage element.
 */
export function HomePage(): JSX.Element {
  const { t } = useI18n();
  const navigate = useNavigate();
  const services = useServices();

  const squadQuery = useQuery<Player[]>(() => services.squad.getSquad(), [services]);
  const fixturesQuery = useQuery<Fixture[]>(() => services.fixtures.getFixtures(), [services]);
  const scoresQuery = useQuery<GameScore[]>(() => services.scores.getAllGameScores(), [services]);

  // Memoize the empty-array fallbacks so the derived `useMemo`s below keep a
  // stable input reference across renders (a fresh `?? []` would re-run them).
  const squad = useMemo(() => squadQuery.data ?? [], [squadQuery.data]);
  const fixtures = useMemo(() => fixturesQuery.data ?? [], [fixturesQuery.data]);
  const scores = useMemo(() => scoresQuery.data ?? [], [scoresQuery.data]);

  const loadingCore =
    squadQuery.loading || fixturesQuery.loading || scoresQuery.loading;

  /** Fast player lookup by id, shared by every player-driven section. */
  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const player of squad) {
      map.set(player.id, player);
    }
    return map;
  }, [squad]);

  const fixtureById = useMemo(() => {
    const map = new Map<string, Fixture>();
    for (const fixture of fixtures) {
      map.set(fixture.id, fixture);
    }
    return map;
  }, [fixtures]);

  const lastMatch = useMemo(() => findLastMatch(fixtures), [fixtures]);

  const nextMatch = useMemo(
    () => findNextMatch(fixtures, Math.floor(Date.now() / 1000)),
    [fixtures],
  );

  const playerOfWeek = useMemo(() => {
    if (lastMatch === null) {
      return null;
    }
    const best = playerOfMatch(scores, lastMatch.id);
    if (best === null) {
      return null;
    }
    const player = playerById.get(best.playerId);
    return player ? { player, avg: best.avg, votes: best.votes } : null;
  }, [lastMatch, scores, playerById]);

  const topPlayers = useMemo(
    () => buildRankings(scores, squad, fixtures).overallAverage.slice(0, TOP_PLAYERS_LIMIT),
    [scores, squad, fixtures],
  );

  const trending = useMemo(() => {
    const counts = votesByPlayer(scores);
    return trendingPlayers(scores, 'up')
      .slice(0, TRENDING_LIMIT)
      .map((trend) => ({
        trend,
        player: playerById.get(trend.playerId) ?? null,
        votes: counts.get(trend.playerId) ?? 0,
      }))
      .filter((entry): entry is { trend: typeof entry.trend; player: Player; votes: number } =>
        entry.player !== null,
      );
  }, [scores, playerById]);

  const recentActivity = useMemo(
    () =>
      scores
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, ACTIVITY_LIMIT),
    [scores],
  );

  const latestRated = useMemo(
    () =>
      latestRatedFixtureIds(scores, LATEST_RATINGS_LIMIT)
        .map((fixtureId) => fixtureById.get(fixtureId) ?? null)
        .filter((fixture): fixture is Fixture => fixture !== null),
    [scores, fixtureById],
  );

  /** Local section shell so headings and spacing stay consistent. */
  const Section = ({ titleKey, children }: SectionProps): JSX.Element => (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t(titleKey)}</h2>
      {children}
    </section>
  );

  return (
    <div className={styles.page}>
      {/* 1. Hero (Requirement 11.2) */}
      <HeroSection titleKey="home.hero.title" subtitleKey="home.hero.subtitle" />

      {/* 2. Última Partida (Requirement 11.3) */}
      <Section titleKey="home.lastMatch.title">
        {loadingCore ? (
          <Skeleton shape="card" />
        ) : lastMatch === null ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <MatchCard
            fixture={lastMatch}
            squadAverage={matchAverage(scores, lastMatch.id)}
            onClick={(id) => navigate(MATCH_ROUTE(id))}
          />
        )}
      </Section>

      {/* 3. Jogador da Semana (Requirement 11.4) */}
      <Section titleKey="home.playerOfWeek.title">
        {loadingCore ? (
          <Skeleton shape="card" />
        ) : playerOfWeek === null ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <PlayerCard
            player={playerOfWeek.player}
            seasonAvg={playerOfWeek.avg}
            votes={playerOfWeek.votes}
            variant="legendary"
            onClick={(id) => navigate(PLAYER_ROUTE(id))}
          />
        )}
      </Section>

      {/* 4. Time da Comunidade do Mês — preview (Requirement 11.5) */}
      <Section titleKey="home.teamOfMonth.title">
        <Link className={styles.previewLink} to="/time-do-mes">
          {t('home.teamOfMonth.seeFull')}
        </Link>
      </Section>

      {/* 5. Melhores Jogadores (Requirement 11.6) */}
      <Section titleKey="home.topPlayers.title">
        {loadingCore ? (
          <Skeleton shape="card" />
        ) : topPlayers.length === 0 ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <div className={styles.cardGrid}>
            {topPlayers.map((entry) => {
              const player = playerById.get(entry.playerId);
              if (!player) {
                return null;
              }
              return (
                <PlayerCard
                  key={entry.playerId}
                  player={player}
                  seasonAvg={entry.avg}
                  votes={entry.votes}
                  onClick={(id) => navigate(PLAYER_ROUTE(id))}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* 6. Próxima Partida (Requirements 11.7, 11.8) */}
      <Section titleKey="home.nextMatch.title">
        {loadingCore ? (
          <Skeleton shape="text" count={1} />
        ) : nextMatch === null ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <div className={styles.nextMatch}>
            <p className={styles.nextMatchTeams}>
              {nextMatch.homeTeam} × {nextMatch.awayTeam}
            </p>
            <Countdown targetTs={nextMatch.ts} onZero={fixturesQuery.refetch} />
          </div>
        )}
      </Section>

      {/* 7. Atividade da Comunidade (Requirement 11.9) */}
      <Section titleKey="home.communityActivity.title">
        {loadingCore ? (
          <Skeleton shape="list" count={ACTIVITY_LIMIT} />
        ) : recentActivity.length === 0 ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <ul className={styles.activityList}>
            {recentActivity.map((item, index) => (
              <li key={`${item.fixtureId}:${item.playerId}:${index}`} className={styles.activityItem}>
                <Link
                  className={styles.activityPlayer}
                  to={PLAYER_ROUTE(item.playerId)}
                >
                  {item.playerName}
                </Link>
                <span className={styles.activityMeta}>
                  {item.homeTeam} × {item.awayTeam}
                </span>
                <span className={styles.activityScore}>{item.score.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 8. Jogadores em Alta (Requirement 11.9) */}
      <Section titleKey="home.trendingPlayers.title">
        {loadingCore ? (
          <Skeleton shape="card" />
        ) : trending.length === 0 ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <div className={styles.cardGrid}>
            {trending.map(({ trend, player, votes }) => (
              <PlayerCard
                key={trend.playerId}
                player={player}
                seasonAvg={trend.seasonAvg}
                votes={votes}
                variant="compact"
                onClick={(id) => navigate(PLAYER_ROUTE(id))}
              />
            ))}
          </div>
        )}
      </Section>

      {/* 9. Últimas Avaliações (Requirement 11.10) */}
      <Section titleKey="home.latestRatings.title">
        {loadingCore ? (
          <Skeleton shape="list" count={LATEST_RATINGS_LIMIT} />
        ) : latestRated.length === 0 ? (
          <EmptyState messageKey="state.noData" />
        ) : (
          <div className={styles.cardGrid}>
            {latestRated.map((fixture) => (
              <MatchCard
                key={fixture.id}
                fixture={fixture}
                squadAverage={matchAverage(scores, fixture.id)}
                onClick={(id) => navigate(MATCH_ROUTE(id))}
              />
            ))}
          </div>
        )}
      </Section>

      {/* 10. Navegação Rápida (Requirement 11.11) */}
      <Section titleKey="home.quickNav.title">
        <nav className={styles.quickNav} aria-label={t('home.quickNav.title')}>
          {QUICK_NAV.map(({ href, labelKey }) => (
            <Link key={href} className={styles.quickNavLink} to={href}>
              {t(labelKey)}
            </Link>
          ))}
        </nav>
      </Section>
    </div>
  );
}
