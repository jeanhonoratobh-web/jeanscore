/**
 * Domain entity interfaces (framework-agnostic).
 *
 * Single source of truth for the shape of every domain entity used across the
 * application (Requirement 1.12). Every entity is intentionally extensible:
 * central entities carry optional fields reserved for future features so the
 * platform can grow without structural refactors, and consistency is preserved
 * (if one central entity is extensible, all are) (Requirement 5.3).
 *
 * This file lives in the `types` layer and holds only type declarations — no
 * runtime logic. The pure `domain` layer and the `services` layer consume these
 * types; UI strings are always referenced as {@link I18nKey}, never hardcoded.
 */

// ---------------------------------------------------------------------------
// Enumerated value types
// ---------------------------------------------------------------------------

/** Player field position category. */
export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker';

/** Application role of a user. */
export type UserRole = 'user' | 'admin';

/** Manual-approval lifecycle status of a user account. */
export type UserStatus = 'pending' | 'approved' | 'rejected';

/** Lifecycle status of a fixture. */
export type FixtureStatus = 'notstarted' | 'inprogress' | 'finished' | 'postponed';

/** FIFA-style card rarity derived from a player's score. */
export type Rarity = 'bronze' | 'silver' | 'gold' | 'legendary';

/** Supporter level tier, in ascending order of engagement. */
export type FanLevel = 'iniciante' | 'torcedor' | 'apaixonado' | 'especialista' | 'lenda';

// ---------------------------------------------------------------------------
// Supporting types owned by other modules
//
// The following are dependencies of the entity interfaces below whose canonical
// definitions live elsewhere:
//   - `I18nKey`              -> `i18n/keys.ts` (task 2.4, literal-union of UI keys)
//   - `AchievementCondition` -> `types/config.ts` (data-driven config, task 2.3)
// Both are imported/re-exported from their canonical homes to avoid divergent
// definitions.
// ---------------------------------------------------------------------------

/**
 * Technical i18n key (English) mapping to a pt-BR UI string.
 *
 * Canonical definition lives in `i18n/keys.ts` (task 2.4). Re-exported here so
 * the types layer stays a single import surface for entity shapes while there
 * is exactly one definition of {@link I18nKey} (Requirement 2.2). It is
 * imported locally so the entity interfaces below can reference it, and
 * re-exported so the types layer stays a single import surface.
 */
import type { I18nKey } from '../i18n/keys';
export type { I18nKey };

// Canonical data-driven config type; see `types/config.ts`. Consumers import it
// from the `types` barrel (which re-exports `./config`) or directly from
// `./config`; it is imported here only so the entity interfaces can reference it.
import type { AchievementCondition } from './config';

/**
 * Filter that selects which players belong to a {@link Collection}.
 *
 * Data-driven so new collections are added by configuration, not code
 * (Requirement 18.3).
 */
export interface CollectionFilter {
  position?: Position;
  rarity?: Rarity;
  competition?: number;
}

/**
 * Result of scoring a {@link Prediction} against the final fixture outcome
 * (Requirement 23.4).
 */
export interface PredictionOutcome {
  fixtureId: string;
  username: string;
  points: number;
  exactScore: boolean;
  correctResult: boolean;
  lineupHits: number;
}

// ---------------------------------------------------------------------------
// Football entities
// ---------------------------------------------------------------------------

/** A Cruzeiro squad player. */
export interface Player {
  id: string;
  name: string;
  position: Position;
  number: number | null;
  nationality: string | null;
  photo: string | null;
  achievements?: Achievement[]; // extension
  favorited?: boolean; // extension
}

/** A match (fixture) monitored by the platform. */
export interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  fixtureDate: string;
  ts: number; // timestamp (s) — used by Countdown and prediction lock
  competition: number;
  stadium: string | null;
  status: FixtureStatus;
  liberado: boolean;
  highlightsUrl?: string; // extension
}

/** A single user's rating of a player in a specific fixture. */
export interface GameScore {
  fixtureId: string;
  playerId: string;
  playerName: string;
  username: string;
  score: number; // [0,10], step 0.5
  homeTeam: string;
  awayTeam: string;
  fixtureDate: string;
  createdAt: string;
  comment?: string; // extension
}

/** A user's permanent (yearly) rating of a player. */
export interface PermanentScore {
  playerId: string;
  playerName: string;
  username: string;
  year: number;
  score: number;
  createdAt?: string;
}

/** An application user account. */
export interface User {
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  premium?: boolean; // extension (future requirePremium)
}

/** The set of players called up for a specific fixture. */
export interface Lineup {
  fixtureId: string;
  playerIds: string[];
  players?: Player[];
}

/** A single entry in a computed ranking. */
export interface RankingEntry {
  playerId: string;
  playerName: string;
  position: Position;
  avg: number;
  votes: number;
  rank: number;
  stdDev?: number; // extension (Most Consistent category)
  trend?: number; // extension
}

// ---------------------------------------------------------------------------
// Engagement / gamification entities
// ---------------------------------------------------------------------------

/** Aggregated personal profile of an authenticated user. */
export interface UserProfile {
  username: string;
  memberSince: string; // "Membro Desde" (Requirement 8.1)
  totalRatings: number; // Total de Avaliações
  matchesRated: number; // Jogos Avaliados
  favoritePlayerId: string | null;
  fanScore: number; // Requirement 8.3, 9
  fanLevel: FanLevel;
  achievements: Achievement[]; // Requirement 8.4
  badges: Badge[]; // Requirement 8.5
  onboardingComplete: boolean; // Requirement 7.2
  favorited?: string[]; // extension
}

/** Data-driven achievement definition (catalog entry) (Requirement 10.1). */
export interface AchievementDef {
  id: string;
  titleKey: I18nKey; // title in pt-BR via i18n
  descriptionKey: I18nKey;
  condition: AchievementCondition; // evaluated by evaluateAchievements
}

/** An achievement's unlock state for a user. */
export interface Achievement {
  id: string;
  unlockedAt: string | null; // null = pending (Requirement 10.4)
}

/** A visual badge shown on a user profile. */
export interface Badge {
  id: string;
  kind: 'level' | 'achievement';
  labelKey: I18nKey;
}

/** A data-driven collectible collection (Requirement 18.3). */
export interface Collection {
  id: string;
  titleKey: I18nKey;
  playerFilter: CollectionFilter; // e.g. by position, rarity, competition
}

/** A user's pre-match prediction (Palpite) (Requirement 23). */
export interface Prediction {
  fixtureId: string;
  username: string;
  homeScore: number | null;
  awayScore: number | null;
  lineupPlayerIds: string[];
  createdAt: string;
  outcome?: PredictionOutcome; // filled after scoring
}

/** A user's Man of the Match vote (Craque da Partida) (Requirement 22). */
export interface CraqueVote {
  fixtureId: string;
  username: string; // 1 active vote per user/fixture
  playerId: string;
  createdAt: string;
}

/** A single recent-activity entry on a user profile. */
export interface ActivityItem {
  playerId: string;
  playerName: string;
  fixtureId: string;
  score: number;
  createdAt: string;
}

/** A milestone on a user's activity timeline. */
export interface TimelineMilestone {
  kind: 'first_rating' | 'achievement' | 'level_up';
  label: I18nKey;
  at: string;
}
