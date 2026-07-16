/**
 * `RankingsPage` — the rankings route (`/rankings`) (Requirement 26).
 *
 * Loads the three data sets the expanded rankings are computed from — the
 * community ratings ({@link GameScore}[] via {@link ScoreService.getAllGameScores}),
 * the canonical squad ({@link Player}[] via {@link SquadService.getSquad}) and the
 * fixtures ({@link Fixture}[] via {@link FixtureService.getFixtures}) — each through
 * {@link useQuery} (a single Supabase read, served from cache with a stale
 * fallback, Requirements 1.7, 1.8). Every ranking category is then derived
 * **purely client-side** by the domain function {@link buildRankings}
 * (Requirement 26.1): Melhor Média Geral, Mais Consistente, Mais Votos, Melhor
 * por Posição and the "Partida Mais Bem Avaliada" list (Requirement 26.4).
 *
 * A competition filter narrows the ranking: selecting a competition recomputes
 * **all** categories via `buildRankings(scores, players, fixtures, competition)`
 * with no additional network request (Requirement 26.3). A name search box
 * filters the player lists in real time using the accent- and case-insensitive
 * domain {@link search} helper, without a form submission (Requirement 26.9);
 * the podiums keep showing each category's actual leaders (Requirement 26.2).
 *
 * Each player category renders a {@link Podium} for the top three
 * (Requirement 26.2) followed by a {@link RankingCard} list showing at least the
 * top ten (Requirement 26.5). Player rows link to `/jogador/:id` and best-rated
 * matches link to `/jogo/:id` through React Router {@link Link}s, keeping
 * navigation client-side (Requirements 26.6, 26.7). {@link Skeleton}s reserve the
 * layout while the reads are in flight (Requirement 26.8) and an
 * {@link EmptyState} covers the empty and load-error cases. All text resolves
 * through {@link useI18n} (Requirement 3.3) and every visual value comes from
 * Design_Tokens via the co-located CSS module (Requirement 3.4).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RankingCard } from '@components/cards';
import { CompetitionBadge } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { Podium } from '@components/layout';
import { useServices } from '@context/index';
import { buildRankings, type BestRatedMatch, type RankingSet } from '@/domain/ranking';
import { search } from '@/domain/search';
import { useQuery } from '@hooks/useQuery';
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import type { Fixture, GameScore, Player, Position, RankingEntry } from '@/types/domain';
import styles from './RankingsPage.module.css';

/** Sentinel selection meaning "all competitions" (no competition filter). */
const ALL_COMPETITIONS = 'all' as const;

/** The active competition filter: a competition id, or "all". */
type CompetitionFilter = number | typeof ALL_COMPETITIONS;

/** Minimum number of player rows shown per category (Requirement 26.5). */
const MIN_VISIBLE_ENTRIES = 10;

/** Field positions ranked by the "Melhor por Posição" category, in display order. */
const POSITIONS: readonly Position[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

/** Maps a {@link Position} to its full-name i18n label key. */
const POSITION_KEY: Record<Position, I18nKey> = {
  Goalkeeper: 'position.goalkeeper',
  Defender: 'position.defender',
  Midfielder: 'position.midfielder',
  Attacker: 'position.attacker',
};

/** A single player-ranking category to render (podium + list). */
interface PlayerCategory {
  /** Stable identifier for the React key. */
  readonly id: string;
  /** Section heading, already resolved to a pt-BR string. */
  readonly title: string;
  /** The full, ranked entries of the category. */
  readonly entries: readonly RankingEntry[];
}

/**
 * Returns the distinct competition ids present in a list of fixtures, preserving
 * first-seen order so the filter chips render deterministically.
 *
 * @param fixtures - Fixtures to scan.
 * @returns Ordered, de-duplicated competition ids.
 */
function distinctCompetitions(fixtures: readonly Fixture[]): number[] {
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const fixture of fixtures) {
    if (!seen.has(fixture.competition)) {
      seen.add(fixture.competition);
      ordered.push(fixture.competition);
    }
  }
  return ordered;
}

