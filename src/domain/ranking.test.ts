/**
 * Example-based unit tests for the ranking domain module (`domain/ranking.ts`).
 *
 * These tests exercise `buildRankings` with concrete, hand-built inputs to
 * verify the observable behaviour of every category:
 *  - eligibility (at least 1 vote in general, at least 3 rated matches for the
 *    "Mais Consistente" category — Requirements 26.1, 26.10),
 *  - descending ordering by the primary metric of each category,
 *  - the competition filter recomputing rankings from a subset (Requirement 26.3),
 *  - deterministic tie-breaking (votes desc, then name asc, then id asc).
 */
import { describe, it, expect } from 'vitest';
import { buildRankings } from './ranking';
import type { Fixture, GameScore, Player, Position } from '../types/domain';

// ---------------------------------------------------------------------------
// Fixtures / factories
// ---------------------------------------------------------------------------

let scoreSeq = 0;

function makePlayer(id: string, name: string, position: Position = 'Midfielder'): Player {
  return { id, name, position, number: null, nationality: null, photo: null };
}

function makeFixture(id: string, competition: number): Fixture {
  return {
    id,
    homeTeam: 'Cruzeiro',
    awayTeam: `Rival ${id}`,
    homeScore: null,
    awayScore: null,
    fixtureDate: `2024-01-${id.padStart(2, '0')}`,
    ts: 0,
    competition,
    stadium: null,
    status: 'finished',
    liberado: true,
  };
}

function makeScore(fixtureId: string, playerId: string, playerName: string, score: number): GameScore {
  scoreSeq += 1;
  return {
    fixtureId,
    playerId,
    playerName,
    username: `voter_${scoreSeq}`,
    score,
    homeTeam: 'Cruzeiro',
    awayTeam: `Rival ${fixtureId}`,
    fixtureDate: `2024-01-${fixtureId.padStart(2, '0')}`,
    createdAt: '2024-01-01T00:00:00Z',
  };
}

