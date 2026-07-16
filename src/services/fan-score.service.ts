/**
 * Fan Score and Supporter Level service (`services/fan-score.service.ts`).
 *
 * Orchestrates the reads and writes behind the Fan Score system (Requirement 9)
 * and delegates every calculation to the pure `domain/fanScore.ts` functions.
 * The scoring rules themselves live in a data-driven {@link FanScoreConfig}
 * ({@link DEFAULT_FAN_SCORE_CONFIG}) so point values and level thresholds can be
 * re-tuned without changing this service, the domain logic or any UI component
 * (Requirement 9.7).
 *
 * Following the layering rules, the service receives its dependencies
 * ({@link SupabaseClient} and {@link Cache}) via constructor injection so it can
 * be unit-tested with mocks without touching the UI (Requirements 1.5, 5.4).
 * Reads go through the {@link Cache} first and fall back to the most recent
 * stale value when a network request fails (stale fallback, Requirement 1.8).
 *
 * @see Requirements 9.2 (increment on a scorable action + persist), 9.5 (promote
 *   on reaching a new level), 9.7 (data-driven rules).
 */

import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';
import { applyFanScore, fanLevel, levelIndex } from '@/domain/fanScore';
import type { FanLevel } from '@/types/domain';
import type { FanScoreAction, FanScoreConfig } from '@/types/config';
import type { Result, SupabaseFanScoreRow } from '@/types/supabase';

/**
 * Default data-driven Fan Score rules (Requirement 9.7).
 *
 * Point values reward participation and presence over competition
 * (Requirement 9.3); level thresholds are listed in ascending order following
 * the canonical level order Iniciante → Torcedor → Apaixonado → Especialista →
 * Lenda (Requirement 9.4). Adjusting these values re-tunes the whole system
 * without any code change.
 */
export const DEFAULT_FAN_SCORE_CONFIG: FanScoreConfig = {
  actionPoints: {
    rate_match: 10,
    rate_full_lineup: 25,
    consecutive_match: 15,
    daily_return: 5,
    full_season: 100,
    vote_craque: 5,
    prediction_hit: 20,
  },
  levelThresholds: [
    { level: 'iniciante', min: 0 },
    { level: 'torcedor', min: 100 },
    { level: 'apaixonado', min: 300 },
    { level: 'especialista', min: 700 },
    { level: 'lenda', min: 1500 },
  ],
};

/**
 * Outcome of awarding a scorable action to a user (Requirements 9.2, 9.5).
 *
 * Carries the resulting Fan Score, the resulting Supporter Level and whether
 * the award promoted the user to a new level so the UI can show recognition
 * feedback.
 */
export interface FanScoreResult {
  /** The user's new accumulated Fan Score after the award. */
  fanScore: number;
  /** The user's Supporter Level for the new Fan Score. */
  fanLevel: FanLevel;
  /** The user's Supporter Level before the award. */
  previousLevel: FanLevel;
  /** `true` when the award promoted the user to a higher Supporter Level. */
  leveledUp: boolean;
}

/**
 * Manages Fan Score reads, awards and configuration (Requirement 9).
 *
 * The service is a thin orchestration layer: it reads the current score,
 * delegates the calculation to the pure domain functions and persists the
 * result. It holds no framework or UI concerns and no scoring logic of its own.
 */
export class FanScoreService {
  /**
   * @param supa Injected Supabase REST client (Requirement 5.4).
   * @param cache Injected cache used for read caching and stale fallback
   *   (Requirements 1.7, 1.8).
   * @param config Data-driven Fan Score rules; defaults to
   *   {@link DEFAULT_FAN_SCORE_CONFIG} (Requirement 9.7).
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
    private readonly config: FanScoreConfig = DEFAULT_FAN_SCORE_CONFIG,
  ) {}

  /**
   * Returns the data-driven Fan Score configuration used by this service:
   * the points awarded per action and the level thresholds (Requirement 9.7).
   *
   * @returns The active {@link FanScoreConfig}.
   */
  getConfig(): FanScoreConfig {
    return this.config;
  }

  /**
   * Returns a user's current accumulated Fan Score, or `0` when the user has no
   * Fan Score row yet.
   *
   * The read is cache-first and falls back to the most recent stale value when
   * a network request fails (Requirement 1.8).
   *
   * @param username The authenticated user's username.
   * @returns The user's current Fan Score.
   */
  async getFanScore(username: string): Promise<number> {
    const row = await this.getFanScoreRow(username);
    return row?.fan_score ?? 0;
  }

  /**
   * Awards the points for a scorable participation action to a user, persists
   * the new total and reports whether it triggered a level promotion
   * (Requirements 9.2, 9.5).
   *
   * The new score and levels are computed entirely by the pure domain functions
   * ({@link applyFanScore}, {@link fanLevel}) using the data-driven
   * {@link FanScoreConfig}. On a successful write the cached row is refreshed so
   * subsequent reads reflect the award.
   *
   * @param username The authenticated user's username.
   * @param action The scorable participation action performed.
   * @returns A {@link Result} carrying the {@link FanScoreResult} on success, or
   *   the persistence error on failure.
   */
  async awardAction(
    username: string,
    action: FanScoreAction,
  ): Promise<Result<FanScoreResult>> {
    const currentScore = await this.getFanScore(username);
    const previousLevel = fanLevel(currentScore, this.config);

    const newScore = applyFanScore(currentScore, action, this.config);
    const newLevel = fanLevel(newScore, this.config);
    const leveledUp = levelIndex(newLevel) > levelIndex(previousLevel);

    const row: SupabaseFanScoreRow = {
      username,
      fan_score: newScore,
      fan_level: newLevel,
      updated_at: new Date().toISOString(),
    };
    const res = await this.supa.post<SupabaseFanScoreRow[]>('fan_scores', row, {
      prefer: 'resolution=merge-duplicates',
    });
    if (!res.ok) {
      return res;
    }

    // Refresh the cached row so a subsequent read reflects the award.
    this.cache.set<SupabaseFanScoreRow[]>(this.cacheKey(username), [row]);

    return {
      ok: true,
      data: {
        fanScore: newScore,
        fanLevel: newLevel,
        previousLevel,
        leveledUp,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Internal read helpers (cached, with stale fallback)
  // -------------------------------------------------------------------------

  /** Fetches the user's Fan Score row (cache-first, stale fallback), if any. */
  private async getFanScoreRow(username: string): Promise<SupabaseFanScoreRow | null> {
    const cacheKey = this.cacheKey(username);
    const cached = this.cache.get<SupabaseFanScoreRow[]>(cacheKey);
    if (cached !== null) {
      return cached[0] ?? null;
    }
    const res = await this.supa.get<SupabaseFanScoreRow[]>(
      'fan_scores',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    if (res.ok) {
      this.cache.set<SupabaseFanScoreRow[]>(cacheKey, res.data);
      return res.data[0] ?? null;
    }
    return this.cache.getStale<SupabaseFanScoreRow[]>(cacheKey)?.[0] ?? null;
  }

  /** Cache key for a user's Fan Score row (shared with the profile service). */
  private cacheKey(username: string): string {
    return `fan_score:${username}`;
  }
}
