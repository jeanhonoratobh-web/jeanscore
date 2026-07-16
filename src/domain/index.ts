/**
 * Domain layer barrel.
 *
 * Pure, framework-agnostic business logic (scoring, rarity, filters, search,
 * ranking, statistics, fan score, achievements, team of the month, predictions).
 * This layer imports ONLY from `types` and never from React, services, router,
 * components or pages (Requirement 1.2). Populated by later tasks (4.x-6.x).
 */
export { calcRarity, mapScoreToRating } from './rarity';
export {
  toPlayer,
  toFixture,
  toFixtureRow,
  toGameScore,
  serializeScore,
  deserializeScore,
} from './serialization';
export type { ScoreEntry } from './serialization';
export {
  normalizeScore,
  isValidScore,
  calcAverage,
  calcStdDev,
} from './scoring';
export { filterByPosition, filterCombined, sortPlayers } from './filters';
export type {
  PositionFilter,
  SortMode,
  PlayerFilters,
  FilterablePlayer,
  SortablePlayer,
} from './filters';
export { normalizeText, search } from './search';
export {
  applyFanScore,
  fanLevel,
  levelIndex,
  progressToNext,
} from './fanScore';
export type { ProgressInfo } from './fanScore';
export {
  buildHistogram,
  buildEvolution,
  trendingPlayers,
  strengthsWeaknesses,
  bestMatch,
  worstMatch,
} from './stats';
export type {
  MatchScore,
  EvolutionPoint,
  PlayerTrend,
  StrengthProfile,
} from './stats';
export { buildRankings } from './ranking';
export type { RankingSet, BestRatedMatch } from './ranking';
export { evaluateAchievements } from './achievements';
export type { AchievementContext } from './achievements';
export { scorePrediction } from './predictions';
export type { FixtureResult } from './predictions';
export { buildTeamOfMonth } from './teamOfMonth';
export type { Formation, TeamOfMonthSlot } from './teamOfMonth';
