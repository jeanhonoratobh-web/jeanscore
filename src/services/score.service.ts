/**
 * Rating persistence Service (`services/score.service.ts`).
 *
 * Owns every read and write against the `game_scores` (per-match ratings,
 * Requirement 20) and `permanent_scores` (yearly ratings, Requirement 21)
 * tables. Like the rest of the Services layer it receives its dependencies —
 * the typed {@link SupabaseClient} and the {@link Cache} — via constructor
 * injection (Requirements 1.5, 5.4) and returns typed values instead of
 * throwing.
 *
 * Responsibilities are limited to orchestrating data access and aggregation;
 * score validation/normalization is delegated to the pure `domain/scoring`
 * module and row (de)serialization to `domain/serialization`, keeping the
 * business rules testable in isolation (Requirement 1.2).
 *
 * Two persistence contracts matter here:
 *  - Per-match submissions use `Prefer: resolution=merge-duplicates` so a user
 *    can edit their ratings (upsert on `(fixture_id, player_id, username)`)
 *    (Requirement 20.3).
 *  - Permanent submissions are plain inserts so the unique constraint
 *    `(player_id, username, year)` is enforced; a duplicate surfaces as
 *    SQLSTATE `23505`, which is translated into the domain message
 *    "Você já avaliou este jogador este ano" (Requirements 21.3, 21.4).
 */

import { calcAverage, normalizeScore } from '@/domain/scoring';
import { toGameScore } from '@/domain/serialization';
import type { ScoreEntry } from '@/domain/serialization';
import type {
  BatchResult,
  FixtureContext,
  PermanentAggregate,
  PermanentScoreInput,
  PlayerAggregate,
} from '@/types/service';
import type { GameScore } from '@/types/domain';
import type {
  SupabaseGameScoreRow,
  SupabasePermanentScoreRow,
} from '@/types/supabase';
import type { Result } from '@/types/supabase';
import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';

/** REST table path for per-match ratings. */
const GAME_SCORES_PATH = 'game_scores';
/** REST table path for permanent (yearly) ratings. */
const PERMANENT_SCORES_PATH = 'permanent_scores';

/** SQLSTATE returned by PostgreSQL for a unique-constraint violation. */
const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Domain message shown when a user tries to rate the same player twice in the
 * same year (Requirement 21.4). Mirrors the i18n key
 * `player.permanentScore.alreadyRated`.
 */
export const PERMANENT_DUPLICATE_MESSAGE = 'Você já avaliou este jogador este ano';

/**
 * Data-access Service for per-match and permanent player ratings.
 *
 * @see Requirements 20 (per-match ratings), 21 (permanent yearly ratings).
 */
export class ScoreService {
  /**
   * @param supa Typed Supabase REST client (injected, Requirement 5.4).
   * @param cache In-memory cache used for reads with a stale fallback
   *   (Requirements 1.7, 1.8).
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
  ) {}

  /**
   * Returns every per-match rating in the system as domain {@link GameScore}s.
   *
   * Reads are served from the cache when fresh and fall back to the last known
   * value if the network request fails (Requirement 1.8).
   *
   * @returns All persisted ratings; an empty array when none exist or the read
   *   fails with no cached value.
   */
  async getAllGameScores(): Promise<GameScore[]> {
    const rows = await this.fetchRows<SupabaseGameScoreRow>(
      'game_scores:all',
      GAME_SCORES_PATH,
      'select=*&order=created_at.asc',
    );
    return rows.map(toGameScore);
  }

