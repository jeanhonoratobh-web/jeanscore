/**
 * Service layer input/output types (framework-agnostic).
 *
 * These are the request/response shapes exchanged with the data-access
 * Services layer (`src/services/`) that are not raw Supabase rows nor pure
 * domain entities: admin write inputs (`PlayerInput`) and the outcome of a bulk
 * import operation (`BatchResult`).
 *
 * They live in the `types` layer so both the Services layer and the UI can
 * reference a single canonical shape without importing from `services/`. Like
 * the rest of the `types` layer, this file holds only type declarations — no
 * runtime logic.
 *
 * Requirements: 28.5 (batch import with up-front required-field validation and
 * whole-batch rejection on failure), 31.5 (partial-success reporting with the
 * number of successes and failures).
 */

import type { FixtureStatus, Position } from './domain';

/**
 * Writable fields for creating or importing a squad {@link Player}.
 *
 * `id`, `name` and `position` are required by Requirement 28.5 and validated
 * before a batch import begins. The remaining columns are optional and default
 * to `null` when omitted. Updates use `Partial<PlayerInput>`.
 */
export interface PlayerInput {
  /** Stable player identifier (upsert key). */
  id: string;
  /** Player display name. */
  name: string;
  /** Field position category. */
  position: Position;
  /** Shirt number, or `null` when unknown. */
  number?: number | null;
  /** Nationality, or `null` when unknown. */
  nationality?: string | null;
  /** Photo URL, or `null` when unknown. */
  photo?: string | null;
}

/**
 * A single item-level failure within a batch import, identifying the offending
 * item by its zero-based `index` in the submitted array and carrying a
 * human-readable `message`.
 */
export interface BatchItemError {
  /** Zero-based position of the failing item in the submitted batch. */
  index: number;
  /** Human-readable reason the item was rejected. */
  message: string;
}

/**
 * Outcome of a bulk import operation (Requirements 28.5, 31.5).
 *
 * When required-field validation rejects the batch, nothing is persisted:
 * `ok` is `false`, `succeeded` is `0` and every item is reported in `errors`.
 * When validation passes, items are persisted individually so a partial
 * success can be reported: `succeeded`/`failed` count the outcomes and `errors`
 * lists any items that failed to persist.
 */
export interface BatchResult {
  /** `true` only when every submitted item was persisted successfully. */
  ok: boolean;
  /** Number of items persisted successfully. */
  succeeded: number;
  /** Number of items that were rejected or failed to persist. */
  failed: number;
  /** Per-item failures (validation or persistence). */
  errors: BatchItemError[];
}

// ---------------------------------------------------------------------------
// ScoreService input/output types (Requirements 20, 21)
// ---------------------------------------------------------------------------

/**
 * Match context persisted alongside every per-match rating for traceability
 * (Requirement 20.10).
 *
 * A rating {@link ScoreEntry} only carries the player and the value given; the
 * fixture's teams and date are supplied once per submission via this context so
 * each `game_scores` row records `home_team`, `away_team` and `fixture_date`.
 */
export interface FixtureContext {
  /** Home team name recorded on each rating row. */
  homeTeam: string;
  /** Away team name recorded on each rating row. */
  awayTeam: string;
  /** Fixture date recorded on each rating row. */
  fixtureDate: string;
}

/**
 * Aggregated community per-match ratings for a single player within one fixture
 * (Requirement 20.6).
 *
 * `avg` is the mean of every individual rating the player received in the
 * fixture and `votes` is the number of ratings that mean was computed from.
 */
export interface PlayerAggregate {
  /** Identifier of the rated player. */
  playerId: string;
  /** Display name of the rated player. */
  playerName: string;
  /** Mean of the individual ratings received in the fixture. */
  avg: number;
  /** Number of individual ratings received in the fixture. */
  votes: number;
}

/**
 * Aggregated community permanent (yearly) ratings for a single player in a given
 * year (Requirement 21.5).
 *
 * `avg` is the mean of all permanent ratings submitted for the player that year
 * and `votes` is the number of users who submitted one.
 */
export interface PermanentAggregate {
  /** Identifier of the rated player. */
  playerId: string;
  /** Display name of the rated player. */
  playerName: string;
  /** Year the permanent ratings belong to. */
  year: number;
  /** Mean of all permanent ratings submitted for the player that year. */
  avg: number;
  /** Number of permanent ratings that the mean was computed from. */
  votes: number;
}

