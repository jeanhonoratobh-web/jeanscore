/**
 * Raw Supabase row types (`types/supabase.ts`).
 *
 * These interfaces mirror the exact column shapes returned by the Supabase REST
 * API for each table. They are intentionally "dumb" data shapes: no logic, no
 * derived fields. The domain serialization layer (`domain/serialization.ts`)
 * converts them to and from the framework-agnostic domain entities.
 *
 * Naming and column names follow the Supabase schema documented in the
 * requirements Glossary and the design document. All identifiers are in English
 * per the product's two-language rule.
 *
 * Requirements: 1.6 (typed responses for every Supabase call), 5.3 (extensible
 * TypeScript interfaces for all entities).
 */

/**
 * Discriminated union returned by every `SupabaseClient` call.
 *
 * On success, `ok` is `true` and `data` carries the typed payload. On failure,
 * `ok` is `false` and `error` carries a human-readable message; `status` holds
 * the HTTP status code and `code` carries the SQLSTATE (e.g. `23505` for a
 * unique-violation) so the domain layer can translate specific database errors.
 *
 * Requirement: 1.6.
 */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; code?: string };

/**
 * Row of the `squad` table: a Cruzeiro player.
 *
 * Requirement: 1.6.
 */
export interface SupabaseSquadRow {
  id: string;
  name: string;
  position: string;
  number: number | null;
  nationality: string | null;
  photo: string | null;
}

/**
 * Row of the `fixtures` table: a match.
 *
 * `home_score`/`away_score` are `null` before the match is played and
 * `stadium` is `null` when unknown.
 *
 * Requirement: 1.6.
 */
export interface SupabaseFixtureRow {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  fixture_date: string;
  ts: number;
  competition: string;
  stadium: string | null;
  status: string;
  liberado: boolean;
}

/**
 * Row of the `escalacoes` table: one player called up for a given fixture.
 *
 * Requirement: 1.6.
 */
export interface SupabaseEscalacaoRow {
  fixture_id: string;
  player_id: string;
}

/**
 * Row of the `game_scores` table: a single per-match rating submitted by a
 * user for a player.
 *
 * Requirement: 1.6.
 */
export interface SupabaseGameScoreRow {
  fixture_id: string;
  player_id: string;
  player_name: string;
  username: string;
  score: number;
  home_team: string;
  away_team: string;
  fixture_date: string;
  created_at: string;
}

/**
 * Row of the `permanent_scores` table: an annual permanent rating submitted by
 * a user for a player (one per user, per player, per year).
 *
 * Requirement: 1.6.
 */
export interface SupabasePermanentScoreRow {
  player_id: string;
  player_name: string;
  username: string;
  year: number;
  score: number;
}

/**
 * Row of the `users` table.
 *
 * `pass_hash` stores the SHA-256 hash of the password; plain-text passwords are
 * never persisted.
 *
 * Requirement: 1.6.
 */
export interface SupabaseUserRow {
  username: string;
  email: string;
  pass_hash: string;
  role: string;
  status: string;
  created_at: string;
}

/**
 * Row of the `craque_votes` table: one "Craque da Partida" vote (distinct from
 * the 0-10 ratings) cast by a user for a player in a fixture.
 *
 * Requirement: 1.6.
 */
export interface SupabaseCraqueVoteRow {
  fixture_id: string;
  username: string;
  player_id: string;
  created_at: string;
}

/**
 * Row of the `predictions` table: a pre-match prediction (score and/or lineup)
 * submitted by a user before kickoff. `points` is `null` until the fixture is
 * scored against the real result.
 *
 * Requirement: 1.6.
 */
export interface SupabasePredictionRow {
  fixture_id: string;
  username: string;
  home_score: number | null;
  away_score: number | null;
  lineup_player_ids: string[];
  points: number | null;
  created_at: string;
}

/**
 * Row of the `fan_scores` table: a user's accumulated Fan Score and current
 * Fan Level.
 *
 * Requirement: 1.6.
 */
export interface SupabaseFanScoreRow {
  username: string;
  fan_score: number;
  fan_level: string;
  updated_at: string;
}

/**
 * Row of the `achievements` table: an achievement unlocked by a user.
 *
 * Requirement: 1.6.
 */
export interface SupabaseAchievementRow {
  username: string;
  achievement_id: string;
  unlocked_at: string;
}

/**
 * Row of the `onboarding` table: tracks whether a user has completed the
 * welcome onboarding flow.
 *
 * Requirement: 1.6.
 */
export interface SupabaseOnboardingRow {
  username: string;
  completed: boolean;
  completed_at: string | null;
}
