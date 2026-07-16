/**
 * `ElencoPage` — the collectible squad view (`pages/ElencoPage.tsx`, Requirement 15).
 *
 * Composes the reusable component library into the Elenco route: it loads the
 * full squad and every community rating through `useQuery` over the injected
 * Services, derives each player's Nota_da_Temporada (season average) and vote
 * count by aggregating the game scores with the pure `domain` layer, and renders
 * a responsive grid of {@link PlayerCard}s (Requirements 15.1, 15.3).
 *
 * All filtering and ordering happen **client-side** with no extra Supabase
 * round-trips (Requirements 14.1, 15.5): a position filter, a season-average
 * range, a minimum-votes threshold and a sort mode ("Por nota" / "Por posição")
 * are combined through the domain helpers {@link filterCombined} (AND logic,
 * Requirement 14.1) and {@link sortPlayers} (Requirements 15.6, 15.7). The live
 * result count is shown next to the filters (Requirement 14.7) and a "Limpar
 * filtros" action resets them (Requirement 14.5).
 *
 * While data loads the grid shows card-shaped {@link Skeleton}s (Requirement
 * 15.8); when the squad fails to load or comes back empty it shows an
 * {@link EmptyState} with the message "Não foi possível carregar o elenco" and a
 * "Tentar novamente" retry action (Requirement 15.10). Clicking a card navigates
 * to that player's profile (`/jogador/:id`) via a React Router {@link Link},
 * keeping navigation client-side (Requirement 15.9).
 *
 * Every visual value comes from Design_Tokens through the co-located CSS module
 * (Requirement 3.4) and every string is resolved via {@link useI18n}
 * (Requirements 2.4, 3.3).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerCard } from '@components/cards';
import { Button } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { calcAverage, filterCombined, sortPlayers } from '@domain/index';
import type {
  PlayerFilters,
  PositionFilter,
  SortMode,
} from '@domain/filters';
import { useServices } from '@/context/ServicesContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import type { GameScore, Player } from '@/types/domain';
import styles from './ElencoPage.module.css';

/** A squad player decorated with its season aggregates, ready for filter/sort. */
interface DecoratedPlayer extends Player {
  /** Nota_da_Temporada in `[0, 10]`, or `null` when the player has no ratings. */
  avg: number | null;
  /** Total number of individual ratings (Avaliações) received. */
  votes: number;
}

/** Per-player season aggregate keyed by player id. */
interface SeasonAggregate {
  avg: number | null;
  votes: number;
}

/** Number of skeleton cards shown while the squad loads (Requirement 15.8). */
const SKELETON_CARD_COUNT = 12;

/** Bounds of the season-average range filter (Requirement 14.2). */
const RATING_MIN = 0;
const RATING_MAX = 10;
const RATING_STEP = 0.5;

/** Position filter options in display order (Requirement 15.5). */
const POSITION_OPTIONS: ReadonlyArray<{ value: PositionFilter; labelKey: I18nKey }> = [
  { value: 'all', labelKey: 'squad.filter.position.all' },
  { value: 'Goalkeeper', labelKey: 'squad.filter.position.goalkeepers' },
  { value: 'Defender', labelKey: 'squad.filter.position.defenders' },
  { value: 'Midfielder', labelKey: 'squad.filter.position.midfielders' },
  { value: 'Attacker', labelKey: 'squad.filter.position.attackers' },
];

/** Sort options (Requirements 15.6, 15.7). */
const SORT_OPTIONS: ReadonlyArray<{ value: SortMode; labelKey: I18nKey }> = [
  { value: 'nota', labelKey: 'squad.sort.rating' },
  { value: 'posicao', labelKey: 'squad.sort.position' },
];

/** Minimum-votes threshold options (Requirement 14.3). `0` disables the filter. */
const MIN_VOTES_OPTIONS: readonly number[] = [0, 1, 3, 5, 10];

