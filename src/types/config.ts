/**
 * Data-driven configuration types (framework-agnostic).
 *
 * These are the canonical definitions for the tunable rule sets that drive
 * gamification and prediction scoring. They are plain **data-object shapes** —
 * they carry no logic. The pure `domain` layer (`fanScore.ts`, `achievements.ts`,
 * `predictions.ts`) reads these objects so values can be adjusted without
 * touching the pure functions or any UI component
 * (Requirements 9.7, 10.1, 23.4).
 *
 * This module is the canonical home of {@link AchievementCondition}; `domain.ts`
 * imports it from here to avoid divergent definitions.
 *
 * Like the rest of the `types` layer, this file holds only type declarations —
 * no runtime logic. UI strings are always referenced as {@link I18nKey}.
 */

import type { FanLevel, Position } from './domain';

// ---------------------------------------------------------------------------
// Fan Score configuration (Requirement 9.7)
// ---------------------------------------------------------------------------

/**
 * A scorable participation action that awards Fan Score points.
 *
 * Mirrors the participation actions rewarded by Requirement 9.1 (rating a
 * match, rating a full lineup, consecutive matches, daily return, a full
 * season, voting for the Man of the Match and hitting a prediction).
 */
export type FanScoreAction =
  | 'rate_match'
  | 'rate_full_lineup'
  | 'consecutive_match'
  | 'daily_return'
  | 'full_season'
  | 'vote_craque'
  | 'prediction_hit';

/**
 * A single Fan Score level threshold: the minimum Fan Score required to reach
 * {@link FanLevel} `level`. Thresholds are listed in ascending order of `min`.
 */
export interface FanLevelThreshold {
  /** Supporter level reached at or above {@link min}. */
  level: FanLevel;
  /** Minimum Fan Score required to reach {@link level}. */
  min: number;
}

/**
 * Data-driven Fan Score rules (Requirement 9.7).
 *
 * Adjusting {@link actionPoints} or {@link levelThresholds} re-tunes the whole
 * Fan Score system without changing the pure scoring functions or the UI.
 */
export interface FanScoreConfig {
  /** Points awarded per scorable action (e.g. `rate_match: 10`, `vote_craque: 5`). */
  actionPoints: Record<FanScoreAction, number>;
  /** Level thresholds in ascending order (Requirement 9.4). */
  levelThresholds: FanLevelThreshold[];
}

// ---------------------------------------------------------------------------
// Prediction (Palpite) scoring configuration (Requirement 23.4-23.5)
// ---------------------------------------------------------------------------

/**
 * Data-driven prediction scoring rules (Requirements 23.4-23.5).
 *
 * Consumed by the pure `scorePrediction` function to award points for a
 * pre-match prediction against the final fixture outcome.
 */
export interface PredictionConfig {
  /** Points for predicting the exact final score. */
  exactScore: number;
  /** Points for predicting the correct result (winner/draw). */
  correctResult: number;
  /** Points per correctly predicted player in the lineup. */
  lineupHitPerPlayer: number;
}

// ---------------------------------------------------------------------------
// Achievement condition (canonical) (Requirement 10.1)
// ---------------------------------------------------------------------------

/**
 * The kind of rule an {@link AchievementCondition} evaluates.
 *
 * Covers the minimum required achievements (Requirement 10.2):
 *   - `total_ratings`        -> "Primeira Avaliação", "10 Avaliações", "100 Avaliações"
 *   - `competition_complete` -> "Avaliou Todos os Jogos do Brasileirão"/"da Libertadores"
 *   - `position_specialist`  -> "Especialista em Goleiros"/"Zagueiros"
 *   - `full_season`          -> "Torcedor da Temporada"
 *   - `veteran`              -> "Veterano da Comunidade"
 *
 * New achievements that reuse an existing kind are added by configuration data
 * alone, with no code changes (Requirement 10.1).
 */
export type AchievementConditionType =
  | 'total_ratings'
  | 'competition_complete'
  | 'position_specialist'
  | 'full_season'
  | 'veteran';

/**
 * Data-driven condition evaluated to unlock an achievement (Requirement 10.1).
 *
 * A plain data object interpreted by the pure `evaluateAchievements` function.
 * Kept extensible (all fields beyond `type` are optional) so new achievements
 * can be defined purely as configuration.
 */
export interface AchievementCondition {
  /** Which rule this condition evaluates. */
  type: AchievementConditionType;
  /** Numeric target, e.g. number of ratings or days of tenure. */
  threshold?: number;
  /** Position scope for `position_specialist` conditions. */
  position?: Position;
  /** Competition id scope for `competition_complete` conditions. */
  competition?: number;
}
