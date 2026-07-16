/**
 * Ranking domain module.
 *
 * Pure, framework-agnostic computation of the expanded rankings shown on the
 * Rankings page (Requirement 26). Given the community ratings
 * ({@link GameScore}[]), the canonical squad ({@link Player}[]) and — optionally
 * — the fixtures ({@link Fixture}[]), {@link buildRankings} derives every ranking
 * category in a single pass:
 *
 *  - **Melhor Média Geral** — players ordered by season average, i.e. the mean
 *    of their per-match Notas_de_Jogo (Requirement 26.1).
 *  - **Mais Consistente** — players ordered by the lowest standard deviation of
 *    their per-match Notas_de_Jogo, restricted to players with at least
 *    {@link MIN_MATCHES_FOR_CONSISTENCY} matches rated, via
 *    {@link calcStdDev} (Requirements 26.1, 26.10).
 *  - **Mais Votos** — players ordered by the total number of individual ratings
 *    received (Requirement 26.1).
 *  - **Melhor por Posição** — the best player per {@link Position}, ordered by
 *    season average, considering only players with at least one vote
 *    (Requirements 26.1, 26.10).
 *  - **Partida Mais Bem Avaliada** — the top {@link BEST_RATED_MATCHES_LIMIT}
 *    fixtures by average lineup Nota_de_Jogo (Requirement 26.4).
 *
 * When a `competition` is supplied together with `fixtures`, the ratings are
 * filtered to that competition and every category is recomputed from the
 * filtered set, with no additional data access (Requirement 26.3).
 *
 * Living in the pure `domain` layer, this module imports ONLY from `types` and
 * from the sibling `scoring` module ({@link calcAverage}, {@link calcStdDev});
 * it has no dependency on React, the DOM, services or the network
 * (Requirement 1.2).
 *
 * @see Requirements 26.1, 26.2, 26.3, 26.4, 26.10.
 */

import type { Fixture, GameScore, Player, Position, RankingEntry } from '../types/domain';
import { calcAverage, calcStdDev } from './scoring';

/** Minimum number of rated matches required for the "Mais Consistente" category (Requirement 26.10). */
const MIN_MATCHES_FOR_CONSISTENCY = 3;

/** Number of fixtures returned in the "Partida Mais Bem Avaliada" category (Requirement 26.4). */
const BEST_RATED_MATCHES_LIMIT = 5;