/**
 * Writable fields for submitting a permanent (yearly) rating
 * (Requirements 21.3, 21.4).
 *
 * The `(player_id, username, year)` triple is unique in `permanent_scores`, so
 * a second submission for the same player and year is rejected by the backend.
 */
export interface PermanentScoreInput {
  /** Identifier of the rated player. */
  playerId: string;
  /** Display name of the rated player, persisted alongside the score. */
  playerName: string;
  /** Author of the permanent rating. */
  username: string;
  /** Year the permanent rating applies to. */
  year: number;
  /** Rating value in `[0, 10]`, step `0.5`. */
  score: number;
}

/**
 * Writable fields for creating or importing a {@link Fixture} match.
 *
 * `homeTeam`, `awayTeam`, `fixtureDate` and `competition` are required by
 * Requirement 28.6 and validated before a batch import begins. The remaining
 * columns are optional: `id` is the upsert key when supplied (otherwise the
 * database generates one), and the rest default to sensible values
 * (`null` scores/stadium, `ts` of `0`, `notstarted` status, `liberado = false`).
 */
export interface FixtureInput {
  /** Stable fixture identifier (upsert key). Omit to let the database generate one. */
  id?: string;
  /** Home team name. */
  homeTeam: string;
  /** Away team name. */
  awayTeam: string;
  /** Kickoff date (ISO string). */
  fixtureDate: string;
  /** Competition id (e.g. 71 = Série A). */
  competition: number;
  /** Home goals, or `null` before the match is played. */
  homeScore?: number | null;
  /** Away goals, or `null` before the match is played. */
  awayScore?: number | null;
  /** Kickoff timestamp in seconds; used by the Countdown and prediction lock. */
  ts?: number;
  /** Stadium name, or `null` when unknown. */
  stadium?: string | null;
  /** Lifecycle status; defaults to `notstarted`. */
  status?: FixtureStatus;
  /** Whether the fixture is released for community rating; defaults to `false`. */
  liberado?: boolean;
}

// ---------------------------------------------------------------------------
// PredictionService input types (Requirement 23)
// ---------------------------------------------------------------------------

/**
 * Writable fields for submitting or editing a pre-match prediction (Palpite)
 * (Requirements 23.1-23.3).
 *
 * `fixtureId` and `username` identify the prediction (the upsert key of the
 * `predictions` table), so re-submitting before kickoff edits the existing
 * prediction instead of creating a duplicate. Both the score and the lineup are
 * optional, mirroring Requirement 23.1 ("escalação e/ou placar"): a prediction
 * may carry only a score, only a lineup, or both. Omitted scores default to
 * `null` and an omitted lineup defaults to an empty list.
 */
export interface PredictionInput {
  /** Identifier of the fixture being predicted. */
  fixtureId: string;
  /** Author of the prediction. */
  username: string;
  /** Predicted home goals, or `null`/omitted when only a lineup is predicted. */
  homeScore?: number | null;
  /** Predicted away goals, or `null`/omitted when only a lineup is predicted. */
  awayScore?: number | null;
  /** Ids of the players predicted to start; defaults to an empty list. */
  lineupPlayerIds?: string[];
}

// ---------------------------------------------------------------------------
// CraqueService output types (Requirement 22)
// ---------------------------------------------------------------------------

/**
 * Community vote count for a single player in a "Craque da Partida" ballot
 * (Requirement 22.4).
 *
 * Distinct from the 0-10 ratings: each authenticated user contributes at most
 * one active Man of the Match vote per fixture, so `votes` counts distinct
 * voters who currently favor this player.
 */
export interface CraqueResult {
  /** Identifier of the voted player. */
  playerId: string;
  /** Number of community votes the player currently holds. */
  votes: number;
}

/**
 * Full Man of the Match tally for a fixture: one {@link CraqueResult} per voted
 * player plus the overall vote count (Requirement 22.4).
 *
 * `results` is ordered by `votes` descending, then by `playerId` ascending for
 * deterministic output, so the first entry is the current leader.
 */
export interface CraqueTally {
  /** Identifier of the fixture the tally belongs to. */
  fixtureId: string;
  /** Per-player vote counts, ordered by votes (desc) then playerId (asc). */
  results: CraqueResult[];
  /** Total number of votes cast in the fixture. */
  totalVotes: number;
}