/**
 * Builds the season aggregate for every player that received at least one
 * rating.
 *
 * Mirrors the Nota_da_Temporada definition (Requirement 15.1): ratings are
 * grouped by fixture, averaged per fixture (the Nota_de_Jogo) via the pure
 * {@link calcAverage} helper, and those per-match averages are themselves
 * averaged into the season average. `votes` counts every individual rating.
 * Players absent from the map have no ratings and are treated as `avg: null`,
 * `votes: 0` by the caller.
 *
 * @param scores - All community ratings.
 * @returns Map of `playerId -> {@link SeasonAggregate}` for rated players.
 */
function aggregateSeason(scores: readonly GameScore[]): Map<string, SeasonAggregate> {
  const ratingsByPlayer = new Map<string, Map<string, number[]>>();

  for (const score of scores) {
    let byFixture = ratingsByPlayer.get(score.playerId);
    if (byFixture === undefined) {
      byFixture = new Map<string, number[]>();
      ratingsByPlayer.set(score.playerId, byFixture);
    }
    const existing = byFixture.get(score.fixtureId);
    if (existing === undefined) {
      byFixture.set(score.fixtureId, [score.score]);
    } else {
      existing.push(score.score);
    }
  }

  const aggregates = new Map<string, SeasonAggregate>();
  for (const [playerId, byFixture] of ratingsByPlayer) {
    let votes = 0;
    const perMatchAverages: number[] = [];
    for (const ratings of byFixture.values()) {
      votes += ratings.length;
      perMatchAverages.push(calcAverage(ratings));
    }
    aggregates.set(playerId, { avg: calcAverage(perMatchAverages), votes });
  }
  return aggregates;
}

/**
 * Builds the router-relative profile path for a player. It is consumed by a
 * React Router {@link Link}, so the router `basename` prepends the GitHub Pages
 * subpath automatically (Requirement 15.9).
 */
function playerHref(playerId: string): string {
  return `/jogador/${encodeURIComponent(playerId)}`;
}

/**
 * The Elenco page: a filterable, sortable grid of collectible player cards.
 *
 * @returns The Elenco route composition.
 */