  /**
   * Aggregates the community ratings submitted for a single fixture, one entry
   * per rated player (Requirement 20.6).
   *
   * Each {@link PlayerAggregate} carries the mean of the individual ratings the
   * player received in the fixture and the number of ratings behind that mean.
   * Results are ordered by average (desc), then vote count (desc), then player
   * name (asc) for deterministic output.
   *
   * @param fixtureId Identifier of the fixture to aggregate.
   * @returns One aggregate per player rated in the fixture.
   */
  async getFixtureScores(fixtureId: string): Promise<PlayerAggregate[]> {
    const rows = await this.fetchFixtureRows(fixtureId);

    const byPlayer = new Map<string, { playerName: string; scores: number[] }>();
    for (const row of rows) {
      const bucket = byPlayer.get(row.player_id);
      if (bucket === undefined) {
        byPlayer.set(row.player_id, {
          playerName: row.player_name,
          scores: [row.score],
        });
      } else {
        bucket.scores.push(row.score);
      }
    }

    const aggregates: PlayerAggregate[] = [];
    for (const [playerId, { playerName, scores }] of byPlayer) {
      aggregates.push({
        playerId,
        playerName,
        avg: calcAverage(scores),
        votes: scores.length,
      });
    }

    aggregates.sort(
      (a, b) =>
        b.avg - a.avg || b.votes - a.votes || a.playerName.localeCompare(b.playerName),
    );
    return aggregates;
  }

  /**
   * Returns the ratings a specific user submitted for a fixture, keyed by
   * player id, so the rating interface can pre-fill the user's previous scores
   * (Requirement 20.4).
   *
   * @param fixtureId Identifier of the fixture.
   * @param username Author whose ratings to retrieve.
   * @returns Map of `playerId -> score` for the user's ratings in the fixture;
   *   empty when the user has not rated the fixture.
   */
  async getUserScores(fixtureId: string, username: string): Promise<Map<string, number>> {
    const rows = await this.fetchFixtureRows(fixtureId);
    const result = new Map<string, number>();
    for (const row of rows) {
      if (row.username === username) {
        result.set(row.player_id, row.score);
      }
    }
    return result;
  }

  /**
   * Persists a user's ratings for a fixture, upserting so an existing rating is
   * edited rather than duplicated (Requirement 20.3).
   *
   * Every row records the match context (`home_team`, `away_team`,
   * `fixture_date`) for traceability (Requirement 20.10) and each score is
   * normalized to the valid `[0, 10]` / step-`0.5` scale before persistence
   * (Requirement 20.2). The whole batch is sent in a single upsert request; on
   * success every entry is reported as succeeded, and on failure the entire
   * batch is reported as failed with the backend error message.
   *
   * @param fixtureId Identifier of the fixture being rated.
   * @param entries Per-player ratings to persist.
   * @param user Author of the ratings.
   * @param ctx Match context recorded on every row (Requirement 20.10).
   * @returns A {@link BatchResult} describing how many ratings were persisted.
   */
  async submitScores(
    fixtureId: string,
    entries: ScoreEntry[],
    user: string,
    ctx: FixtureContext,
  ): Promise<BatchResult> {
    if (entries.length === 0) {
      return { ok: true, succeeded: 0, failed: 0, errors: [] };
    }

    const createdAt = new Date().toISOString();
    const rows: SupabaseGameScoreRow[] = entries.map((entry) => ({
      fixture_id: fixtureId,
      player_id: entry.playerId,
      player_name: entry.playerName,
      username: user,
      score: normalizeScore(entry.score),
      home_team: ctx.homeTeam,
      away_team: ctx.awayTeam,
      fixture_date: ctx.fixtureDate,
      created_at: createdAt,
    }));

    const res = await this.supa.post<SupabaseGameScoreRow[]>(GAME_SCORES_PATH, rows, {
      prefer: 'resolution=merge-duplicates',
    });

    if (!res.ok) {
      return {
        ok: false,
        succeeded: 0,
        failed: entries.length,
        errors: entries.map((_, index) => ({ index, message: res.error })),
      };
    }

    // Invalidate cached reads that this fixture's ratings feed into.
    this.cache.invalidate('game_scores:all');
    this.cache.invalidate(this.fixtureCacheKey(fixtureId));

    return { ok: true, succeeded: entries.length, failed: 0, errors: [] };
  }

