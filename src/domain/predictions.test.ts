/**
 * Unit tests for the Prediction (Palpite) scoring domain module
 * (`domain/predictions.ts`).
 *
 * Concrete, example-based coverage of `scorePrediction` against the four
 * scenarios required by the design: an exact score, a correct result only,
 * partial lineup hits, and an empty/null prediction.
 *
 * @see Requirement 23.4 — pontuar os Palpites comparando-os ao resultado real.
 * @see Requirement 23.5 — computar o ganho de Fan_Score correspondente aos acertos.
 */
import { describe, it, expect } from 'vitest';
import { scorePrediction, type FixtureResult } from './predictions';
import type { Prediction } from '../types/domain';
import type { PredictionConfig } from '../types/config';

// Data-driven point values reused across cases. Distinct, non-overlapping
// values make it easy to assert exactly which kind of hit contributed points.
const CFG: PredictionConfig = {
  exactScore: 10,
  correctResult: 5,
  lineupHitPerPlayer: 1,
};

/** Builds a Prediction, allowing per-test overrides of the scored fields. */
function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    fixtureId: 'f1',
    username: 'ana',
    homeScore: 0,
    awayScore: 0,
    lineupPlayerIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('scorePrediction', () => {
  it('awards exact-score, correct-result and lineup points for a perfect prediction', () => {
    // Requirement 23.4/23.5: exact 2-1 with two lineup players in the real lineup.
    const prediction = makePrediction({
      homeScore: 2,
      awayScore: 1,
      lineupPlayerIds: ['p1', 'p2'],
    });
    const actual: FixtureResult = {
      homeScore: 2,
      awayScore: 1,
      lineupPlayerIds: ['p1', 'p2', 'p3'],
    };

    const outcome = scorePrediction(prediction, actual, CFG);

    expect(outcome.exactScore).toBe(true);
    expect(outcome.correctResult).toBe(true);
    expect(outcome.lineupHits).toBe(2);
    // 10 (exact) + 5 (result) + 2 * 1 (lineup) = 17
    expect(outcome.points).toBe(17);
    expect(outcome.fixtureId).toBe('f1');
    expect(outcome.username).toBe('ana');
  });

  it('awards only correct-result points when the winner matches but the score is wrong', () => {
    // Predicted a 3-0 home win; actual is a 1-0 home win: same result sign,
    // different exact score, and no lineup overlap.
    const prediction = makePrediction({
      homeScore: 3,
      awayScore: 0,
      lineupPlayerIds: ['p9'],
    });
    const actual: FixtureResult = {
      homeScore: 1,
      awayScore: 0,
      lineupPlayerIds: ['p1', 'p2'],
    };

    const outcome = scorePrediction(prediction, actual, CFG);

    expect(outcome.exactScore).toBe(false);
    expect(outcome.correctResult).toBe(true);
    expect(outcome.lineupHits).toBe(0);
    // 0 (exact) + 5 (result) + 0 (lineup) = 5
    expect(outcome.points).toBe(5);
  });

  it('awards only lineup points for partial lineup hits with a wrong result', () => {
    // Predicted an away win (0-2) but actual is a home win (2-0): result wrong,
    // score wrong. Two of the three predicted players (incl. a duplicate) started.
    const prediction = makePrediction({
      homeScore: 0,
      awayScore: 2,
      lineupPlayerIds: ['p1', 'p2', 'p1', 'p8'],
    });
    const actual: FixtureResult = {
      homeScore: 2,
      awayScore: 0,
      lineupPlayerIds: ['p1', 'p2', 'p3'],
    };

    const outcome = scorePrediction(prediction, actual, CFG);

    expect(outcome.exactScore).toBe(false);
    expect(outcome.correctResult).toBe(false);
    // p1 (deduplicated) and p2 hit; p8 misses.
    expect(outcome.lineupHits).toBe(2);
    // 0 + 0 + 2 * 1 = 2
    expect(outcome.points).toBe(2);
  });

  it('awards zero points for an empty/null prediction', () => {
    // No score predicted and no lineup submitted.
    const prediction = makePrediction({
      homeScore: null,
      awayScore: null,
      lineupPlayerIds: [],
    });
    const actual: FixtureResult = {
      homeScore: 2,
      awayScore: 1,
      lineupPlayerIds: ['p1', 'p2'],
    };

    const outcome = scorePrediction(prediction, actual, CFG);

    expect(outcome.exactScore).toBe(false);
    expect(outcome.correctResult).toBe(false);
    expect(outcome.lineupHits).toBe(0);
    expect(outcome.points).toBe(0);
  });

  it('awards no score-based points when the actual score is unavailable', () => {
    // Guards the partial-availability branch: a fully predicted score but the
    // fixture result is not yet registered. Lineup hits still count.
    const prediction = makePrediction({
      homeScore: 1,
      awayScore: 1,
      lineupPlayerIds: ['p1'],
    });
    const actual: FixtureResult = {
      homeScore: null,
      awayScore: null,
      lineupPlayerIds: ['p1', 'p2'],
    };

    const outcome = scorePrediction(prediction, actual, CFG);

    expect(outcome.exactScore).toBe(false);
    expect(outcome.correctResult).toBe(false);
    expect(outcome.lineupHits).toBe(1);
    expect(outcome.points).toBe(1);
  });

  it('does not mutate its inputs', () => {
    const prediction = makePrediction({
      homeScore: 2,
      awayScore: 1,
      lineupPlayerIds: ['p1'],
    });
    const actual: FixtureResult = {
      homeScore: 2,
      awayScore: 1,
      lineupPlayerIds: ['p1'],
    };

    scorePrediction(prediction, actual, CFG);

    expect(prediction.lineupPlayerIds).toEqual(['p1']);
    expect(actual.lineupPlayerIds).toEqual(['p1']);
    expect(prediction.outcome).toBeUndefined();
  });
});