export function ElencoPage(): JSX.Element {
  const { t } = useI18n();
  const services = useServices();

  const squad = useQuery<Player[]>(() => services.squad.getSquad(), []);
  const scores = useQuery<GameScore[]>(() => services.scores.getAllGameScores(), []);

  // Filter / sort UI state — all applied client-side (Requirements 14.1, 15.5).
  const [position, setPosition] = useState<PositionFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('nota');
  const [minRating, setMinRating] = useState<number>(RATING_MIN);
  const [maxRating, setMaxRating] = useState<number>(RATING_MAX);
  const [minVotes, setMinVotes] = useState<number>(0);

  // Aggregate ratings once per scores change (Requirement 15.1).
  const aggregates = useMemo(
    () => aggregateSeason(scores.data ?? []),
    [scores.data],
  );

  // Decorate each squad player with its season average and vote count.
  const decorated = useMemo<DecoratedPlayer[]>(() => {
    const players = squad.data ?? [];
    return players.map((player) => {
      const aggregate = aggregates.get(player.id);
      return {
        ...player,
        avg: aggregate?.avg ?? null,
        votes: aggregate?.votes ?? 0,
      };
    });
  }, [squad.data, aggregates]);

  // Combined AND filters + ordering, recomputed only when inputs change so the
  // grid updates instantly without any Supabase access (Requirements 14.1, 15.5).
  const visible = useMemo<DecoratedPlayer[]>(() => {
    const filters: PlayerFilters = { position };
    if (minRating > RATING_MIN) filters.minRating = minRating;
    if (maxRating < RATING_MAX) filters.maxRating = maxRating;
    if (minVotes > 0) filters.minVotes = minVotes;

    const filtered = filterCombined(decorated, filters);
    return sortPlayers(filtered, sortMode);
  }, [decorated, position, minRating, maxRating, minVotes, sortMode]);

  const isInitialLoading =
    (squad.loading && squad.data === undefined) ||
    (scores.loading && scores.data === undefined);

  const squadLoadFailed = squad.error !== null && squad.data === undefined;
  const squadIsEmpty = (squad.data ?? []).length === 0;

  const retry = (): void => {
    squad.refetch();
    scores.refetch();
  };

  const clearFilters = (): void => {
    setPosition('all');
    setSortMode('nota');
    setMinRating(RATING_MIN);
    setMaxRating(RATING_MAX);
    setMinVotes(0);
  };

  /** Clamp the min slider so it never crosses the max slider. */
  const handleMinRating = (value: number): void => {
    setMinRating(Math.min(value, maxRating));
  };

  /** Clamp the max slider so it never crosses the min slider. */
  const handleMaxRating = (value: number): void => {
    setMaxRating(Math.max(value, minRating));
  };

  return (
    <section className={styles.page} aria-busy={isInitialLoading}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('squad.title')}</h1>
        <p className={styles.subtitle}>{t('squad.subtitle')}</p>
      </header>

      {/* Filter bar — hidden only while the very first load has no data yet. */}
      {!isInitialLoading && !squadLoadFailed && !squadIsEmpty && (
        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="elenco-position">
              {t('filter.position')}
            </label>
            <select
              id="elenco-position"
              className={styles.select}
              value={position}
              onChange={(event) => setPosition(event.target.value as PositionFilter)}
            >
              {POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="elenco-sort">
              {t('filter.sortBy')}
            </label>
            <select
              id="elenco-sort"
              className={styles.select}
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="elenco-min-votes">
              {t('squad.filter.minVotes')}
            </label>
            <select
              id="elenco-min-votes"
              className={styles.select}
              value={minVotes}
              onChange={(event) => setMinVotes(Number(event.target.value))}
            >
              {MIN_VOTES_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 0
                    ? t('squad.filter.minVotesAny')
                    : t('squad.filter.minVotesAtLeast', { count: value })}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.field} ${styles.rangeField}`}>
            <span className={styles.fieldLabel}>{t('squad.filter.ratingRange')}</span>
            <div className={styles.rangeRow}>
              <span className={styles.rangeValue}>{minRating.toFixed(1)}</span>
              <input
                className={styles.rangeSlider}
                type="range"
                min={RATING_MIN}
                max={RATING_MAX}
                step={RATING_STEP}
                value={minRating}
                aria-label={`${t('squad.filter.ratingRange')} — ${t('common.filter')} min`}
                onChange={(event) => handleMinRating(Number(event.target.value))}
              />
              <span className={styles.rangeSep} aria-hidden="true">
                –
              </span>
              <input
                className={styles.rangeSlider}
                type="range"
                min={RATING_MIN}
                max={RATING_MAX}
                step={RATING_STEP}
                value={maxRating}
                aria-label={`${t('squad.filter.ratingRange')} — ${t('common.filter')} max`}
                onChange={(event) => handleMaxRating(Number(event.target.value))}
              />
              <span className={styles.rangeValue}>{maxRating.toFixed(1)}</span>
            </div>
          </div>

          <div className={styles.spacer} />

          <div className={styles.resultSummary}>
            <span className={styles.count} role="status">
              {t('squad.filter.resultCount', { count: visible.length })}
            </span>
            <Button variant="ghost" size="sm" labelKey="filter.clear" onClick={clearFilters} />
          </div>
        </div>
      )}

      {/* Loading: card-shaped skeleton grid (Requirement 15.8). */}
      {isInitialLoading && (
        <div className={styles.grid}>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <Skeleton key={index} shape="card" />
          ))}
        </div>
      )}

      {/* Empty / error: explicit state with retry (Requirement 15.10). */}
      {!isInitialLoading && (squadLoadFailed || squadIsEmpty) && (
        <EmptyState messageKey="squad.loadError" actionKey="common.retry" onAction={retry} />
      )}

      {/* No player matches the active filters (Requirement 14.7). */}
      {!isInitialLoading && !squadLoadFailed && !squadIsEmpty && visible.length === 0 && (
        <EmptyState messageKey="squad.noResults" />
      )}

      {/* Card grid — each card links to the player profile (Requirement 15.9). */}
      {!isInitialLoading && !squadLoadFailed && !squadIsEmpty && visible.length > 0 && (
        <div className={styles.grid}>
          {visible.map((player) => (
            <Link key={player.id} className={styles.cardLink} to={playerHref(player.id)}>
              <PlayerCard player={player} seasonAvg={player.avg} votes={player.votes} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