// A player's per-fixture rating helper: one individual rating per fixture.
function ratingsAcrossFixtures(
  playerId: string,
  playerName: string,
  perFixture: Array<{ fixtureId: string; score: number }>,
): GameScore[] {
  return perFixture.map((r) => makeScore(r.fixtureId, playerId, playerName, r.score));
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

describe('buildRankings — eligibility', () => {
  it('excludes squad players that received no votes from every player category', () => {
    const rated = makePlayer('p1', 'Rated');
    const unrated = makePlayer('p2', 'Unrated');
    const scores = ratingsAcrossFixtures('p1', 'Rated', [{ fixtureId: '1', score: 8 }]);

    const result = buildRankings(scores, [rated, unrated]);

    const overallIds = result.overallAverage.map((e) => e.playerId);
    expect(overallIds).toContain('p1');
    expect(overallIds).not.toContain('p2');
    expect(result.mostVotes.map((e) => e.playerId)).not.toContain('p2');
  });

  it('requires at least 3 rated matches for the "Mais Consistente" category', () => {
    // p1 rated in 3 distinct fixtures -> eligible; p2 rated in only 2 -> excluded.
    const p1 = makePlayer('p1', 'Consistent');
    const p2 = makePlayer('p2', 'TwoMatches');
    const scores = [
      ...ratingsAcrossFixtures('p1', 'Consistent', [
        { fixtureId: '1', score: 7 },
        { fixtureId: '2', score: 7 },
        { fixtureId: '3', score: 7 },
      ]),
      ...ratingsAcrossFixtures('p2', 'TwoMatches', [
        { fixtureId: '1', score: 6 },
        { fixtureId: '2', score: 6 },
      ]),
    ];

    const result = buildRankings(scores, [p1, p2]);

    const consistentIds = result.mostConsistent.map((e) => e.playerId);
    expect(consistentIds).toContain('p1');
    expect(consistentIds).not.toContain('p2');
    // p2 still appears in categories that only need a vote.
    expect(result.overallAverage.map((e) => e.playerId)).toContain('p2');
  });

  it('requires at least 1 vote for the "Melhor por Posição" category', () => {
    const keeper = makePlayer('gk1', 'Keeper', 'Goalkeeper');
    const benchKeeper = makePlayer('gk2', 'BenchKeeper', 'Goalkeeper');
    const scores = ratingsAcrossFixtures('gk1', 'Keeper', [{ fixtureId: '1', score: 9 }]);

    const result = buildRankings(scores, [keeper, benchKeeper]);

    const goalkeeperIds = result.bestByPosition.Goalkeeper.map((e) => e.playerId);
    expect(goalkeeperIds).toEqual(['gk1']);
  });
});

// ---------------------------------------------------------------------------
// Descending ordering
// ---------------------------------------------------------------------------

describe('buildRankings — descending ordering', () => {
  const players = [
    makePlayer('a', 'Alpha'),
    makePlayer('b', 'Bravo'),
    makePlayer('c', 'Charlie'),
  ];
  // avg: c=9, a=8, b=6 ; votes: a=3, b=2, c=1
  const scores = [
    ...ratingsAcrossFixtures('a', 'Alpha', [
      { fixtureId: '1', score: 8 },
      { fixtureId: '2', score: 8 },
      { fixtureId: '3', score: 8 },
    ]),
    ...ratingsAcrossFixtures('b', 'Bravo', [
      { fixtureId: '1', score: 6 },
      { fixtureId: '2', score: 6 },
    ]),
    ...ratingsAcrossFixtures('c', 'Charlie', [{ fixtureId: '1', score: 9 }]),
  ];

  it('orders "Melhor Média Geral" by season average, descending, with 1-based ranks', () => {
    const result = buildRankings(scores, players);

    expect(result.overallAverage.map((e) => e.playerId)).toEqual(['c', 'a', 'b']);
    expect(result.overallAverage.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(result.overallAverage.map((e) => e.avg)).toEqual([9, 8, 6]);
  });

  it('orders "Mais Votos" by total votes, descending', () => {
    const result = buildRankings(scores, players);

    expect(result.mostVotes.map((e) => e.playerId)).toEqual(['a', 'b', 'c']);
    expect(result.mostVotes.map((e) => e.votes)).toEqual([3, 2, 1]);
  });

  it('orders "Mais Consistente" by lowest standard deviation first', () => {
    // steady rated in 3 fixtures with equal scores (stdDev 0);
    // swingy rated in 3 fixtures with varied scores (stdDev > 0).
    const steady = makePlayer('s', 'Steady');
    const swingy = makePlayer('w', 'Swingy');
    const consistencyScores = [
      ...ratingsAcrossFixtures('s', 'Steady', [
        { fixtureId: '1', score: 7 },
        { fixtureId: '2', score: 7 },
        { fixtureId: '3', score: 7 },
      ]),
      ...ratingsAcrossFixtures('w', 'Swingy', [
        { fixtureId: '1', score: 2 },
        { fixtureId: '2', score: 9 },
        { fixtureId: '3', score: 5 },
      ]),
    ];

    const result = buildRankings(consistencyScores, [steady, swingy]);

    expect(result.mostConsistent.map((e) => e.playerId)).toEqual(['s', 'w']);
    expect(result.mostConsistent[0].stdDev).toBe(0);
    expect(result.mostConsistent[1].stdDev).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Competition filter
// ---------------------------------------------------------------------------

describe('buildRankings — competition filter', () => {
  const player = makePlayer('a', 'Alpha');
  const fixtures = [makeFixture('1', 71), makeFixture('2', 73)];
  // fixture 1 (Série A / 71): score 9 ; fixture 2 (Copa do Brasil / 73): score 3
  const scores = ratingsAcrossFixtures('a', 'Alpha', [
    { fixtureId: '1', score: 9 },
    { fixtureId: '2', score: 3 },
  ]);

  it('considers all ratings when no competition is supplied', () => {
    const result = buildRankings(scores, [player], fixtures);
    expect(result.overallAverage[0].avg).toBe(6); // (9 + 3) / 2
    expect(result.overallAverage[0].votes).toBe(2);
  });

  it('recomputes rankings from only the selected competition', () => {
    const serieA = buildRankings(scores, [player], fixtures, 71);
    expect(serieA.overallAverage[0].avg).toBe(9);
    expect(serieA.overallAverage[0].votes).toBe(1);

    const copaBrasil = buildRankings(scores, [player], fixtures, 73);
    expect(copaBrasil.overallAverage[0].avg).toBe(3);
    expect(copaBrasil.overallAverage[0].votes).toBe(1);
  });

  it('yields empty player rankings when no fixture matches the competition', () => {
    const result = buildRankings(scores, [player], fixtures, 999);
    expect(result.overallAverage).toEqual([]);
    expect(result.mostVotes).toEqual([]);
    expect(result.bestRatedMatches).toEqual([]);
  });

  it('tags best-rated matches with their competition when fixtures are supplied', () => {
    const result = buildRankings(scores, [player], fixtures);
    const byId = new Map(result.bestRatedMatches.map((m) => [m.fixtureId, m.competition]));
    expect(byId.get('1')).toBe(71);
    expect(byId.get('2')).toBe(73);
  });
});

// ---------------------------------------------------------------------------
// Tie-breaking
// ---------------------------------------------------------------------------

describe('buildRankings — tie-breaking', () => {
  it('breaks equal averages by votes, descending', () => {
    // Both players average 7, but "many" has more votes.
    const few = makePlayer('few', 'Zeta');
    const many = makePlayer('many', 'Alpha');
    const scores = [
      ...ratingsAcrossFixtures('few', 'Zeta', [{ fixtureId: '1', score: 7 }]),
      ...ratingsAcrossFixtures('many', 'Alpha', [
        { fixtureId: '1', score: 7 },
        { fixtureId: '2', score: 7 },
      ]),
    ];

    const result = buildRankings(scores, [few, many]);

    expect(result.overallAverage.map((e) => e.playerId)).toEqual(['many', 'few']);
  });

  it('breaks equal averages and equal votes by player name, ascending', () => {
    // Same avg (7) and same votes (1); ordered by name: "Ana" before "Beto".
    const beto = makePlayer('p-beto', 'Beto');
    const ana = makePlayer('p-ana', 'Ana');
    const scores = [
      ...ratingsAcrossFixtures('p-beto', 'Beto', [{ fixtureId: '1', score: 7 }]),
      ...ratingsAcrossFixtures('p-ana', 'Ana', [{ fixtureId: '1', score: 7 }]),
    ];

    const result = buildRankings(scores, [beto, ana]);

    expect(result.overallAverage.map((e) => e.playerName)).toEqual(['Ana', 'Beto']);
  });

  it('breaks equal averages, votes and names by player id, ascending', () => {
    // Identical name and metrics; the lower id wins the final tie-break.
    const dup2 = makePlayer('id-2', 'Twin');
    const dup1 = makePlayer('id-1', 'Twin');
    const scores = [
      ...ratingsAcrossFixtures('id-2', 'Twin', [{ fixtureId: '1', score: 7 }]),
      ...ratingsAcrossFixtures('id-1', 'Twin', [{ fixtureId: '1', score: 7 }]),
    ];

    const result = buildRankings(scores, [dup2, dup1]);

    expect(result.overallAverage.map((e) => e.playerId)).toEqual(['id-1', 'id-2']);
  });
});
