/**
 * Unit tests for the statistics domain module (`domain/stats.ts`).
 *
 * These tests exercise concrete examples and edge cases for every exported
 * helper: buildHistogram, buildEvolution, trendingPlayers, strengthsWeaknesses,
 * bestMatch and worstMatch. Edge cases covered per the task: fewer than two
 * matches, empty lists, ties, and absence of votes.
 *
 * @see Requirement 16.8 — "Linha do Tempo de Desempenho" ordenada cronologicamente.
 * @see Requirement 24.1 — tendências da comunidade (Em alta / Em baixa).
 */
import { describe, it, expect } from 'vitest';
import type { Fixture, GameScore } from '../types/domain';
import {
  buildHistogram,
  buildEvolution,
  trendingPlayers,
  strengthsWeaknesses,
  bestMatch,
  worstMatch,
} from './stats';

// ---------------------------------------------------------------------------
// Test fixtures / builders
// ---------------------------------------------------------------------------

/**
 * Builds a GameScore with sensible defaults so individual tests only specify
 * the fields they care about.
 */
function makeScore(overrides: Partial<GameScore> = {}): GameScore {
  return {
    fixtureId: 'f1',
    playerId: 'p1',
    playerName: 'Player One',
    username: 'user1',
    score: 7,
    homeTeam: 'Cruzeiro',
    awayTeam: 'Rival',
    fixtureDate: '2024-01-01T20:00:00Z',
    createdAt: '2024-01-01T22:00:00Z',
    ...overrides,
  };
}

/** Builds a Fixture with defaults. */
function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'f1',
    homeTeam: 'Cruzeiro',
    awayTeam: 'Rival',
    homeScore: null,
    awayScore: null,
    fixtureDate: '2024-01-01T20:00:00Z',
    ts: 1704139200, // 2024-01-01T20:00:00Z
    competition: 1,
    stadium: null,
    status: 'finished',
    liberado: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildHistogram
// ---------------------------------------------------------------------------

describe('buildHistogram', () => {
  it('returns 10 zeroed bins for an empty list', () => {
    expect(buildHistogram([])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('places scores into their 1-point bands', () => {
    // 0 -> bin 0, 5.5 -> bin 5, 9.9 -> bin 9, 10 -> bin 9
    expect(buildHistogram([0, 5.5, 9.9, 10])).toEqual([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 2,
    ]);
  });

  it('counts a perfect 10 in the final closed bin', () => {
    expect(buildHistogram([10])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('clamps out-of-range values into the nearest bin', () => {
    // -5 clamps to 0 (bin 0), 15 clamps to 10 (bin 9)
    expect(buildHistogram([-5, 15])).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('ignores non-finite values', () => {
    expect(buildHistogram([NaN, Infinity, -Infinity, 3])).toEqual([
      0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('always produces exactly 10 bins whose sum equals the finite input count', () => {
    const scores = [1, 2, 2.4, 7, 7.9, 10, NaN];
    const bins = buildHistogram(scores);
    expect(bins).toHaveLength(10);
    const total = bins.reduce((a, b) => a + b, 0);
    expect(total).toBe(6); // NaN excluded
  });
});

// ---------------------------------------------------------------------------
// buildEvolution
// ---------------------------------------------------------------------------

describe('buildEvolution', () => {
  it('returns an empty line for empty scores', () => {
    expect(buildEvolution([], [])).toEqual([]);
  });

  it('orders points chronologically using fixture timestamps', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'later', score: 8 }),
      makeScore({ fixtureId: 'earlier', score: 6 }),
    ];
    const fixtures: Fixture[] = [
      makeFixture({ id: 'later', ts: 2000 }),
      makeFixture({ id: 'earlier', ts: 1000 }),
    ];
    const points = buildEvolution(scores, fixtures);
    expect(points.map((p) => p.fixtureId)).toEqual(['earlier', 'later']);
    expect(points[0].average).toBe(6);
    expect(points[1].average).toBe(8);
  });

  it('averages multiple ratings per fixture into a single point', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'f1', username: 'a', score: 6 }),
      makeScore({ fixtureId: 'f1', username: 'b', score: 8 }),
    ];
    const points = buildEvolution(scores, [makeFixture({ id: 'f1' })]);
    expect(points).toHaveLength(1);
    expect(points[0].average).toBe(7);
    expect(points[0].votes).toBe(2);
  });

  it('falls back to parsing fixtureDate when the fixture is missing', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'b', fixtureDate: '2024-03-01T20:00:00Z' }),
      makeScore({ fixtureId: 'a', fixtureDate: '2024-02-01T20:00:00Z' }),
    ];
    // No fixtures provided -> order derived from fixtureDate
    const points = buildEvolution(scores, []);
    expect(points.map((p) => p.fixtureId)).toEqual(['a', 'b']);
  });

  it('breaks timestamp ties deterministically by fixtureId', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'zebra' }),
      makeScore({ fixtureId: 'alpha' }),
    ];
    const fixtures: Fixture[] = [
      makeFixture({ id: 'zebra', ts: 1000 }),
      makeFixture({ id: 'alpha', ts: 1000 }),
    ];
    const points = buildEvolution(scores, fixtures);
    expect(points.map((p) => p.fixtureId)).toEqual(['alpha', 'zebra']);
  });
});

