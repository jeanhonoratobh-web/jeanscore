/**
 * `ColecoesPage` — Coleções route (`/colecoes`, Requirement 18).
 *
 * Composes the reusable {@link CollectionCard} into a grid that presents the
 * collectible collections of the squad. The collection catalog is **data-driven**
 * (Requirement 18.3): each entry is a {@link Collection} whose {@link CollectionFilter}
 * declares which players belong to it (by position, rarity or competition), so a
 * new collection is added by extending {@link COLLECTION_CATALOG} — never by
 * touching the rendering logic below.
 *
 * For every collection the page loads the squad and its per-match ratings to
 * compute how many of the collection's cards have already been **explored**
 * (i.e. players the community has rated), surfacing the exploration progress on
 * each card and highlighting collections that are still unexplored to encourage
 * discovery (Requirements 18.2, 18.6). Competition-scoped collections
 * additionally resolve membership from fixtures and their lineups.
 *
 * While data loads the page renders Carta_FIFA-shaped {@link Skeleton}s
 * (Requirement 18.5); a load failure with no cached value falls back to an
 * {@link EmptyState} with a retry action. All visible text is resolved through
 * {@link useI18n} (Requirement 2.4) and every visual value comes from
 * Design_Tokens via the co-located CSS module (Requirement 3.4).
 */
import { CollectionCard } from '@/components/cards';
import { EmptyState, Skeleton } from '@/components/feedback';
import { useServices, type Services } from '@/context/ServicesContext';
import { calcAverage } from '@/domain/scoring';
import { calcRarity } from '@/domain/rarity';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { Collection, CollectionFilter, GameScore, Player } from '@/types/domain';
import styles from './ColecoesPage.module.css';

/** Competition id for the Copa Libertadores fixtures. */
const LIBERTADORES_COMPETITION = 13;

/**
 * Data-driven catalog of collectible collections (Requirement 18.3).
 *
 * Ordered as shown to the user and covering the minimum required collections
 * (Requirement 18.1): Goalkeepers, Defenders, Legendary, Season and
 * Libertadores. Each `playerFilter` is a {@link CollectionFilter}; an empty
 * filter (Season) matches the whole squad. Adding a collection here is the only
 * change needed to display it.
 */
export const COLLECTION_CATALOG: readonly Collection[] = [
  { id: 'goalkeepers', titleKey: 'collection.goalkeepers.title', playerFilter: { position: 'Goalkeeper' } },
  { id: 'defenders', titleKey: 'collection.defenders.title', playerFilter: { position: 'Defender' } },
  { id: 'legendary', titleKey: 'collection.legendary.title', playerFilter: { rarity: 'legendary' } },
  { id: 'season', titleKey: 'collection.season.title', playerFilter: {} },
  {
    id: 'libertadores',
    titleKey: 'collection.libertadores.title',
    playerFilter: { competition: LIBERTADORES_COMPETITION },
  },
];

/** Exploration progress computed for a single collection. */
export interface CollectionProgress {
  /** The collection definition being reported. */
  readonly collection: Collection;
  /** Number of member players that have been explored (rated) so far. */
  readonly explored: number;
  /** Total number of member players in the collection. */
  readonly total: number;
}

/**
 * Groups every per-match rating by player id, preserving the raw scores so a
 * season average can be derived per player.
 *
 * @param scores - All per-match ratings in the system.
 * @returns A map of `playerId -> scores[]` (only players with at least one
 *   rating appear).
 */
function groupScoresByPlayer(scores: readonly GameScore[]): Map<string, number[]> {
  const byPlayer = new Map<string, number[]>();
  for (const score of scores) {
    const bucket = byPlayer.get(score.playerId);
    if (bucket === undefined) {
      byPlayer.set(score.playerId, [score.score]);
    } else {
      bucket.push(score.score);
    }
  }
  return byPlayer;
}

/**
 * Decides whether a player belongs to a collection given its
 * {@link CollectionFilter} (Requirement 18.3).
 *
 * Every provided filter field is an independent constraint applied with AND
 * logic: `position` matches the player's position, `rarity` matches the band
 * derived from the player's season average (an unrated player falls in
 * `'bronze'`, so it never matches `'legendary'`), and `competition` requires
 * the player to appear in that competition's membership set. An empty filter
 * matches every player.
 *
 * @param player - The squad player under test.
 * @param avg - The player's season average, or `null` when unrated.
 * @param competitionMembers - Player-id sets keyed by competition id.
 * @param filter - The collection's membership filter.
 * @returns `true` when the player satisfies every active constraint.
 */
