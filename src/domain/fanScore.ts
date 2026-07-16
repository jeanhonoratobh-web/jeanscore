/**
 * Fan Score and Supporter Level derivation (pure, framework-agnostic).
 *
 * Implements the data-driven Fan Score system: awarding points for
 * participation actions, mapping an accumulated score to a
 * {@link FanLevel} tier and computing the progress toward the next tier. All
 * rules come from a {@link FanScoreConfig} so values can be re-tuned without
 * touching this logic or any UI component (Requirement 9.7).
 *
 * This module lives in the pure `domain` layer and imports ONLY from `types` —
 * no React, DOM, services or network (Requirement 1.2).
 *
 * @see Requirements 9.1, 9.2 (award points per action, never negative),
 *   9.4 (level ordering), 9.6 (progress to next level), 9.7 (data-driven).
 */

import type { FanLevel } from '../types/domain';
import type { FanScoreAction, FanScoreConfig } from '../types/config';

/**
 * Canonical ascending order of Supporter Levels (Requirement 9.4):
 * Iniciante → Torcedor → Apaixonado → Especialista → Lenda.
 *
 * The array index is the ordinal returned by {@link levelIndex}.
 */
const LEVEL_ORDER: readonly FanLevel[] = [
  'iniciante',
  'torcedor',
  'apaixonado',
  'especialista',
  'lenda',
] as const;

/**
 * Progress of a Fan Score toward the next Supporter Level (Requirement 9.6).
 *
 * When the user is already at the highest level, {@link nextLevel} and
 * {@link nextThreshold} are `null`, {@link pointsToNext} is `0` and
 * {@link ratio} is `1`.
 */
export interface ProgressInfo {
  /** The user's current Supporter Level for the given score. */
  currentLevel: FanLevel;
  /** The next Supporter Level, or `null` when already at the top. */
  nextLevel: FanLevel | null;
  /** Minimum Fan Score of the current level. */
  currentThreshold: number;
  /** Minimum Fan Score of the next level, or `null` when at the top. */
  nextThreshold: number | null;
  /** Points already earned within the current level band. */
  pointsIntoLevel: number;
  /** Points still needed to reach the next level (`0` when at the top). */
  pointsToNext: number;
  /** Fractional progress within the current band in `[0, 1]`. */
  ratio: number;
}

/**
 * Returns the ordinal index of a Supporter Level (Requirement 9.4).
 *
 * The index reflects the ascending engagement order: `iniciante` is `0` and
 * `lenda` is `LEVEL_ORDER.length - 1`. An unknown level defaults to `0`.
 *
 * @param level - The Supporter Level to rank.
 * @returns The zero-based ordinal position of {@link level}.
 */
export function levelIndex(level: FanLevel): number {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx < 0 ? 0 : idx;
}

/**
 * Awards the points for a participation action to an existing Fan Score
 * (Requirements 9.1, 9.2).
 *
 * The award is data-driven: the number of points comes from
 * `cfg.actionPoints[action]`. To keep the Fan Score monotonic non-decreasing —
 * no scorable action ever reduces the score (Property 14) — the awarded points
 * are clamped to be at least `0`. A missing action mapping awards `0`.
 *
 * @param score - The current Fan Score (accumulated total).
 * @param action - The scorable participation action performed.
 * @param cfg - The data-driven Fan Score configuration.
 * @returns The new Fan Score, always `>= score`.
 */
export function applyFanScore(
  score: number,
  action: FanScoreAction,
  cfg: FanScoreConfig,
): number {
  const points = cfg.actionPoints[action] ?? 0;
  return score + Math.max(0, points);
}

/**
 * Maps a Fan Score to its Supporter Level (Requirement 9.4).
 *
 * Among all configured thresholds whose `min` has been reached
 * (`min <= score`), the level with the highest {@link levelIndex} is returned.
 * Selecting the maximum reached level guarantees monotonicity: as the score
 * grows, the set of reached thresholds only grows, so the resulting level index
 * never decreases (Property 15). When no threshold is reached (score below all
 * minimums) the lowest level `'iniciante'` is returned.
 *
 * @param score - The user's accumulated Fan Score.
 * @param cfg - The data-driven Fan Score configuration.
 * @returns The Supporter Level for {@link score}.
 */
export function fanLevel(score: number, cfg: FanScoreConfig): FanLevel {
  let best: FanLevel | null = null;
  for (const threshold of cfg.levelThresholds) {
    if (score >= threshold.min) {
      if (best === null || levelIndex(threshold.level) > levelIndex(best)) {
        best = threshold.level;
      }
    }
  }
  return best ?? 'iniciante';
}

/**
 * Computes the progress of a Fan Score toward the next Supporter Level
 * (Requirement 9.6).
 *
 * The current level is resolved with {@link fanLevel}; the next level is the
 * configured threshold with the smallest `min` strictly greater than the
 * current level's `min`. When the current level is the highest configured, the
 * progress is reported as complete (`ratio = 1`, `pointsToNext = 0`,
 * `nextLevel = null`).
 *
 * @param score - The user's accumulated Fan Score.
 * @param cfg - The data-driven Fan Score configuration.
 * @returns A {@link ProgressInfo} describing progress within the current band.
 */
export function progressToNext(score: number, cfg: FanScoreConfig): ProgressInfo {
  const currentLevel = fanLevel(score, cfg);
  const currentIdx = levelIndex(currentLevel);

  // Minimum Fan Score of the current level (0 when the level has no threshold).
  const currentThreshold = cfg.levelThresholds
    .filter((t) => t.level === currentLevel)
    .reduce<number | null>((acc, t) => (acc === null ? t.min : Math.min(acc, t.min)), null) ?? 0;

  // The next level is the reachable level with the smallest ordinal strictly
  // above the current one, taking the lowest `min` among any duplicates.
  let next: { level: FanLevel; min: number } | null = null;
  for (const threshold of cfg.levelThresholds) {
    if (levelIndex(threshold.level) <= currentIdx) {
      continue;
    }
    if (
      next === null ||
      levelIndex(threshold.level) < levelIndex(next.level) ||
      (levelIndex(threshold.level) === levelIndex(next.level) && threshold.min < next.min)
    ) {
      next = { level: threshold.level, min: threshold.min };
    }
  }

  if (next === null) {
    // Already at the highest configured level.
    return {
      currentLevel,
      nextLevel: null,
      currentThreshold,
      nextThreshold: null,
      pointsIntoLevel: Math.max(0, score - currentThreshold),
      pointsToNext: 0,
      ratio: 1,
    };
  }

  const band = next.min - currentThreshold;
  const pointsIntoLevel = Math.max(0, score - currentThreshold);
  const pointsToNext = Math.max(0, next.min - score);
  const ratio = band > 0 ? Math.min(1, Math.max(0, pointsIntoLevel / band)) : 1;

  return {
    currentLevel,
    nextLevel: next.level,
    currentThreshold,
    nextThreshold: next.min,
    pointsIntoLevel,
    pointsToNext,
    ratio,
  };
}