// ---------------------------------------------------------------------------
// trendingPlayers
// ---------------------------------------------------------------------------

describe('trendingPlayers', () => {
  it('returns an empty list when there are no scores', () => {
    expect(trendingPlayers([], 'up')).toEqual([]);
    expect(trendingPlayers([], 'down')).toEqual([]);
  });

  it('excludes players with fewer than two matches (no trend from one match)', () => {
    const scores: GameScore[] = [
      makeScore({ playerId: 'p1', fixtureId: 'f1', score: 9 }),
    ];
    expect(trendingPlayers(scores, 'up')).toEqual([]);
    expect(trendingPlayers(scores, 'down')).toEqual([]);
  });

  it('identifies a rising player when recent form beats the season average', () => {
    // The recent window is the last 3 matches, so a rising trend needs more
    // than 3 matches for that window to exclude the weaker early games.
    const scores: GameScore[] = [
      makeScore({ playerId: 'p1', fixtureId: 'f1', fixtureDate: '2024-01-01T00:00:00Z', score: 2 }),
      makeScore({ playerId: 'p1', fixtureId: 'f2', fixtureDate: '2024-02-01T00:00:00Z', score: 2 }),
      makeScore({ playerId: 'p1', fixtureId: 'f3', fixtureDate: '2024-03-01T00:00:00Z', score: 8 }),
      makeScore({ playerId: 'p1', fixtureId: 'f4', fixtureDate: '2024-04-01T00:00:00Z', score: 8 }),
    ];
    const up = trendingPlayers(scores, 'up');
    expect(up).toHaveLength(1);
    expect(up[0].playerId).toBe('p1');
    expect(up[0].delta).toBeGreaterThan(0);
    // A rising player must not appear in the falling list.
    expect(trendingPlayers(scores, 'down')).toEqual([]);
  });

  it('identifies a falling player when recent form trails the season average', () => {
    const scores: GameScore[] = [
      makeScore({ playerId: 'p1', fixtureId: 'f1', fixtureDate: '2024-01-01T00:00:00Z', score: 8 }),
      makeScore({ playerId: 'p1', fixtureId: 'f2', fixtureDate: '2024-02-01T00:00:00Z', score: 8 }),
      makeScore({ playerId: 'p1', fixtureId: 'f3', fixtureDate: '2024-03-01T00:00:00Z', score: 2 }),
      makeScore({ playerId: 'p1', fixtureId: 'f4', fixtureDate: '2024-04-01T00:00:00Z', score: 2 }),
    ];
    const down = trendingPlayers(scores, 'down');
    expect(down).toHaveLength(1);
    expect(down[0].delta).toBeLessThan(0);
    expect(trendingPlayers(scores, 'up')).toEqual([]);
  });

  it('sorts rising players by largest gain first', () => {
    const scores: GameScore[] = [
      // p1: small gain (season 5.75, recent last-3 avg 6 -> delta +0.25)
      makeScore({ playerId: 'p1', playerName: 'One', fixtureId: 'f1', fixtureDate: '2024-01-01T00:00:00Z', score: 5 }),
      makeScore({ playerId: 'p1', playerName: 'One', fixtureId: 'f2', fixtureDate: '2024-02-01T00:00:00Z', score: 5 }),
      makeScore({ playerId: 'p1', playerName: 'One', fixtureId: 'f3', fixtureDate: '2024-03-01T00:00:00Z', score: 6 }),
      makeScore({ playerId: 'p1', playerName: 'One', fixtureId: 'f4', fixtureDate: '2024-04-01T00:00:00Z', score: 7 }),
      // p2: big gain (season 6, recent last-3 avg ~7.33 -> delta +1.33)
      makeScore({ playerId: 'p2', playerName: 'Two', fixtureId: 'g1', fixtureDate: '2024-01-01T00:00:00Z', score: 2 }),
      makeScore({ playerId: 'p2', playerName: 'Two', fixtureId: 'g2', fixtureDate: '2024-02-01T00:00:00Z', score: 2 }),
      makeScore({ playerId: 'p2', playerName: 'Two', fixtureId: 'g3', fixtureDate: '2024-03-01T00:00:00Z', score: 10 }),
      makeScore({ playerId: 'p2', playerName: 'Two', fixtureId: 'g4', fixtureDate: '2024-04-01T00:00:00Z', score: 10 }),
    ];
    const up = trendingPlayers(scores, 'up');
    expect(up.map((t) => t.playerId)).toEqual(['p2', 'p1']);
  });

  it('excludes players whose recent form equals the season average (delta == 0)', () => {
    const scores: GameScore[] = [
      makeScore({ playerId: 'p1', fixtureId: 'f1', fixtureDate: '2024-01-01T00:00:00Z', score: 5 }),
      makeScore({ playerId: 'p1', fixtureId: 'f2', fixtureDate: '2024-02-01T00:00:00Z', score: 5 }),
    ];
    expect(trendingPlayers(scores, 'up')).toEqual([]);
    expect(trendingPlayers(scores, 'down')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// strengthsWeaknesses
// ---------------------------------------------------------------------------

describe('strengthsWeaknesses', () => {
  it('returns a zeroed profile for empty scores (absence of votes)', () => {
    expect(strengthsWeaknesses([])).toEqual({
      overallAverage: 0,
      strengths: [],
      weaknesses: [],
    });
  });

  it('splits matches into strengths (>= avg) and weaknesses (< avg)', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'f1', score: 4 }),
      makeScore({ fixtureId: 'f2', score: 6 }),
      makeScore({ fixtureId: 'f3', score: 8 }),
    ];
    const profile = strengthsWeaknesses(scores);
    expect(profile.overallAverage).toBe(6);
    // strengths at or above 6, best first
    expect(profile.strengths.map((m) => m.fixtureId)).toEqual(['f3', 'f2']);
    // weaknesses below 6, worst first
    expect(profile.weaknesses.map((m) => m.fixtureId)).toEqual(['f1']);
  });

  it('classifies every match as a strength when all averages are equal (ties)', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'f1', score: 7 }),
      makeScore({ fixtureId: 'f2', score: 7 }),
    ];
    const profile = strengthsWeaknesses(scores);
    expect(profile.overallAverage).toBe(7);
    // Both >= average -> both strengths, ordered by fixtureId on the tie.
    expect(profile.strengths.map((m) => m.fixtureId)).toEqual(['f1', 'f2']);
    expect(profile.weaknesses).toEqual([]);
  });

  it('handles a single match (fewer than 2 matches)', () => {
    const profile = strengthsWeaknesses([makeScore({ fixtureId: 'f1', score: 5 })]);
    expect(profile.overallAverage).toBe(5);
    expect(profile.strengths.map((m) => m.fixtureId)).toEqual(['f1']);
    expect(profile.weaknesses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// bestMatch / worstMatch
// ---------------------------------------------------------------------------

describe('bestMatch', () => {
  it('returns null for empty scores', () => {
    expect(bestMatch([])).toBeNull();
  });

  it('returns the match with the highest Nota_de_Jogo', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'f1', score: 5 }),
      makeScore({ fixtureId: 'f2', score: 9 }),
      makeScore({ fixtureId: 'f3', score: 7 }),
    ];
    const best = bestMatch(scores);
    expect(best?.fixtureId).toBe('f2');
    expect(best?.average).toBe(9);
  });

  it('breaks ties on the highest average by fixtureId', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'zebra', score: 9 }),
      makeScore({ fixtureId: 'alpha', score: 9 }),
    ];
    expect(bestMatch(scores)?.fixtureId).toBe('alpha');
  });

  it('returns the only match when there is a single fixture', () => {
    const best = bestMatch([makeScore({ fixtureId: 'solo', score: 6 })]);
    expect(best?.fixtureId).toBe('solo');
    expect(best?.votes).toBe(1);
  });
});

describe('worstMatch', () => {
  it('returns null for empty scores', () => {
    expect(worstMatch([])).toBeNull();
  });

  it('returns the match with the lowest Nota_de_Jogo', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'f1', score: 5 }),
      makeScore({ fixtureId: 'f2', score: 9 }),
      makeScore({ fixtureId: 'f3', score: 2 }),
    ];
    const worst = worstMatch(scores);
    expect(worst?.fixtureId).toBe('f3');
    expect(worst?.average).toBe(2);
  });

  it('breaks ties on the lowest average by fixtureId', () => {
    const scores: GameScore[] = [
      makeScore({ fixtureId: 'zebra', score: 3 }),
      makeScore({ fixtureId: 'alpha', score: 3 }),
    ];
    expect(worstMatch(scores)?.fixtureId).toBe('alpha');
  });
});
