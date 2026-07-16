/**
 * User profile, personal statistics, activity and timeline service
 * (`services/user-profile.service.ts`).
 *
 * Orchestrates the reads and writes behind the {@link UserProfile} page: it
 * aggregates a user's identity, personal statistics (total ratings, matches
 * rated and favorite player), Fan Score/level, unlocked achievements, recent
 * activity and activity timeline, and persists the onboarding completion flag.
 *
 * Following the layering rules, the service receives its dependencies
 * ({@link SupabaseClient} and {@link Cache}) via constructor injection so it can
 * be unit-tested with mocks without touching the UI (Requirements 1.5, 5.4).
 * Reads go through the {@link Cache} first and fall back to the most recent
 * stale value when a network request fails (stale fallback, Requirement 1.8).
 *
 * @see Requirements 7.2 (persistent onboarding completion), 8.1 (identity +
 *   "Membro Desde"), 8.2 (personal stats + favorite player), 8.6 (recent
 *   activity), 8.7 (activity timeline).
 */

import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';
import { toPlayer } from '@/domain/serialization';
import type {
  ActivityItem,
  FanLevel,
  Player,
  TimelineMilestone,
  UserProfile,
} from '@/types/domain';
import type { Result } from '@/types/supabase';
import type {
  SupabaseAchievementRow,
  SupabaseFanScoreRow,
  SupabaseGameScoreRow,
  SupabaseOnboardingRow,
  SupabaseSquadRow,
  SupabaseUserRow,
} from '@/types/supabase';

/** Default number of entries returned by {@link UserProfileService.getRecentActivity}. */
const DEFAULT_ACTIVITY_LIMIT = 10;

/**
 * Aggregates profile data for authenticated users (Requirement 8).
 *
 * The service is a thin orchestration layer: it fetches raw rows from Supabase
 * (through the injected client and cache), maps them to domain shapes and
 * derives personal statistics. It holds no framework or UI concerns.
 */
export class UserProfileService {
  /**
   * @param supa Injected Supabase REST client (Requirement 5.4).
   * @param cache Injected cache used for read caching and stale fallback
   *   (Requirements 1.7, 1.8).
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
  ) {}

  /**
   * Builds the full {@link UserProfile} for a user: identity ("Membro Desde"),
   * personal statistics (total ratings, matches rated, favorite player), Fan
   * Score and level, unlocked achievements, level badge and the onboarding
   * completion flag (Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 7.2).
   *
   * The underlying reads run in parallel and each one degrades to the most
   * recent stale value on a network failure (Requirement 1.8).
   *
   * @param username The authenticated user's username.
   * @returns The aggregated {@link UserProfile}.
   */
  async getProfile(username: string): Promise<UserProfile> {
    const [userRow, scores, fanScoreRow, achievementRows, onboardingComplete] =
      await Promise.all([
        this.getUserRow(username),
        this.getUserScores(username),
        this.getFanScoreRow(username),
        this.getAchievementRows(username),
        this.isOnboardingComplete(username),
      ]);

    const fanScore = fanScoreRow?.fan_score ?? 0;
    const fanLevel = (fanScoreRow?.fan_level as FanLevel | undefined) ?? 'iniciante';

    return {
      username,
      memberSince: userRow?.created_at ?? '',
      totalRatings: scores.length,
      matchesRated: countDistinctFixtures(scores),
      favoritePlayerId: mostRatedPlayerId(scores),
      fanScore,
      fanLevel,
      achievements: achievementRows.map((row) => ({
        id: row.achievement_id,
        unlockedAt: row.unlocked_at,
      })),
      badges: [{ id: `level:${fanLevel}`, kind: 'level', labelKey: `level.${fanLevel}` }],
      onboardingComplete,
    };
  }

