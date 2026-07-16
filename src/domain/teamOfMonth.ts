/**
 * Team of the Community of the Month domain module (pure, framework-agnostic).
 *
 * Position-aware selection of the Time_da_Comunidade_do_Mês: given the
 * community ratings ({@link GameScore}[]) already scoped to a period (a month
 * and competition), the canonical squad ({@link Player}[]) and a tactical
 * {@link Formation}, {@link buildTeamOfMonth} fills each formation slot with the
 * best-rated eligible player for that slot's required {@link Position}
 * (Requirements 25.2, 25.3).
 *
 * A player's ranking metric is the mean of their per-match Notas_de_Jogo over
 * the period: within each fixture the individual ratings are averaged (the
 * player's Nota_de_Jogo for that match), and those per-match averages are then
 * averaged across the period, matching the Nota_da_Temporada / ranking
 * definition used elsewhere in the domain.
 *
 * Each **filled** slot is guaranteed to hold a player whose position matches the
 * slot's `requiredPosition` (Property 16): candidates for a slot are drawn only
 * from eligible players of that exact position. When a period has fewer eligible
 * players of a position than the formation demands, the surplus slots are
 * returned unfilled (`player === null`) so the caller can surface a
 * "Dados insuficientes" state (Requirement 25.6) rather than borrowing a player
 * from another position.
 *
 * Living in the pure `domain` layer, this module imports ONLY from `types` and
 * from the sibling `scoring` module ({@link calcAverage}); it has no dependency
 * on React, the DOM, services or the network (Requirement 1.2).
 *
 * @see Requirements 25.2 (tactical formation by position), 25.3 (best player
 *   per position by average Nota_de_Jogo), 25.6 (insufficient data).
 */

import type { GameScore, Player, Position } from '../types/domain';
import { calcAverage } from './scoring';

/** Canonical order in which positions are laid out in a formation. */
const POSITION_ORDER: readonly Position[] = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Attacker',
];

/**
 * A tactical formation: how many slots each {@link Position} contributes to the
 * Team of the Month (e.g. a 4-3-3 is 1 Goalkeeper, 4 Defenders, 3 Midfielders,
 * 3 Attackers).
 *
 * The formation is data-driven: callers describe the shape by position counts,
 * so new formations are added by configuration rather than code.
 */
export interface Formation {
  /** Human-facing formation label (e.g. `"4-3-3"`). Not used for selection. */
  name: string;
  /** Number of slots required per position. Missing or non-positive counts contribute no slots. */
  counts: Partial<Record<Position, number>>;
}

/**
 * A single slot of the Team of the Month.
 *
 * A filled slot (`player !== null`) always satisfies
 * `player.position === requiredPosition` (Property 16). An unfilled slot
 * (`player === null`) signals that the period lacked enough eligible players of
 * the required position to complete the formation (Requirement 25.6).
 */
export interface TeamOfMonthSlot {
  /** The position this slot must be filled by. */
  requiredPosition: Position;
  /** The selected player, or `null` when there was insufficient data. */
  player: Player | null;
  /** The player's average Nota_de_Jogo over the period, or `null` when unfilled. */
  avg: number | null;
  /** The total number of individual ratings the player received, or `0` when unfilled. */
  votes: number;
}

/** Internal per-player aggregation of period ratings used to rank candidates. */
interface Candidate {
  player: Player;
  avg: number;
  votes: number;
}

/**
 * Builds the Team of the Community of the Month for a period (Requirements
 * 25.2, 25.3).
 *
 * The `scores` are expected to be pre-filtered to the target month and
 * competition by the caller (the Service layer); this function performs the
 * pure, position-aware selection. For every position demanded by `formation`,
 * the eligible players of that position (players present in `players` with at
 * least one rating) are ranked by their average Nota_de_Jogo over the period
 * and assigned to the slots, best first.
 *
 * The selection is position-safe: a slot is only ever filled by a player of its
 * required position, so `slot.player.position === slot.requiredPosition` holds
 * for every filled slot (Property 16). If a position has fewer eligible players
 * than the formation requires, the remaining slots for that position are
 * returned unfilled (`player === null`), letting the caller detect insufficient
 * data (Requirement 25.6).
 *
 * The result is deterministic: within a position, players are ordered by
 * average descending, ties broken by votes descending, then player name and id
 * ascending, so identical input always yields identical slots. Slots are
 * emitted grouped by position in the canonical order Goalkeeper → Defender →
 * Midfielder → Attacker.
 *
 * @param scores - Community ratings (Notas_de_Jogo) for the period.
 * @param players - The canonical squad; only these players are eligible.
 * @param formation - The tactical formation describing slot counts per position.
 * @returns One {@link TeamOfMonthSlot} per formation slot, position-safe and
 *   deterministically ordered.
 *
 * @example
 * const team = buildTeamOfMonth(monthScores, squad, {
 *   name: '4-3-3',
 *   counts: { Goalkeeper: 1, Defender: 4, Midfielder: 3, Attacker: 3 },
 * });
 * team.every((slot) => slot.player === null
 *   || slot.player.position === slot.requiredPosition); // always true (Property 16)
 */
