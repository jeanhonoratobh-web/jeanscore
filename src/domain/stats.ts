/**
 * Statistics domain module (pure, framework-agnostic).
 *
 * Derives the scouting-report analytics shown on the Player Profile and the
 * community feed from raw {@link GameScore} data: score distribution
 * (histogram), chronological score evolution, community trends (rising /
 * falling players), strengths & weaknesses, and best / worst match helpers.
 *
 * Like the rest of the `domain` layer, this module imports ONLY from `types`
 * (and sibling pure domain modules such as {@link calcAverage}) — never from
 * React, the DOM, services or the network (Requirement 1.2). Every function is
 * pure: equal inputs always yield equal outputs and no input is mutated.
 *
 * @see Requirement 16.5 — "Forças" e "Fraquezas" derivadas das Notas_de_Jogo.
 * @see Requirement 16.8 — "Linha do Tempo de Desempenho" ordenada cronologicamente.
 * @see Requirement 16.10 — melhor e pior Nota_de_Jogo da temporada.
 * @see Requirement 16.11 — Histogram de 10 faixas de 1 ponto (0-1, ..., 9-10).
 * @see Requirement 24.4 — Jogadores "Em alta" (maior crescimento recente).
 * @see Requirement 24.5 — Jogadores "Em baixa" (maior queda recente).
 */

import type { Fixture, GameScore } from '../types/domain';
import { calcAverage } from './scoring';

/** Number of bins in a score histogram: one per 1-point band over `[0, 10]`. */
const HISTOGRAM_BINS = 10;
/** Width of the score scale covered by the histogram. */
const SCORE_MAX = 10;
/** Number of most-recent matches compared against the season average for trends. */
const RECENT_WINDOW = 3;

/**
 * Aggregated Nota_de_Jogo for a single fixture: the average of every rating a
 * player received in that match, plus the context needed to label it.
 */
export interface MatchScore {
  /** Identifier of the fixture the scores belong to. */
  fixtureId: string;
  /** Nota_de_Jogo: the average of all ratings in the fixture. */
  average: number;
  /** Number of ratings that contributed to {@link MatchScore.average}. */
  votes: number;
  /** Fixture date string, copied from the source scores. */
  fixtureDate: string;
  /** Home team of the fixture. */
  homeTeam: string;
  /** Away team of the fixture. */
  awayTeam: string;
}

/**
 * A single point on a chronological performance line (Requirement 16.8).
 */
export interface EvolutionPoint {
  /** Identifier of the fixture this point represents. */
  fixtureId: string;
  /** Human-facing label for the x-axis (the fixture date). */
  label: string;
  /** Nota_de_Jogo for the fixture. */
  average: number;
  /** Number of ratings behind {@link EvolutionPoint.average}. */
  votes: number;
  /** Sort key in seconds since the Unix epoch (ascending = older to newer). */
  ts: number;
}

/**
 * A player's recent trend relative to their season average (Requirements
 * 24.4-24.5).
 */
export interface PlayerTrend {
  /** Identifier of the player. */
  playerId: string;
  /** Display name of the player. */
  playerName: string;
  /** Average Nota_de_Jogo across the player's most recent matches. */
  recentAvg: number;
  /** Average Nota_de_Jogo across all of the player's matches. */
  seasonAvg: number;
  /** `recentAvg - seasonAvg`: positive means rising, negative means falling. */
  delta: number;
}

/**
 * A player's strengths and weaknesses, derived from their per-match Notas_de_Jogo
 * relative to their season average (Requirement 16.5).
 */
export interface StrengthProfile {
  /** The player's season average across all rated matches. */
  overallAverage: number;
  /** Matches at or above the season average, best first (strengths). */
  strengths: MatchScore[];
  /** Matches below the season average, worst first (weaknesses). */
  weaknesses: MatchScore[];
}

/**
 * Builds a 10-bin histogram of raw scores over the `[0, 10]` scale
 * (Requirement 16.11).
 *
 * Each bin `i` counts the scores that fall in the 1-point band `[i, i + 1)` for
 * `i` in `0..8`; the final bin (`9`) is closed on both ends `[9, 10]` so a
 * perfect `10` is counted. Values outside `[0, 10]` are clamped into the
 * nearest bin and non-finite values (`NaN`, `±Infinity`) are ignored. The
 * returned array always has exactly 10 entries and its sum equals the number of
 * finite inputs.
 *
 * @param scores - Raw individual ratings (not pre-aggregated averages).
 * @returns An array of 10 non-negative integer frequencies, one per band.
 *
 * @example
 * buildHistogram([0, 5.5, 9.9, 10]); // [1,0,0,0,0,1,0,0,0,2]
 * buildHistogram([]);                // [0,0,0,0,0,0,0,0,0,0]
 */
