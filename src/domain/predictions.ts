/**
 * Prediction (Palpite) scoring domain module.
 *
 * Pure, framework-agnostic scoring of a pre-match {@link Prediction} against the
 * final fixture result. All rules are data-driven via {@link PredictionConfig}
 * so the point values for an exact score, a correct result (winner/draw) and a
 * per-player lineup hit can be re-tuned without touching this function or any UI
 * component. This module imports ONLY from the `types` layer (Requirement 1.2).
 *
 * @see Requirement 23.4 — pontuar os Palpites comparando-os ao resultado real.
 * @see Requirement 23.5 — computar o ganho de Fan_Score correspondente aos acertos.
 */

import type { Prediction, PredictionOutcome } from '../types/domain';
import type { PredictionConfig } from '../types/config';

/**
 * The final, official result of a fixture used to score a {@link Prediction}.
 *
 * Scores are the confirmed home/away goals; `lineupPlayerIds` are the ids of the
 * players that actually started (the real lineup). A `null` score represents an
 * outcome that is not yet available and disables score-based scoring.
 */
export interface FixtureResult {
  /** Confirmed final home-team score, or `null` when unavailable. */
  homeScore: number | null;
  /** Confirmed final away-team score, or `null` when unavailable. */
  awayScore: number | null;
  /** Ids of the players in the actual (real) lineup. */
  lineupPlayerIds: string[];
}

/**
 * Returns the sign of a match result from the home team's perspective:
 * `1` home win, `-1` away win, `0` draw.
 */
function resultSign(homeScore: number, awayScore: number): -1 | 0 | 1 {
  if (homeScore > awayScore) {
    return 1;
  }
  if (homeScore < awayScore) {
    return -1;
  }
  return 0;
}

/**
 * Scores a pre-match {@link Prediction} against the final {@link FixtureResult}.
 *
 * The outcome is fully data-driven by {@link PredictionConfig}:
 *  - `exactScore`  — awarded when both predicted goals equal the actual goals.
 *  - `correctResult` — awarded when the predicted winner/draw matches the actual
 *    result, even if the exact score is wrong.
 *  - `lineupHitPerPlayer` — awarded once per distinct predicted player that
 *    appears in the actual lineup.
 *
 * Empty or partial predictions are handled gracefully: if either predicted score
 * is `null` (or either actual score is `null`), no exact-score or correct-result
 * points are awarded; an empty predicted lineup yields zero lineup hits. Duplicate
 * ids in the predicted lineup are counted at most once.
 *
 * The function is pure and deterministic — it never mutates its inputs and its
 * result depends only on its arguments.
 *
 * @param prediction - The user's pre-match prediction (scores may be `null`).
 * @param actual - The confirmed fixture result and real lineup.
 * @param cfg - Data-driven point values for each kind of hit.
 * @returns A {@link PredictionOutcome} with the total `points` and the per-kind
 *   breakdown (`exactScore`, `correctResult`, `lineupHits`).
 *
 * @example
 * // exact 2-1 with cfg { exactScore: 10, correctResult: 5, lineupHitPerPlayer: 1 }
 * scorePrediction(
 *   { fixtureId: 'f1', username: 'ana', homeScore: 2, awayScore: 1, lineupPlayerIds: ['p1'], createdAt: '' },
 *   { homeScore: 2, awayScore: 1, lineupPlayerIds: ['p1', 'p2'] },
 *   { exactScore: 10, correctResult: 5, lineupHitPerPlayer: 1 },
 * );
 * // -> { ..., points: 16, exactScore: true, correctResult: true, lineupHits: 1 }
 */
export function scorePrediction(
  prediction: Prediction,
  actual: FixtureResult,
  cfg: PredictionConfig,
): PredictionOutcome {
  const hasScores =
    prediction.homeScore !== null &&
    prediction.awayScore !== null &&
    actual.homeScore !== null &&
    actual.awayScore !== null;

  const exactScore =
    hasScores &&
    prediction.homeScore === actual.homeScore &&
    prediction.awayScore === actual.awayScore;

  const correctResult =
    hasScores &&
    resultSign(prediction.homeScore as number, prediction.awayScore as number) ===
      resultSign(actual.homeScore as number, actual.awayScore as number);

  const actualLineup = new Set(actual.lineupPlayerIds);
  const predictedUnique = new Set(prediction.lineupPlayerIds);
  let lineupHits = 0;
  for (const playerId of predictedUnique) {
    if (actualLineup.has(playerId)) {
      lineupHits += 1;
    }
  }

  const points =
    (exactScore ? cfg.exactScore : 0) +
    (correctResult ? cfg.correctResult : 0) +
    lineupHits * cfg.lineupHitPerPlayer;

  return {
    fixtureId: prediction.fixtureId,
    username: prediction.username,
    points,
    exactScore,
    correctResult,
    lineupHits,
  };
}