  /**
   * Aggregates the community permanent ratings for a given year, one entry per
   * rated player keyed by player id (Requirement 21.5).
   *
   * @param year Year whose permanent ratings to aggregate.
   * @returns Map of `playerId -> {@link PermanentAggregate}`; empty when no
   *   permanent ratings exist for the year.
   */
  async getPermanentScores(year: number): Promise<Map<string, PermanentAggregate>> {
    const rows = await this.fetchRows<SupabasePermanentScoreRow>(
      `permanent_scores:${year}`,
      PERMANENT_SCORES_PATH,
      `year=eq.${encodeURIComponent(String(year))}&select=*`,
    );

    const byPlayer = new Map<string, { playerName: string; scores: number[] }>();
    for (const row of rows) {
      const bucket = byPlayer.get(row.player_id);
      if (bucket === undefined) {
        byPlayer.set(row.player_id, {
          playerName: row.player_name,
          scores: [row.score],
        });
      } else {
        bucket.scores.push(row.score);
      }
    }

    const result = new Map<string, PermanentAggregate>();
    for (const [playerId, { playerName, scores }] of byPlayer) {
      result.set(playerId, {
        playerId,
        playerName,
        year,
        avg: calcAverage(scores),
        votes: scores.length,
      });
    }
    return result;
  }

  /**
   * Records a user's permanent (yearly) rating for a player the first time it is
   * submitted (Requirement 21.3).
   *
   * Uses a plain insert (no upsert) so the unique constraint
   * `(player_id, username, year)` is enforced by the backend. A second
   * submission for the same player and year surfaces as SQLSTATE
   * `23505`, which is translated into the domain message
   * {@link PERMANENT_DUPLICATE_MESSAGE} and returned as a failure without
   * persisting new data (Requirement 21.4). Any other failure is passed through
   * unchanged.
   *
   * @param input Permanent rating to persist.
   * @returns `{ ok: true }` on success; `{ ok: false }` with a translated
   *   message on a duplicate, or the backend error otherwise.
   */
  async savePermanentScore(input: PermanentScoreInput): Promise<Result<void>> {
    const row: SupabasePermanentScoreRow = {
      player_id: input.playerId,
      player_name: input.playerName,
      username: input.username,
      year: input.year,
      score: normalizeScore(input.score),
    };

    const res = await this.supa.post<SupabasePermanentScoreRow[]>(PERMANENT_SCORES_PATH, [
      row,
    ]);

    if (!res.ok) {
      if (res.code === UNIQUE_VIOLATION_CODE) {
        // Duplicate for (player, user, year): block and translate to domain msg.
        return { ok: false, error: PERMANENT_DUPLICATE_MESSAGE, code: res.code };
      }
      return { ok: false, error: res.error, ...(res.status !== undefined ? { status: res.status } : {}), ...(res.code !== undefined ? { code: res.code } : {}) };
    }

    this.cache.invalidate(`permanent_scores:${input.year}`);
    return { ok: true, data: undefined };
  }

  /**
   * Fetches the raw rating rows for one fixture, backed by the cache with a
   * stale fallback. Shared by {@link getFixtureScores} and {@link getUserScores}
   * so a single request serves both.
   */
  private fetchFixtureRows(fixtureId: string): Promise<SupabaseGameScoreRow[]> {
    return this.fetchRows<SupabaseGameScoreRow>(
      this.fixtureCacheKey(fixtureId),
      GAME_SCORES_PATH,
      `fixture_id=eq.${encodeURIComponent(fixtureId)}&select=*`,
    );
  }

  /** Cache key holding the raw rating rows for a single fixture. */
  private fixtureCacheKey(fixtureId: string): string {
    return `game_scores:fixture:${fixtureId}`;
  }

  /**
   * Reads a list of rows through the cache: serves a fresh cached value when
   * present, otherwise fetches from Supabase and caches the result, and falls
   * back to the last known (stale) value if the request fails
   * (Requirements 1.7, 1.8).
   */
  private async fetchRows<TRow>(
    cacheKey: string,
    path: string,
    params: string,
  ): Promise<TRow[]> {
    const cached = this.cache.get<TRow[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const res = await this.supa.get<TRow[]>(path, params);
    if (res.ok) {
      const rows = res.data ?? [];
      this.cache.set(cacheKey, rows);
      return rows;
    }

    return this.cache.getStale<TRow[]>(cacheKey) ?? [];
  }
}