  /**
   * Returns the user's most recent rating submissions, most recent first, each
   * carrying the player, fixture and score (Requirement 8.6).
   *
   * @param username The authenticated user's username.
   * @param limit Maximum number of entries to return; defaults to
   *   {@link DEFAULT_ACTIVITY_LIMIT}.
   * @returns The recent {@link ActivityItem} list ordered by `createdAt`
   *   descending.
   */
  async getRecentActivity(
    username: string,
    limit: number = DEFAULT_ACTIVITY_LIMIT,
  ): Promise<ActivityItem[]> {
    const scores = await this.getUserScores(username);
    return scores
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, Math.max(0, limit))
      .map((row) => ({
        playerId: row.player_id,
        playerName: row.player_name,
        fixtureId: row.fixture_id,
        score: row.score,
        createdAt: row.created_at,
      }));
  }

  /**
   * Builds the user's activity timeline, ordering milestones chronologically:
   * the first rating submitted followed by each unlocked achievement
   * (Requirement 8.7).
   *
   * @param username The authenticated user's username.
   * @returns The chronologically ordered {@link TimelineMilestone} list.
   */
  async getTimeline(username: string): Promise<TimelineMilestone[]> {
    const [scores, achievementRows] = await Promise.all([
      this.getUserScores(username),
      this.getAchievementRows(username),
    ]);

    const milestones: TimelineMilestone[] = [];

    // First rating milestone: the earliest submitted rating, if any.
    const firstRatingAt = scores.reduce<string | null>((earliest, row) => {
      if (earliest === null || row.created_at.localeCompare(earliest) < 0) {
        return row.created_at;
      }
      return earliest;
    }, null);
    if (firstRatingAt !== null) {
      milestones.push({
        kind: 'first_rating',
        label: 'profile.timeline.firstRating',
        at: firstRatingAt,
      });
    }

    // One milestone per unlocked achievement.
    for (const row of achievementRows) {
      milestones.push({
        kind: 'achievement',
        label: 'profile.timeline.achievementUnlocked',
        at: row.unlocked_at,
      });
    }

    return milestones.sort((a, b) => a.at.localeCompare(b.at));
  }

  /**
   * Returns the user's favorite player — the player they have rated the most —
   * or `null` when the user has no ratings or the player is missing from the
   * squad (Requirement 8.2).
   *
   * @param username The authenticated user's username.
   * @returns The favorite {@link Player}, or `null`.
   */
  async getFavoritePlayer(username: string): Promise<Player | null> {
    const scores = await this.getUserScores(username);
    const playerId = mostRatedPlayerId(scores);
    if (playerId === null) {
      return null;
    }

    const rows = await this.cachedGet<SupabaseSquadRow[]>(
      `squad:player:${username}:${playerId}`,
      'squad',
      `select=*&id=eq.${encodeURIComponent(playerId)}`,
    );
    const row = rows?.[0];
    return row ? toPlayer(row) : null;
  }

  /**
   * Reports whether the user has completed (or skipped) the onboarding flow so
   * it is never shown again (Requirement 7.2).
   *
   * @param username The authenticated user's username.
   * @returns `true` when onboarding has been completed, otherwise `false`.
   */
  async isOnboardingComplete(username: string): Promise<boolean> {
    const rows = await this.cachedGet<SupabaseOnboardingRow[]>(
      `onboarding:${username}`,
      'onboarding',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    return rows?.[0]?.completed === true;
  }

  /**
   * Persists the user's onboarding completion so the flow is not shown again
   * for the same user (Requirement 7.2). Upserts the `onboarding` row and
   * invalidates the cached completion flag.
   *
   * @param username The authenticated user's username.
   * @returns A {@link Result} indicating whether the write succeeded.
   */
  async completeOnboarding(username: string): Promise<Result<void>> {
    const row: SupabaseOnboardingRow = {
      username,
      completed: true,
      completed_at: new Date().toISOString(),
    };
    const res = await this.supa.post<SupabaseOnboardingRow[]>('onboarding', row, {
      prefer: 'resolution=merge-duplicates',
    });
    if (!res.ok) {
      return res;
    }
    // Refresh the cached flag so a subsequent read reflects the completion.
    this.cache.set<SupabaseOnboardingRow[]>(`onboarding:${username}`, [row]);
    return { ok: true, data: undefined };
  }

  // -------------------------------------------------------------------------
  // Internal read helpers (cached, with stale fallback)
  // -------------------------------------------------------------------------

  /** Fetches the user's account row (for `created_at` / "Membro Desde"). */
  private async getUserRow(username: string): Promise<SupabaseUserRow | null> {
    const rows = await this.cachedGet<SupabaseUserRow[]>(
      `user:${username}`,
      'users',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    return rows?.[0] ?? null;
  }

  /** Fetches every rating the user has submitted (used for stats/activity). */
  private async getUserScores(username: string): Promise<SupabaseGameScoreRow[]> {
    const rows = await this.cachedGet<SupabaseGameScoreRow[]>(
      `game_scores:user:${username}`,
      'game_scores',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    return rows ?? [];
  }

  /** Fetches the user's Fan Score row, if any. */
  private async getFanScoreRow(username: string): Promise<SupabaseFanScoreRow | null> {
    const rows = await this.cachedGet<SupabaseFanScoreRow[]>(
      `fan_score:${username}`,
      'fan_scores',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    return rows?.[0] ?? null;
  }

  /** Fetches the user's unlocked achievement rows. */
  private async getAchievementRows(username: string): Promise<SupabaseAchievementRow[]> {
    const rows = await this.cachedGet<SupabaseAchievementRow[]>(
      `achievements:${username}`,
      'user_achievements',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    return rows ?? [];
  }

  /**
   * Cache-first GET with stale fallback (Requirements 1.7, 1.8).
   *
   * Returns the fresh cached value when present; otherwise fetches from
   * Supabase and caches success. On failure, returns the most recent stale
   * value if one exists, or `null`.
   */
  private async cachedGet<T>(
    cacheKey: string,
    path: string,
    params: string,
    ttl?: number,
  ): Promise<T | null> {
    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const res = await this.supa.get<T>(path, params);
    if (res.ok) {
      this.cache.set<T>(cacheKey, res.data, ttl);
      return res.data;
    }
    return this.cache.getStale<T>(cacheKey);
  }
}

// ---------------------------------------------------------------------------
// Pure aggregation helpers
// ---------------------------------------------------------------------------

/** Counts the distinct fixtures covered by a set of ratings ("Jogos Avaliados"). */
function countDistinctFixtures(scores: readonly SupabaseGameScoreRow[]): number {
  return new Set(scores.map((row) => row.fixture_id)).size;
}

/**
 * Returns the id of the most-rated player ("Jogador Favorito"), or `null` when
 * there are no ratings. Ties are resolved deterministically in favor of the
 * player id that first reaches the maximum count.
 */
function mostRatedPlayerId(scores: readonly SupabaseGameScoreRow[]): string | null {
  const counts = new Map<string, number>();
  let bestId: string | null = null;
  let bestCount = 0;
  for (const row of scores) {
    const next = (counts.get(row.player_id) ?? 0) + 1;
    counts.set(row.player_id, next);
    if (next > bestCount) {
      bestCount = next;
      bestId = row.player_id;
    }
  }
  return bestId;
}