/**
 * Filters ranking entries by player name using the accent- and case-insensitive
 * domain {@link search} helper (Requirements 13.9, 26.9). An empty or
 * whitespace-only term returns the entries unchanged.
 *
 * @param entries - The category entries to filter.
 * @param term - The raw, user-provided search term.
 * @returns The matching subset, in original (ranked) order.
 */
function filterByName(
  entries: readonly RankingEntry[],
  term: string,
): RankingEntry[] {
  if (term.trim() === '') {
    return [...entries];
  }
  return search(entries, term, (entry) => [entry.playerName]);
}

/**
 * Renders one player-ranking category: its podium and the ranked list.
 *
 * The podium always reflects the category's true top three so the leaders stay
 * visible regardless of the active search (Requirement 26.2). The list below is
 * filtered by the search term and shows at least the top ten entries
 * (Requirements 26.5, 26.9); each row links to the player's profile
 * (Requirement 26.6). When the search excludes every entry an
 * {@link EmptyState} is shown for the category.
 *
 * @param props.category - The category to render.
 * @param props.searchTerm - The current name filter.
 * @returns The category section element.
 */
function RankingCategorySection({
  category,
  searchTerm,
}: {
  category: PlayerCategory;
  searchTerm: string;
}): JSX.Element {
  const top3 = category.entries.slice(0, 3);
  const filtered = filterByName(category.entries, searchTerm);
  const visible = filtered.slice(0, Math.max(MIN_VISIBLE_ENTRIES, filtered.length));

  return (
    <section className={styles.category} aria-label={category.title}>
      <h2 className={styles.categoryTitle}>{category.title}</h2>

      {top3.length > 0 && <Podium top3={top3} />}

      {visible.length === 0 ? (
        <EmptyState messageKey="state.empty" />
      ) : (
        <ul className={styles.list}>
          {visible.map((entry) => (
            <li key={entry.playerId} className={styles.item}>
              <Link className={styles.rowLink} to={`/jogador/${entry.playerId}`}>
                <RankingCard entry={entry} rank={entry.rank} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Renders the "Partida Mais Bem Avaliada" category: the top fixtures by average
 * lineup Nota_de_Jogo (Requirement 26.4). Each match links to its detail page
 * (Requirement 26.7).
 *
 * @param props.matches - The best-rated matches to render.
 * @returns The best-matches section element.
 */
function BestRatedMatchesSection({
  matches,
}: {
  matches: readonly BestRatedMatch[];
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section className={styles.category} aria-label={t('rankings.bestMatch')}>
      <h2 className={styles.categoryTitle}>{t('rankings.bestMatch')}</h2>

      {matches.length === 0 ? (
        <EmptyState messageKey="state.empty" />
      ) : (
        <ul className={styles.list}>
          {matches.map((match) => (
            <li key={match.fixtureId} className={styles.item}>
              <Link className={styles.rowLink} to={`/jogo/${match.fixtureId}`}>
                <div className={styles.matchRow}>
                  <span className={styles.matchRank}>{match.rank}</span>
                  <div className={styles.matchIdentity}>
                    <span className={styles.matchTeams}>
                      {match.homeTeam} × {match.awayTeam}
                    </span>
                    {match.competition !== null && (
                      <CompetitionBadge competition={match.competition} />
                    )}
                  </div>
                  <div className={styles.matchMetrics}>
                    <span className={styles.matchAvg}>{match.avg.toFixed(1)}</span>
                    <span className={styles.matchVotes}>
                      {match.votes} {t('player.votes')}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Renders the rankings page: competition filter, name search, every player
 * category (podium + list) and the best-rated matches.
 *
 * @returns The page element.
 */
export function RankingsPage(): JSX.Element {
  const { t } = useI18n();
  const { scores: scoreService, squad: squadService, fixtures: fixtureService } = useServices();

  const {
    data: scores,
    loading: scoresLoading,
    error: scoresError,
    refetch: refetchScores,
  } = useQuery<GameScore[]>(() => scoreService.getAllGameScores(), []);

  const { data: players, loading: playersLoading } = useQuery<Player[]>(
    () => squadService.getSquad(),
    [],
  );

  const { data: fixtures, loading: fixturesLoading } = useQuery<Fixture[]>(
    () => fixtureService.getFixtures(),
    [],
  );

  const [competition, setCompetition] = useState<CompetitionFilter>(ALL_COMPETITIONS);
  const [searchTerm, setSearchTerm] = useState('');

  const allScores = useMemo<GameScore[]>(() => scores ?? [], [scores]);
  const allPlayers = useMemo<Player[]>(() => players ?? [], [players]);
  const allFixtures = useMemo<Fixture[]>(() => fixtures ?? [], [fixtures]);

  const competitions = useMemo(() => distinctCompetitions(allFixtures), [allFixtures]);

  // Recompute every ranking category client-side whenever the data or the
  // selected competition change — no additional network request (Req. 26.3).
  const rankings = useMemo<RankingSet>(
    () =>
      buildRankings(
        allScores,
        allPlayers,
        allFixtures,
        competition === ALL_COMPETITIONS ? undefined : competition,
      ),
    [allScores, allPlayers, allFixtures, competition],
  );

  const playerCategories = useMemo<PlayerCategory[]>(() => {
    const categories: PlayerCategory[] = [
      { id: 'overall', title: t('rankings.category.overall'), entries: rankings.overallAverage },
      {
        id: 'mostConsistent',
        title: t('rankings.category.mostConsistent'),
        entries: rankings.mostConsistent,
      },
      { id: 'mostVotes', title: t('rankings.category.mostVotes'), entries: rankings.mostVotes },
    ];
    for (const position of POSITIONS) {
      categories.push({
        id: `position-${position}`,
        title: `${t('rankings.category.byPosition')} · ${t(POSITION_KEY[position])}`,
        entries: rankings.bestByPosition[position],
      });
    }
    return categories;
  }, [rankings, t]);

  // The rankings depend on the ratings; block on that read for the skeleton and
  // the error/empty states. The squad and fixtures only enrich the output.
  const isLoading =
    (scoresLoading || playersLoading || fixturesLoading) && allScores.length === 0;
  const hasError = scoresError !== null && allScores.length === 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('rankings.title')}</h1>

      <div className={styles.controls}>
        <div className={styles.filters} role="group" aria-label={t('filter.competition')}>
          <span className={styles.filterLabel}>{t('filter.competition')}</span>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={competition === ALL_COMPETITIONS}
            onClick={() => setCompetition(ALL_COMPETITIONS)}
          >
            {t('filter.all')}
          </button>
          {competitions.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.chip}
              aria-pressed={competition === id}
              onClick={() => setCompetition(id)}
            >
              <CompetitionBadge competition={id} />
            </button>
          ))}
        </div>

        <div className={styles.searchField}>
          <label className={styles.searchLabel} htmlFor="rankings-search">
            {t('rankings.searchByName')}
          </label>
          <input
            id="rankings-search"
            type="search"
            className={styles.searchInput}
            value={searchTerm}
            placeholder={t('rankings.searchByName')}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className={styles.categories}>
          <Skeleton shape="list" count={3} />
          <Skeleton shape="list" count={3} />
        </div>
      ) : hasError ? (
        <EmptyState messageKey="state.error" actionKey="common.retry" onAction={refetchScores} />
      ) : (
        <div className={styles.categories}>
          {playerCategories.map((category) => (
            <RankingCategorySection
              key={category.id}
              category={category}
              searchTerm={searchTerm}
            />
          ))}

          <BestRatedMatchesSection matches={rankings.bestRatedMatches} />
        </div>
      )}
    </div>
  );
}
