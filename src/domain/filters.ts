/**
 * Player filtering and sorting (pure, framework-agnostic).
 *
 * Client-side helpers used by the Elenco page to filter and reorder the squad
 * without any extra Supabase round-trips (Requirements 14.1, 15.5). This module
 * lives in the pure `domain` layer and imports ONLY from `types` — no React,
 * DOM, services or network (Requirement 1.2).
 *
 * The {@link Player} entity itself carries no season aggregates, so the
 * rating/votes-aware helpers ({@link filterCombined}, {@link sortPlayers})
 * operate over minimal structural shapes that augment a player with its
 * season average and vote count. Any object satisfying those shapes works,
 * which keeps the functions decoupled from how the aggregates are computed.
 *
 * @see Requirement 14.1 — filtros combinados com lógica AND.
 * @see Requirement 15.5 — filtro por Posição.
 * @see Requirement 15.6 — ordenação por nota (sem nota ao final).
 * @see Requirement 15.7 — ordenação por posição (GK→DEF→MID→ATT, alfabética).
 */

import type { Position } from '../types/domain';

/** Position filter value: a concrete {@link Position} or `'all'` (no filter). */
export type PositionFilter = Position | 'all';

/** Sort strategy for the squad grid: by season rating or by field position. */
export type SortMode = 'nota' | 'posicao';

/**
 * Combined filter criteria applied with AND logic (Requirement 14.1).
 *
 * Every provided field acts as an independent predicate; an undefined field
 * (and `position === 'all'`) imposes no constraint. Adding a constraint can
 * only shrink the result, never grow it.
 */
export interface PlayerFilters {
  /** Restrict to a single position; `'all'` or omitted means no restriction. */
  position?: PositionFilter;
  /** Minimum season average, inclusive, on the `[0, 10]` scale (Requirement 14.2). */
  minRating?: number;
  /** Maximum season average, inclusive, on the `[0, 10]` scale (Requirement 14.2). */
  maxRating?: number;
  /** Minimum number of votes received (Requirement 14.3: 1, 3, 5 or 10). */
  minVotes?: number;
}

/** Minimal shape needed to filter a player by combined criteria. */
export interface FilterablePlayer {
  position: Position;
  /** Season average in `[0, 10]`, or `null` when the player has no ratings yet. */
  avg: number | null;
  /** Number of votes (ratings) received across the season. */
  votes: number;
}

/** Minimal shape needed to sort players by rating or position. */
export interface SortablePlayer {
  name: string;
  position: Position;
  /** Season average in `[0, 10]`, or `null` when the player has no ratings yet. */
  avg: number | null;
}

/**
 * Relative ordering of positions on the pitch (Requirement 15.7):
 * Goalkeeper → Defender → Midfielder → Attacker.
 */
const POSITION_ORDER: Record<Position, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
};

/**
 * Filters players by field position (Requirement 15.5).
 *
 * Passing `'all'` returns every player (as a new array). Passing a concrete
 * {@link Position} returns only the players in that position, so the four
 * concrete positions partition the input: the sizes of the four partitions
 * sum back to `players.length` and every returned item has `position === pos`
 * (Property 6).
 *
 * The input array is never mutated; a new array is always returned.
 *
 * @typeParam T - Any object exposing a {@link Position}.
 * @param players - The players to filter.
 * @param pos - Target position, or `'all'` to disable the filter.
 * @returns A new array containing only the players that match `pos`.
 */
export function filterByPosition<T extends { position: Position }>(
  players: readonly T[],
  pos: PositionFilter,
): T[] {
  if (pos === 'all') {
    return players.slice();
  }
  return players.filter((player) => player.position === pos);
}

/**
 * Applies all active filter criteria with AND logic (Requirement 14.1).
 *
 * Each provided field of {@link PlayerFilters} is an independent predicate; a
 * player must satisfy every active predicate simultaneously to be included.
 * Unset fields (and `position === 'all'`) impose no constraint. A rating range
 * (`minRating`/`maxRating`) never matches an unrated player (`avg === null`),
 * since a missing average cannot satisfy a numeric bound.
 *
 * The result is always a subset of the input in the original order, and adding
 * a constraint can only shrink the result — never grow it (Property 9). The
 * input array is never mutated.
 *
 * @typeParam T - Any object exposing position, season average and vote count.
 * @param players - The players to filter.
 * @param filters - The combined criteria to apply.
 * @returns A new array of players satisfying every active criterion.
 */
export function filterCombined<T extends FilterablePlayer>(
  players: readonly T[],
  filters: PlayerFilters,
): T[] {
  const { position, minRating, maxRating, minVotes } = filters;
  return players.filter((player) => {
    if (position !== undefined && position !== 'all' && player.position !== position) {
      return false;
    }
    if (minRating !== undefined && (player.avg === null || player.avg < minRating)) {
      return false;
    }
    if (maxRating !== undefined && (player.avg === null || player.avg > maxRating)) {
      return false;
    }
    if (minVotes !== undefined && player.votes < minVotes) {
      return false;
    }
    return true;
  });
}

/**
 * Reorders players by season rating or by field position (Requirements 15.6, 15.7).
 *
 * - `'nota'`: descending by season average; unrated players (`avg === null`)
 *   are placed last (Requirement 15.6).
 * - `'posicao'`: Goalkeeper → Defender → Midfielder → Attacker, alphabetical by
 *   name within each group (Requirement 15.7).
 *
 * The result is always a permutation of the input (same multiset of players):
 * the input array is never mutated, and ties are broken by original index so
 * the sort is stable (Property 7).
 *
 * @typeParam T - Any object exposing name, position and season average.
 * @param players - The players to reorder.
 * @param by - The sort strategy.
 * @returns A new, reordered array containing exactly the input players.
 */
export function sortPlayers<T extends SortablePlayer>(
  players: readonly T[],
  by: SortMode,
): T[] {
  const decorated = players.map((player, index) => ({ player, index }));

  decorated.sort((a, b) => {
    const primary =
      by === 'nota'
        ? compareByRating(a.player, b.player)
        : compareByPosition(a.player, b.player);
    // Stable tiebreak: preserve original input order for equal keys.
    return primary !== 0 ? primary : a.index - b.index;
  });

  return decorated.map((entry) => entry.player);
}

/**
 * Compares two players by season average, descending, with unrated players last.
 */
function compareByRating(a: SortablePlayer, b: SortablePlayer): number {
  if (a.avg === null && b.avg === null) {
    return 0;
  }
  if (a.avg === null) {
    return 1; // a goes after b
  }
  if (b.avg === null) {
    return -1; // b goes after a
  }
  return b.avg - a.avg; // descending
}

/**
 * Compares two players by position order, then alphabetically by name.
 */
function compareByPosition(a: SortablePlayer, b: SortablePlayer): number {
  const byPosition = POSITION_ORDER[a.position] - POSITION_ORDER[b.position];
  if (byPosition !== 0) {
    return byPosition;
  }
  return a.name.localeCompare(b.name, 'pt-BR');
}