function matchesCollection(
  player: Player,
  avg: number | null,
  competitionMembers: Map<number, Set<string>>,
  filter: CollectionFilter,
): boolean {
  if (filter.position !== undefined && player.position !== filter.position) {
    return false;
  }
  if (filter.rarity !== undefined && calcRarity(avg) !== filter.rarity) {
    return false;
  }
  if (filter.competition !== undefined) {
    const members = competitionMembers.get(filter.competition);
    if (members === undefined || !members.has(player.id)) {
      return false;
    }
  }
  return true;
}

/**
 * Loads squad and ratings (and, for competition-scoped collections, fixtures and
 * their lineups) and computes exploration progress for every catalog collection.
 *
 * A player counts toward a collection's `total` when it satisfies the
 * collection's filter, and toward `explored` when it additionally has at least
 * one rating — the community has "explored" that card (Requirement 18.2).
 *
 * @param services - The injected Services aggregate.
 * @param catalog - The data-driven collection catalog.
 * @returns One {@link CollectionProgress} per catalog collection, in catalog order.
 */
async function loadCollectionsProgress(
  services: Services,
  catalog: readonly Collection[],
): Promise<CollectionProgress[]> {
  const [squad, scores, fixtures] = await Promise.all([
    services.squad.getSquad(),
    services.scores.getAllGameScores(),
    services.fixtures.getFixtures(),
  ]);

  const scoresByPlayer = groupScoresByPlayer(scores);

  // Resolve membership sets only for the competitions referenced by the catalog.
  const competitions = new Set<number>();
  for (const { playerFilter } of catalog) {
    if (playerFilter.competition !== undefined) {
      competitions.add(playerFilter.competition);
    }
  }

  const competitionMembers = new Map<number, Set<string>>();
  await Promise.all(
    [...competitions].map(async (competition) => {
      const competitionFixtures = fixtures.filter((f) => f.competition === competition);
      const lineups = await Promise.all(
        competitionFixtures.map((fixture) => services.fixtures.getLineup(fixture.id)),
      );
      const memberIds = new Set<string>();
      for (const lineup of lineups) {
        for (const playerId of lineup.playerIds) {
          memberIds.add(playerId);
        }
      }
      competitionMembers.set(competition, memberIds);
    }),
  );

  return catalog.map((collection) => {
    let explored = 0;
    let total = 0;
    for (const player of squad) {
      const playerScores = scoresByPlayer.get(player.id);
      const avg = playerScores !== undefined ? calcAverage(playerScores) : null;
      if (matchesCollection(player, avg, competitionMembers, collection.playerFilter)) {
        total += 1;
        if (playerScores !== undefined) {
          explored += 1;
        }
      }
    }
    return { collection, explored, total };
  });
}

/**
 * Renders the Coleções page: a data-driven grid of {@link CollectionCard}s with
 * per-collection exploration progress, Skeletons while loading and an
 * {@link EmptyState} on failure (Requirement 18).
 *
 * @returns The Coleções page element.
 */
export function ColecoesPage(): JSX.Element {
  const { t } = useI18n();
  const services = useServices();
  const { data, loading, error, refetch } = useQuery<CollectionProgress[]>(
    () => loadCollectionsProgress(services, COLLECTION_CATALOG),
    [services],
  );

  return (
    <section className={styles.page} aria-labelledby="colecoes-title">
      <h1 id="colecoes-title" className={styles.title}>
        {t('collections.title')}
      </h1>

      {loading ? (
        <div className={styles.grid} aria-hidden="true">
          {COLLECTION_CATALOG.map((collection) => (
            <Skeleton key={collection.id} shape="card" />
          ))}
        </div>
      ) : error !== null && data === undefined ? (
        <EmptyState messageKey="state.error" actionKey="common.retry" onAction={refetch} />
      ) : data === undefined || data.length === 0 ? (
        <EmptyState messageKey="state.empty" />
      ) : (
        <div className={styles.grid}>
          {data.map(({ collection, explored }) => (
            <CollectionCard key={collection.id} collection={collection} explored={explored} />
          ))}
        </div>
      )}
    </section>
  );
}
