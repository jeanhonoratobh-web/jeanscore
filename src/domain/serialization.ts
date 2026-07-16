/**
 * Supabase <-> domain mapping and score (de)serialization (pure,
 * framework-agnostic).
 *
 * This module is the single boundary that converts the raw, snake_cased row
 * shapes returned by the Supabase REST API (`types/supabase.ts`) into the
 * camel-cased, framework-agnostic domain entities (`types/domain.ts`) and back.
 * It also (de)serializes a per-player rating entry to and from the JSON used
 * when submitting ratings.
 *
 * Living in the pure `domain` layer, it imports ONLY from `types` — never from
 * React, the DOM, services or the network (Requirement 1.2). Every conversion
 * is a pure function, which makes the round-trip guarantees testable in
 * isolation:
 *
 *  - {@link toFixtureRow}({@link toFixture}(row)) reproduces the original row,
 *    including a `null` stadium and null scores (Property 2).
 *  - {@link deserializeScore}({@link serializeScore}(entry)) reproduces the
 *    original entry with no floating-point drift (Property 1).
 *
 * @see Requirements 1.5 (dependency injection / pure mapping boundary), 20.3
 *   and 20.10 (rating submission and persistence round-trip).
 */

import type {
  Fixture,
  FixtureStatus,
  GameScore,
  Player,
  Position,
} from '../types/domain';
import type {
  SupabaseFixtureRow,
  SupabaseGameScoreRow,
  SupabaseSquadRow,
} from '../types/supabase';

/**
 * A single per-player rating to be submitted for a fixture.
 *
 * This is the minimal, serializable unit of a rating submission: the fixture
 * and match context (home/away teams, date) are supplied separately by the
 * caller, so an entry only carries the player it targets and the value given.
 * The score is expected in `[0, 10]` with a step of `0.5`; validation and
 * normalization live in `domain/scoring.ts` (task 4.4).
 *
 * @see Requirements 20.3, 20.10.
 */
export interface ScoreEntry {
  /** Identifier of the rated player. */
  playerId: string;
  /** Display name of the rated player, persisted alongside the score. */
  playerName: string;
  /** Rating value in `[0, 10]`, step `0.5`. */
  score: number;
}

/**
 * Maps a raw `squad` row into a domain {@link Player} (Requirement 1.5).
 *
 * A pure, total conversion: nullable columns (`number`, `nationality`,
 * `photo`) are carried through unchanged, and the free-form `position` string
 * is narrowed to the {@link Position} union. No extension fields
 * (`achievements`, `favorited`) are set here — they are populated by higher
 * layers when available.
 *
 * @param row - The raw Supabase squad row.
 * @returns The corresponding domain {@link Player}.
 */
export function toPlayer(row: SupabaseSquadRow): Player {
  return {
    id: row.id,
    name: row.name,
    position: row.position as Position,
    number: row.number,
    nationality: row.nationality,
    photo: row.photo,
  };
}

/**
 * Maps a raw `fixtures` row into a domain {@link Fixture} (Requirement 1.5).
 *
 * Handles the nullable and typed columns explicitly so the inverse
 * {@link toFixtureRow} can reproduce the original row losslessly (Property 2):
 *  - `stadium` stays `null` when unknown;
 *  - `home_score`/`away_score` stay `null` before the match is played;
 *  - `competition` is parsed from its string column into a numeric id;
 *  - the free-form `status` string is narrowed to the {@link FixtureStatus}
 *    union.
 *
 * @param row - The raw Supabase fixture row.
 * @returns The corresponding domain {@link Fixture}.
 */
export function toFixture(row: SupabaseFixtureRow): Fixture {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    fixtureDate: row.fixture_date,
    ts: row.ts,
    competition: Number(row.competition),
    stadium: row.stadium,
    status: row.status as FixtureStatus,
    liberado: row.liberado,
  };
}

/**
 * Maps a domain {@link Fixture} back into a raw `fixtures` row
 * (Requirement 20.10).
 *
 * The exact inverse of {@link toFixture}: it re-splits camel-cased fields into
 * the snake_cased columns and converts the numeric `competition` id back to its
 * string column, so that `toFixtureRow(toFixture(row))` equals the original
 * `row` for every valid fixture row — including a `null` stadium and null
 * scores (Property 2). Domain-only extension fields (e.g. `highlightsUrl`) have
 * no column and are intentionally dropped.
 *
 * @param fixture - The domain fixture to serialize.
 * @returns The corresponding raw Supabase fixture row.
 */
export function toFixtureRow(fixture: Fixture): SupabaseFixtureRow {
  return {
    id: fixture.id,
    home_team: fixture.homeTeam,
    away_team: fixture.awayTeam,
    home_score: fixture.homeScore,
    away_score: fixture.awayScore,
    fixture_date: fixture.fixtureDate,
    ts: fixture.ts,
    competition: String(fixture.competition),
    stadium: fixture.stadium,
    status: fixture.status,
    liberado: fixture.liberado,
  };
}

/**
 * Maps a raw `game_scores` row into a domain {@link GameScore}
 * (Requirement 20.10).
 *
 * A pure conversion from the snake_cased persisted rating to the camel-cased
 * domain shape. All fields are carried through unchanged; the optional
 * `comment` extension has no column and is left unset.
 *
 * @param row - The raw Supabase game-score row.
 * @returns The corresponding domain {@link GameScore}.
 */
export function toGameScore(row: SupabaseGameScoreRow): GameScore {
  return {
    fixtureId: row.fixture_id,
    playerId: row.player_id,
    playerName: row.player_name,
    username: row.username,
    score: row.score,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    fixtureDate: row.fixture_date,
    createdAt: row.created_at,
  };
}

/**
 * Serializes a {@link ScoreEntry} to its JSON string form (Requirement 20.3).
 *
 * Because scores are multiples of `0.5` (all exactly representable in binary
 * floating point), JSON serialization is lossless and the value survives a
 * {@link deserializeScore} round-trip with no drift (Property 1).
 *
 * @param entry - The rating entry to serialize.
 * @returns A JSON string encoding of the entry.
 */
export function serializeScore(entry: ScoreEntry): string {
  return JSON.stringify(entry);
}

/**
 * Parses a JSON string produced by {@link serializeScore} back into a
 * {@link ScoreEntry} (Requirement 20.3).
 *
 * The inverse of {@link serializeScore}: `deserializeScore(serializeScore(e))`
 * reproduces `e` exactly, without floating-point drift (Property 1).
 *
 * @param json - A JSON string previously produced by {@link serializeScore}.
 * @returns The decoded {@link ScoreEntry}.
 */
export function deserializeScore(json: string): ScoreEntry {
  return JSON.parse(json) as ScoreEntry;
}