export function buildHistogram(scores: number[]): number[] {
  const bins = new Array<number>(HISTOGRAM_BINS).fill(0);
  for (const score of scores) {
    if (!Number.isFinite(score)) {
      continue;
    }
    const clamped = Math.min(SCORE_MAX, Math.max(0, score));
    const index = Math.min(HISTOGRAM_BINS - 1, Math.floor(clamped));
    bins[index] += 1;
  }
  return bins;
}

/**
 * Builds the chronological score-evolution line for a player (Requirement 16.8).
 *
 * Scores are grouped by fixture; each group yields one {@link EvolutionPoint}
 * whose `average` is the fixture's Nota_de_Jogo. Points are ordered oldest to
 * newest using the matching {@link Fixture.ts} when available, falling back to
 * parsing the score's `fixtureDate`. Ordering is deterministic: ties on `ts`
 * are broken by `fixtureId`. An empty input yields an empty line.
 *
 * @param scores - Game scores, typically all belonging to a single player.
 * @param fixtures - Fixtures used to resolve chronological order.
 * @returns Evolution points sorted ascending by time.
 */
export function buildEvolution(
  scores: GameScore[],
  fixtures: Fixture[],
): EvolutionPoint[] {
  if (scores.length === 0) {
    return [];
  }
  const fixtureById = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    fixtureById.set(fixture.id, fixture);
  }

  const matches = aggregateByFixture(scores);
  const points: EvolutionPoint[] = matches.map((match) => {
    const fixture = fixtureById.get(match.fixtureId);
    const ts = fixture ? fixture.ts : parseDateToSeconds(match.fixtureDate);
    return {
      fixtureId: match.fixtureId,
      label: match.fixtureDate,
      average: match.average,
      votes: match.votes,
      ts,
    };
  });

  points.sort((a, b) => a.ts - b.ts || a.fixtureId.localeCompare(b.fixtureId));
  return points;
}

/**
 * Ranks players by how their recent form compares to their season average
 * (Requirements 24.4-24.5).
 *
 * For each player the per-match Notas_de_Jogo are ordered chronologically; the
 * mean of the last {@link RECENT_WINDOW} matches (`recentAvg`) is compared to
 * the mean of all their matches (`seasonAvg`), giving `delta = recentAvg -
 * seasonAvg`. Players with fewer than two rated matches are excluded, since a
 * single match has no trend. When `dir` is `'up'` only rising players
 * (`delta > 0`) are returned, sorted by largest gain first; when `'down'` only
 * falling players (`delta < 0`) are returned, sorted by largest drop first.
 * Callers may slice the result (e.g. to the top 3 for the community feed).
 *
 * @param scores - Game scores across any number of players and fixtures.
 * @param dir - `'up'` for rising players, `'down'` for falling players.
 * @returns Matching players sorted by trend magnitude (strongest first).
 */
export function trendingPlayers(
  scores: GameScore[],
  dir: 'up' | 'down',
): PlayerTrend[] {
  const byPlayer = new Map<string, GameScore[]>();
  for (const score of scores) {
    const list = byPlayer.get(score.playerId);
    if (list) {
      list.push(score);
    } else {
      byPlayer.set(score.playerId, [score]);
    }
  }

  const trends: PlayerTrend[] = [];
  for (const [playerId, playerScores] of byPlayer) {
    const matches = aggregateByFixture(playerScores);
    if (matches.length < 2) {
      continue;
    }
    const ordered = [...matches].sort(
      (a, b) =>
        parseDateToSeconds(a.fixtureDate) - parseDateToSeconds(b.fixtureDate) ||
        a.fixtureId.localeCompare(b.fixtureId),
    );
    const recent = ordered.slice(-RECENT_WINDOW);
    const recentAvg = calcAverage(recent.map((m) => m.average));
    const seasonAvg = calcAverage(ordered.map((m) => m.average));
    trends.push({
      playerId,
      playerName: playerScores[0].playerName,
      recentAvg,
      seasonAvg,
      delta: recentAvg - seasonAvg,
    });
  }

  const filtered =
    dir === 'up'
      ? trends.filter((t) => t.delta > 0)
      : trends.filter((t) => t.delta < 0);

  filtered.sort((a, b) =>
    dir === 'up'
      ? b.delta - a.delta || a.playerId.localeCompare(b.playerId)
      : a.delta - b.delta || a.playerId.localeCompare(b.playerId),
  );
  return filtered;
}