export function buildTeamOfMonth(
  scores: GameScore[],
  players: Player[],
  formation: Formation,
): TeamOfMonthSlot[] {
  const candidatesByPosition = rankCandidatesByPosition(scores, players);

  const slots: TeamOfMonthSlot[] = [];
  for (const position of POSITION_ORDER) {
    const required = normalizeCount(formation.counts[position]);
    if (required === 0) {
      continue;
    }

    const ranked = candidatesByPosition.get(position) ?? [];
    for (let index = 0; index < required; index += 1) {
      const candidate = ranked[index];
      slots.push(
        candidate
          ? {
              requiredPosition: position,
              player: candidate.player,
              avg: candidate.avg,
              votes: candidate.votes,
            }
          : { requiredPosition: position, player: null, avg: null, votes: 0 },
      );
    }
  }

  return slots;
}

/**
 * Aggregates the period ratings into ranked candidate lists keyed by position.
 *
 * Only players present in `players` are considered, and only those with at
 * least one rating in the period are eligible. Each eligible player's ranking
 * metric is the mean of their per-match Notas_de_Jogo (individual ratings
 * averaged within a fixture, then averaged across fixtures). Candidates within
 * a position are ordered by average descending, with deterministic tie-breakers
 * (votes descending, then name and id ascending).
 *
 * @param scores - Ratings for the period.
 * @param players - The canonical squad.
 * @returns A map from {@link Position} to its ranked candidate list.
 */
function rankCandidatesByPosition(
  scores: GameScore[],
  players: Player[],
): Map<Position, Candidate[]> {
  const playersById = new Map(players.map((player) => [player.id, player]));

  // playerId -> (fixtureId -> individual ratings)
  const ratingsByPlayer = new Map<string, Map<string, number[]>>();
  for (const score of scores) {
    if (!playersById.has(score.playerId)) {
      continue; // ignore ratings for players outside the canonical squad
    }
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

  const byPosition = new Map<Position, Candidate[]>();
  for (const [playerId, byFixture] of ratingsByPlayer) {
    const player = playersById.get(playerId);
    if (!player) {
      continue;
    }

    let votes = 0;
    const perMatchAverages: number[] = [];
    for (const ratings of byFixture.values()) {
      votes += ratings.length;
      perMatchAverages.push(calcAverage(ratings));
    }
    if (votes === 0) {
      continue; // not eligible without any rating
    }

    const candidate: Candidate = {
      player,
      avg: calcAverage(perMatchAverages),
      votes,
    };
    const bucket = byPosition.get(player.position);
    if (bucket) {
      bucket.push(candidate);
    } else {
      byPosition.set(player.position, [candidate]);
    }
  }

  for (const bucket of byPosition.values()) {
    bucket.sort(compareCandidates);
  }

  return byPosition;
}

/**
 * Deterministic candidate comparator: average descending, then votes
 * descending, then player name and id ascending.
 *
 * @param a - First candidate.
 * @param b - Second candidate.
 * @returns Negative when `a` ranks before `b`, positive when after, `0` when equal.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  if (b.avg !== a.avg) {
    return b.avg - a.avg;
  }
  if (b.votes !== a.votes) {
    return b.votes - a.votes;
  }
  const byName = a.player.name.localeCompare(b.player.name);
  if (byName !== 0) {
    return byName;
  }
  return a.player.id.localeCompare(b.player.id);
}

/**
 * Normalizes a formation slot count to a non-negative integer, treating
 * `undefined`, negative or fractional values as `0` (no slot).
 *
 * @param count - The raw configured count for a position.
 * @returns A safe, non-negative integer slot count.
 */
function normalizeCount(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.floor(count);
}