/** Field positions ranked by the "Melhor por Posição" category, in display order. */
const POSITIONS: readonly Position[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

/**
 * A single fixture in the "Partida Mais Bem Avaliada" category (Requirement 26.4).
 *
 * `avg` is the average lineup Nota_de_Jogo: the mean over all rated players of
 * that player's average rating in the fixture. `competition` is resolved from
 * the supplied fixtures when available, otherwise `null`.
 */
export interface BestRatedMatch {
  /** Identifier of the fixture (used to navigate to its detail page, Requirement 26.7). */
  fixtureId: string;
  /** Home team name, carried through from the ratings. */
  homeTeam: string;
  /** Away team name, carried through from the ratings. */
  awayTeam: string;
  /** Fixture date, carried through from the ratings. */
  fixtureDate: string;
  /** Numeric competition id, or `null` when fixtures were not supplied. */
  competition: number | null;
  /** Average lineup Nota_de_Jogo for the fixture. */
  avg: number;
  /** Total number of individual ratings submitted for the fixture. */
  votes: number;
  /** 1-based position within the category. */
  rank: number;
}

/**
 * The complete set of rankings for the Rankings page (Requirement 26).
 *
 * Player lists are returned in full (not truncated) so the UI can show at least
 * the top ten of each category (Requirement 26.5); `bestRatedMatches` is capped
 * at {@link BEST_RATED_MATCHES_LIMIT} (Requirement 26.4).
 */
export interface RankingSet {
  /** Players ordered by season average, descending (Melhor Média Geral). */
  overallAverage: RankingEntry[];
  /** Players ordered by consistency (lowest std. dev. first), min. 3 matches (Mais Consistente). */
  mostConsistent: RankingEntry[];
  /** Players ordered by total votes, descending (Mais Votos). */
  mostVotes: RankingEntry[];
  /** The best players per position, each list ordered by season average, descending (Melhor por Posição). */
  bestByPosition: Record<Position, RankingEntry[]>;
  /** The top fixtures by average lineup Nota_de_Jogo (Partida Mais Bem Avaliada). */
  bestRatedMatches: BestRatedMatch[];
}

/**
 * Internal, per-player aggregation of ratings used to build every player
 * ranking category.
 */
interface PlayerAggregate {
  /** The canonical squad player. */
  player: Player;
  /** Total number of individual ratings received across all fixtures. */
  votes: number;
  /** Number of distinct fixtures the player was rated in. */
  matchesRated: number;
  /** Season average: mean of the per-match Notas_de_Jogo. */
  avg: number;
  /** Standard deviation of the per-match Notas_de_Jogo (consistency). */
  stdDev: number;
}

/**
 * Builds every ranking category from the community ratings (Requirement 26).
 *
 * Rankings are computed over the canonical squad: only players present in
 * `players` are ranked, and each is aggregated from its {@link GameScore}
 * ratings. A player's season average and consistency are computed from its
 * per-match Notas_de_Jogo (the mean of the individual ratings within each
 * fixture), matching the Nota_da_Temporada definition; `votes` counts every
 * individual rating received.
 *
 * When `competition` is provided together with `fixtures`, the ratings are
 * first filtered to fixtures of that competition and all categories are
 * recomputed from the filtered set, without any additional data access
 * (Requirement 26.3). If `competition` is omitted, all ratings are considered.
 * `fixtures` is also used to tag each {@link BestRatedMatch} with its
 * competition; when omitted, competition filtering is a no-op and match
 * competitions are reported as `null`.
 *
 * The function is pure and deterministic: ties are broken by votes (desc), then
 * player name and id (asc) for players, and by date (newer first) then id for
 * matches, so the same input always yields the same ordering.
 *
 * @param scores - Community ratings (Notas_de_Jogo) to rank.
 * @param players - The canonical squad; only these players are ranked.
 * @param fixtures - Optional fixtures, used for the competition filter
 *   (Requirement 26.3) and to tag matches with their competition. Defaults to
 *   an empty list.
 * @param competition - Optional competition id; when set, only ratings of
 *   fixtures in this competition are considered.
 * @returns The complete {@link RankingSet} for every category.
 *
 * @example
 * const rankings = buildRankings(scores, squad);
 * rankings.overallAverage[0]; // top player by season average
 *
 * @example
 * // Recompute for Série A only (competition id 71) without new data access.
 * const serieA = buildRankings(scores, squad, fixtures, 71);
 */
export function buildRankings(
  scores: GameScore[],
  players: Player[],
  fixtures: Fixture[] = [],
  competition?: number,
): RankingSet {
  const competitionByFixture = new Map<string, number>(
    fixtures.map((fixture) => [fixture.id, fixture.competition]),
  );

  const relevantScores =
    competition === undefined
      ? scores
      : scores.filter((score) => competitionByFixture.get(score.fixtureId) === competition);

  const aggregates = aggregatePlayers(relevantScores, players);
  const eligible = aggregates.filter((aggregate) => aggregate.votes > 0);

  const overallAverage = rankEntries(eligible, (a, b) => b.avg - a.avg);
  const mostVotes = rankEntries(eligible, (a, b) => b.votes - a.votes);
  const mostConsistent = rankEntries(
    eligible.filter((aggregate) => aggregate.matchesRated >= MIN_MATCHES_FOR_CONSISTENCY),
    (a, b) => a.stdDev - b.stdDev,
  );

  const bestByPosition = {} as Record<Position, RankingEntry[]>;
  for (const position of POSITIONS) {
    bestByPosition[position] = rankEntries(
      eligible.filter((aggregate) => aggregate.player.position === position),
      (a, b) => b.avg - a.avg,
    );
  }

  const bestRatedMatches = buildBestRatedMatches(relevantScores, competitionByFixture);

  return { overallAverage, mostConsistent, mostVotes, bestByPosition, bestRatedMatches };
}

/**
 * Aggregates the ratings of every squad player, grouping by fixture so that a
 * player's per-match Notas_de_Jogo can drive the season average and the
 * consistency (standard deviation) metrics.
 *
 * Ratings referencing players absent from `players` are ignored, since rankings
 * are defined over the canonical squad. Players with no ratings yield a
 * zero-vote aggregate and are filtered out downstream by the eligibility rule.
 *
 * @param scores - Ratings to aggregate.
 * @param players - The canonical squad.
 * @returns One {@link PlayerAggregate} per squad player.
 */
function aggregatePlayers(scores: GameScore[], players: Player[]): PlayerAggregate[] {
  const ratingsByPlayer = new Map<string, Map<string, number[]>>();

  for (const score of scores) {
    let byFixture = ratingsByPlayer.get(score.playerId);
    if (!byFixture) {
      byFixture = new Map<string, number[]>();
      ratingsByPlayer.set(score.playerId, byFixture);
    }
    const existing = byFixture.get(score.fixtureId);
    if (existing) {
      existing.push(score.score);
    } else {
      byFixture.set(score.fixtureId, [score.score]);
    }
  }

  return players.map((player) => {
    const byFixture = ratingsByPlayer.get(player.id);
    if (!byFixture) {
      return { player, votes: 0, matchesRated: 0, avg: 0, stdDev: 0 };
    }

    let votes = 0;
    const perMatchAverages: number[] = [];
    for (const ratings of byFixture.values()) {
      votes += ratings.length;
      perMatchAverages.push(calcAverage(ratings));
    }

    return {
      player,
      votes,
      matchesRated: perMatchAverages.length,
      avg: calcAverage(perMatchAverages),
      stdDev: calcStdDev(perMatchAverages),
    };
  });
}

/**
 * Sorts player aggregates by a primary comparator, applies deterministic
 * tie-breakers (votes desc, then name and id asc) and assigns a 1-based rank to
 * each resulting {@link RankingEntry}.
 *
 * @param aggregates - The eligible aggregates to rank.
 * @param primary - Primary comparator; return `< 0` to place `a` before `b`.
 * @returns The ranked entries, in order.
 */
function rankEntries(
  aggregates: PlayerAggregate[],
  primary: (a: PlayerAggregate, b: PlayerAggregate) => number,
): RankingEntry[] {
  const sorted = [...aggregates].sort((a, b) => {
    const byPrimary = primary(a, b);
    if (byPrimary !== 0) {
      return byPrimary;
    }
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    const byName = a.player.name.localeCompare(b.player.name);
    if (byName !== 0) {
      return byName;
    }
    return a.player.id.localeCompare(b.player.id);
  });

  return sorted.map((aggregate, index) => toEntry(aggregate, index + 1));
}

/**
 * Projects a {@link PlayerAggregate} into a public {@link RankingEntry} at the
 * given rank. `stdDev` is always populated so the "Mais Consistente" category
 * can surface it.
 *
 * @param aggregate - The aggregate to project.
 * @param rank - The 1-based rank to assign.
 * @returns The corresponding ranking entry.
 */
function toEntry(aggregate: PlayerAggregate, rank: number): RankingEntry {
  return {
    playerId: aggregate.player.id,
    playerName: aggregate.player.name,
    position: aggregate.player.position,
    avg: aggregate.avg,
    votes: aggregate.votes,
    rank,
    stdDev: aggregate.stdDev,
  };
}

/**
 * Builds the "Partida Mais Bem Avaliada" category: the top fixtures by average
 * lineup Nota_de_Jogo (Requirement 26.4).
 *
 * Ratings are grouped by fixture; within each fixture, ratings are averaged per
 * player (that player's Nota_de_Jogo) and the fixture score is the mean of
 * those per-player averages. Ties are broken by total votes (desc), then by
 * date (newer first) and fixture id, and the top {@link BEST_RATED_MATCHES_LIMIT}
 * fixtures are returned with a 1-based rank.
 *
 * @param scores - Ratings to group by fixture.
 * @param competitionByFixture - Lookup of fixture id to competition id.
 * @returns The best-rated fixtures, capped and ranked.
 */
function buildBestRatedMatches(
  scores: GameScore[],
  competitionByFixture: Map<string, number>,
): BestRatedMatch[] {
  interface FixtureAccumulator {
    homeTeam: string;
    awayTeam: string;
    fixtureDate: string;
    ratingsByPlayer: Map<string, number[]>;
    votes: number;
  }

  const byFixture = new Map<string, FixtureAccumulator>();

  for (const score of scores) {
    let accumulator = byFixture.get(score.fixtureId);
    if (!accumulator) {
      accumulator = {
        homeTeam: score.homeTeam,
        awayTeam: score.awayTeam,
        fixtureDate: score.fixtureDate,
        ratingsByPlayer: new Map<string, number[]>(),
        votes: 0,
      };
      byFixture.set(score.fixtureId, accumulator);
    }
    const existing = accumulator.ratingsByPlayer.get(score.playerId);
    if (existing) {
      existing.push(score.score);
    } else {
      accumulator.ratingsByPlayer.set(score.playerId, [score.score]);
    }
    accumulator.votes += 1;
  }

  const matches: BestRatedMatch[] = [...byFixture.entries()].map(([fixtureId, accumulator]) => {
    const playerAverages = [...accumulator.ratingsByPlayer.values()].map((ratings) =>
      calcAverage(ratings),
    );
    return {
      fixtureId,
      homeTeam: accumulator.homeTeam,
      awayTeam: accumulator.awayTeam,
      fixtureDate: accumulator.fixtureDate,
      competition: competitionByFixture.get(fixtureId) ?? null,
      avg: calcAverage(playerAverages),
      votes: accumulator.votes,
      rank: 0,
    };
  });

  matches.sort((a, b) => {
    if (b.avg !== a.avg) {
      return b.avg - a.avg;
    }
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    const byDate = b.fixtureDate.localeCompare(a.fixtureDate);
    if (byDate !== 0) {
      return byDate;
    }
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  return matches
    .slice(0, BEST_RATED_MATCHES_LIMIT)
    .map((match, index) => ({ ...match, rank: index + 1 }));
}