/**
 * Splits a player's matches into strengths and weaknesses (Requirement 16.5).
 *
 * The per-match Notas_de_Jogo are compared to the player's season average:
 * matches at or above the average are "strengths" (best first) and matches
 * below it are "weaknesses" (worst first). This exposes the matches where the
 * player performed above or below their own baseline. An empty input yields a
 * zeroed profile with empty lists.
 *
 * @param scores - Game scores, typically all belonging to a single player.
 * @returns The player's {@link StrengthProfile}.
 */
export function strengthsWeaknesses(scores: GameScore[]): StrengthProfile {
  const matches = aggregateByFixture(scores);
  if (matches.length === 0) {
    return { overallAverage: 0, strengths: [], weaknesses: [] };
  }

  const overallAverage = calcAverage(matches.map((m) => m.average));
  const strengths = matches
    .filter((m) => m.average >= overallAverage)
    .sort((a, b) => b.average - a.average || a.fixtureId.localeCompare(b.fixtureId));
  const weaknesses = matches
    .filter((m) => m.average < overallAverage)
    .sort((a, b) => a.average - b.average || a.fixtureId.localeCompare(b.fixtureId));

  return { overallAverage, strengths, weaknesses };
}

/**
 * Returns the match with the highest Nota_de_Jogo of the season (Requirement
 * 16.10).
 *
 * Ties on the average are broken deterministically by `fixtureId`. Returns
 * `null` when there are no scores.
 *
 * @param scores - Game scores, typically all belonging to a single player.
 * @returns The best {@link MatchScore}, or `null` when the input is empty.
 */
export function bestMatch(scores: GameScore[]): MatchScore | null {
  const matches = aggregateByFixture(scores);
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((best, m) =>
    m.average > best.average ||
    (m.average === best.average && m.fixtureId.localeCompare(best.fixtureId) < 0)
      ? m
      : best,
  );
}

/**
 * Returns the match with the lowest Nota_de_Jogo of the season (Requirement
 * 16.10).
 *
 * Ties on the average are broken deterministically by `fixtureId`. Returns
 * `null` when there are no scores.
 *
 * @param scores - Game scores, typically all belonging to a single player.
 * @returns The worst {@link MatchScore}, or `null` when the input is empty.
 */
export function worstMatch(scores: GameScore[]): MatchScore | null {
  const matches = aggregateByFixture(scores);
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((worst, m) =>
    m.average < worst.average ||
    (m.average === worst.average && m.fixtureId.localeCompare(worst.fixtureId) < 0)
      ? m
      : worst,
  );
}

/**
 * Aggregates game scores into one {@link MatchScore} per fixture.
 *
 * Groups the input by `fixtureId`, averaging every rating in a group into the
 * fixture's Nota_de_Jogo and preserving the match context (date and teams) from
 * the first score seen for that fixture.
 *
 * @param scores - Game scores to aggregate.
 * @returns One {@link MatchScore} per distinct fixture (unordered).
 */
function aggregateByFixture(scores: GameScore[]): MatchScore[] {
  const groups = new Map<string, GameScore[]>();
  for (const score of scores) {
    const list = groups.get(score.fixtureId);
    if (list) {
      list.push(score);
    } else {
      groups.set(score.fixtureId, [score]);
    }
  }

  const result: MatchScore[] = [];
  for (const [fixtureId, groupScores] of groups) {
    const first = groupScores[0];
    result.push({
      fixtureId,
      average: calcAverage(groupScores.map((s) => s.score)),
      votes: groupScores.length,
      fixtureDate: first.fixtureDate,
      homeTeam: first.homeTeam,
      awayTeam: first.awayTeam,
    });
  }
  return result;
}

/**
 * Parses a date string into whole seconds since the Unix epoch, used as a
 * chronological sort key. Unparseable values collapse to `0` so ordering stays
 * total and deterministic.
 *
 * @param date - A date string (e.g. an ISO timestamp).
 * @returns Seconds since the epoch, or `0` when the input cannot be parsed.
 */
function parseDateToSeconds(date: string): number {
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}
