/**
 * Prediction (Palpite) data-access Service (`services/prediction.service.ts`).
 *
 * Orchestrates all reads and writes for pre-match predictions (`predictions`),
 * sitting between the pure `domain/predictions` scoring function and the typed
 * {@link SupabaseClient}. Like every Service it receives its dependencies —
 * a {@link SupabaseClient}, a {@link Cache} and a {@link FixtureService} — via
 * constructor injection (Requirements 1.5, 5.4), plus an injectable clock so the
 * kickoff lock can be exercised deterministically in tests.
 *
 * Responsibilities:
 * - {@link PredictionService.getPrediction}: read a user's prediction for a
 *   fixture (cached, with a stale fallback on network failure, Requirement 1.8).
 * - {@link PredictionService.submit}: persist/edit a prediction, **blocking**
 *   both submission and edition once the fixture kickoff timestamp (`ts`,
 *   seconds) has passed (Requirements 23.2, 23.3).
 * - {@link PredictionService.scoreForFixture}: delegate scoring of every
 *   prediction against the real fixture result to the pure
 *   {@link scorePrediction} domain function (Requirement 23.4).
 *
 * All prediction scoring rules stay data-driven via {@link PredictionConfig}:
 * the point values can be re-tuned by swapping the config without touching this
 * Service, the UI, or the pure domain function (Requirement 23.4).
 */

import { scorePrediction, type FixtureResult } from '@/domain/predictions';
import type { Prediction, PredictionOutcome } from '@/types/domain';
import type { PredictionConfig } from '@/types/config';
import type { PredictionInput } from '@/types/service';
import type { Result, SupabasePredictionRow } from '@/types/supabase';
import type { Cache } from './cache';
import type { FixtureService } from './fixture.service';
import type { SupabaseClient } from './supabase-client';

/** REST table path for pre-match predictions. */
const PREDICTIONS_PATH = 'predictions';

/**
 * Default, data-driven prediction scoring rules (Requirement 23.4).
 *
 * A perfect exact score is worth the most, a merely correct result (winner or
 * draw) is worth less, and each correctly predicted starter adds a small bonus.
 * Adjusting these values re-tunes the whole prediction reward system without
 * changing the Service or the pure {@link scorePrediction} function.
 */
export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  exactScore: 10,
  correctResult: 5,
  lineupHitPerPlayer: 1,
};

/**
 * Domain message returned when a user tries to submit or edit a prediction after
 * the fixture kickoff has been reached (Requirement 23.2). Mirrors the i18n key
 * `prediction.locked`.
 */
export const PREDICTION_LOCKED_MESSAGE =
  'Os palpites já estão encerrados para esta partida';

/**
 * Domain message returned when a prediction targets a fixture that does not
 * exist, so the kickoff lock cannot be evaluated.
 */
export const FIXTURE_NOT_FOUND_MESSAGE = 'Partida não encontrada';

/** Builds the cache key holding every prediction row for a single fixture. */
function fixturePredictionsCacheKey(fixtureId: string): string {
  return `predictions:fixture:${fixtureId}`;
}

/**
 * Maps a raw `predictions` row to a domain {@link Prediction}.
 *
 * The persisted `points` column is intentionally not projected onto the domain
 * entity: the per-kind {@link PredictionOutcome} breakdown is (re)computed by
 * {@link PredictionService.scoreForFixture} rather than stored, so `outcome`
 * stays unset on a plain read.
 */
function toPrediction(row: SupabasePredictionRow): Prediction {
  return {
    fixtureId: row.fixture_id,
    username: row.username,
    homeScore: row.home_score,
    awayScore: row.away_score,
    lineupPlayerIds: row.lineup_player_ids ?? [],
    createdAt: row.created_at,
  };
}

/**
 * Data-access Service for pre-match predictions (Requirement 23).
 *
 * All dependencies are injected via the constructor (Requirement 1.5).
 */
export class PredictionService {
  /**
   * @param supa Typed Supabase REST client used for every backend call.
   * @param cache In-memory cache backing fresh reads and the stale fallback.
   * @param fixtures Fixture Service used to resolve the kickoff timestamp for
   *   the submission lock and the real result/lineup for scoring.
   * @param config Data-driven scoring rules; defaults to
   *   {@link DEFAULT_PREDICTION_CONFIG} (Requirement 23.4).
   * @param now Clock returning the current time in milliseconds; injectable so
   *   the kickoff lock is deterministically testable. Defaults to `Date.now`.
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
    private readonly fixtures: FixtureService,
    private readonly config: PredictionConfig = DEFAULT_PREDICTION_CONFIG,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Returns a user's prediction for a fixture, or `null` when none exists.
   *
   * Reads are served from the cache when fresh and fall back to the last known
   * value if the network request fails (Requirement 1.8).
   *
   * @param fixtureId Identifier of the fixture.
   * @param username Author whose prediction to retrieve.
   * @returns The user's {@link Prediction}, or `null` if they have not predicted
   *   this fixture.
   */
  async getPrediction(fixtureId: string, username: string): Promise<Prediction | null> {
    const rows = await this.fetchFixturePredictions(fixtureId);
    const row = rows.find((r) => r.username === username);
    return row === undefined ? null : toPrediction(row);
  }

  /**
   * Submits or edits a user's prediction for a fixture, upserting so a
   * re-submission before kickoff edits the existing prediction rather than
   * duplicating it (Requirement 23.3).
   *
   * The submission is **blocked** once the fixture kickoff timestamp (`ts`, in
   * seconds) has been reached: comparing it against the injected clock, any call
   * at or after kickoff is rejected with {@link PREDICTION_LOCKED_MESSAGE} and
   * nothing is persisted (Requirement 23.2). If the target fixture cannot be
   * found the call fails with {@link FIXTURE_NOT_FOUND_MESSAGE}. On success the
   * per-fixture prediction cache is invalidated so the next read reflects the
   * change.
   *
   * @param input Prediction to persist (score and/or lineup).
   * @returns `{ ok: true }` on success; `{ ok: false }` with a domain message
   *   when the fixture is locked or missing, or the backend error otherwise.
   */
  async submit(input: PredictionInput): Promise<Result<void>> {
    const fixture = await this.fixtures.getFixture(input.fixtureId);
    if (fixture === null) {
      return { ok: false, error: FIXTURE_NOT_FOUND_MESSAGE };
    }

    // Requirement 23.2/23.3: block submission and edition once kickoff is
    // reached. `ts` is in seconds; the clock is in milliseconds.
    const kickoffMs = fixture.ts * 1000;
    if (this.now() >= kickoffMs) {
      return { ok: false, error: PREDICTION_LOCKED_MESSAGE };
    }

    const row: SupabasePredictionRow = {
      fixture_id: input.fixtureId,
      username: input.username,
      home_score: input.homeScore ?? null,
      away_score: input.awayScore ?? null,
      lineup_player_ids: input.lineupPlayerIds ?? [],
      points: null,
      created_at: new Date(this.now()).toISOString(),
    };

    const res = await this.supa.post<SupabasePredictionRow[]>(PREDICTIONS_PATH, [row], {
      prefer: 'resolution=merge-duplicates',
    });

    if (!res.ok) {
      return res;
    }

    this.cache.invalidate(fixturePredictionsCacheKey(input.fixtureId));
    return { ok: true, data: undefined };
  }

  /**
   * Scores every prediction submitted for a fixture against its real result,
   * delegating the computation to the pure {@link scorePrediction} domain
   * function (Requirement 23.4).
   *
   * The confirmed final score comes from the fixture's `homeScore`/`awayScore`
   * (a `null` score disables score-based points inside the domain function) and
   * the real lineup comes from the fixture's saved lineup. Point values are
   * supplied by the injected {@link PredictionConfig}.
   *
   * @param fixtureId Identifier of the fixture to score.
   * @returns One {@link PredictionOutcome} per submitted prediction; an empty
   *   array when the fixture does not exist or has no predictions.
   */
  async scoreForFixture(fixtureId: string): Promise<PredictionOutcome[]> {
    const fixture = await this.fixtures.getFixture(fixtureId);
    if (fixture === null) {
      return [];
    }

    const lineup = await this.fixtures.getLineup(fixtureId);
    const actual: FixtureResult = {
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      lineupPlayerIds: lineup.playerIds,
    };

    const rows = await this.fetchFixturePredictions(fixtureId);
    return rows.map((row) => scorePrediction(toPrediction(row), actual, this.config));
  }

  /**
   * Reads every prediction row for a fixture through the cache: serves a fresh
   * cached value when present, otherwise fetches from Supabase and caches the
   * result, and falls back to the last known (stale) value if the request fails
   * (Requirements 1.7, 1.8).
   */
  private async fetchFixturePredictions(
    fixtureId: string,
  ): Promise<SupabasePredictionRow[]> {
    const key = fixturePredictionsCacheKey(fixtureId);
    const cached = this.cache.get<SupabasePredictionRow[]>(key);
    if (cached !== null) {
      return cached;
    }

    const res = await this.supa.get<SupabasePredictionRow[]>(
      PREDICTIONS_PATH,
      `fixture_id=eq.${encodeURIComponent(fixtureId)}&select=*`,
    );

    if (res.ok) {
      const rows = res.data ?? [];
      this.cache.set(key, rows);
      return rows;
    }

    return this.cache.getStale<SupabasePredictionRow[]>(key) ?? [];
  }
}
