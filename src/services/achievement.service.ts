/**
 * Achievement (Conquistas) data-access Service (`services/achievement.service.ts`).
 *
 * Orchestrates the data-driven achievement catalog and the persistence of a
 * user's unlocked achievements, delegating **all** unlock logic to the pure
 * `domain/achievements.ts` module. Its own responsibility is limited to reading
 * and writing the `user_achievements` table and exposing the catalog
 * (Requirements 10.1, 10.5, 10.6).
 *
 * Following the layering rules, the service receives its dependencies
 * ({@link SupabaseClient} and {@link Cache}) via constructor injection so it can
 * be unit-tested with mocks without touching the UI (Requirements 1.5, 5.4).
 * Reads go through the {@link Cache} first and fall back to the most recent
 * stale value when a network request fails (stale fallback, Requirement 1.8).
 *
 * The catalog ({@link ACHIEVEMENT_CATALOG}) is a plain data object: titles and
 * descriptions are referenced as {@link I18nKey}s (never hardcoded pt-BR text)
 * and each unlock rule is expressed as {@link AchievementCondition} data, so new
 * achievements are added by extending the catalog alone — with no change to the
 * evaluation code (Requirement 10.1).
 *
 * @see Requirements 10.1 (data-driven catalog), 10.5 (persisted unlocks),
 *   10.6 / Property 17 (idempotent unlock).
 */

import { evaluateAchievements, type AchievementContext } from '@/domain/achievements';
import type { Achievement, AchievementDef } from '@/types/domain';
import type { SupabaseAchievementRow } from '@/types/supabase';
import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';

/**
 * Competition ids used by the `competition_complete` achievements.
 *
 * Mirror the ids monitored by the platform (Série A = 71, Copa Libertadores =
 * 13). Kept as named constants so the catalog stays readable and the mapping is
 * expressed in one place.
 */
const COMPETITION_BRASILEIRAO = 71;
const COMPETITION_LIBERTADORES = 13;

/**
 * Number of position-specific ratings required to earn a "specialist"
 * achievement (`position_specialist`). Tunable catalog data (Requirement 10.1).
 */
const POSITION_SPECIALIST_THRESHOLD = 10;

/** Days of community tenure required for the "Veterano da Comunidade" achievement. */
const VETERAN_TENURE_DAYS = 365;

/**
 * The data-driven achievement catalog (Requirements 10.1, 10.2).
 *
 * Defines the minimum required achievements as plain configuration data: each
 * entry carries its i18n title/description keys and an
 * {@link AchievementCondition} interpreted by the pure `evaluateAchievements`
 * function. Adding a new achievement that reuses an existing condition type is
 * a matter of appending an entry here — no evaluation code changes
 * (Requirement 10.1).
 */
export const ACHIEVEMENT_CATALOG: readonly AchievementDef[] = [
  {
    id: 'firstRating',
    titleKey: 'achievement.firstRating.title',
    descriptionKey: 'achievement.firstRating.desc',
    condition: { type: 'total_ratings', threshold: 1 },
  },
  {
    id: 'tenRatings',
    titleKey: 'achievement.tenRatings.title',
    descriptionKey: 'achievement.tenRatings.desc',
    condition: { type: 'total_ratings', threshold: 10 },
  },
  {
    id: 'hundredRatings',
    titleKey: 'achievement.hundredRatings.title',
    descriptionKey: 'achievement.hundredRatings.desc',
    condition: { type: 'total_ratings', threshold: 100 },
  },
  {
    id: 'allBrasileirao',
    titleKey: 'achievement.allBrasileirao.title',
    descriptionKey: 'achievement.allBrasileirao.desc',
    condition: { type: 'competition_complete', competition: COMPETITION_BRASILEIRAO },
  },
  {
    id: 'allLibertadores',
    titleKey: 'achievement.allLibertadores.title',
    descriptionKey: 'achievement.allLibertadores.desc',
    condition: { type: 'competition_complete', competition: COMPETITION_LIBERTADORES },
  },
  {
    id: 'goalkeeperExpert',
    titleKey: 'achievement.goalkeeperExpert.title',
    descriptionKey: 'achievement.goalkeeperExpert.desc',
    condition: {
      type: 'position_specialist',
      position: 'Goalkeeper',
      threshold: POSITION_SPECIALIST_THRESHOLD,
    },
  },
  {
    id: 'defenderExpert',
    titleKey: 'achievement.defenderExpert.title',
    descriptionKey: 'achievement.defenderExpert.desc',
    condition: {
      type: 'position_specialist',
      position: 'Defender',
      threshold: POSITION_SPECIALIST_THRESHOLD,
    },
  },
  {
    id: 'seasonSupporter',
    titleKey: 'achievement.seasonSupporter.title',
    descriptionKey: 'achievement.seasonSupporter.desc',
    condition: { type: 'full_season' },
  },
  {
    id: 'communityVeteran',
    titleKey: 'achievement.communityVeteran.title',
    descriptionKey: 'achievement.communityVeteran.desc',
    condition: { type: 'veteran', threshold: VETERAN_TENURE_DAYS },
  },
];

/** Builds the per-user cache key for persisted unlocked achievements. */
function achievementsCacheKey(username: string): string {
  return `achievements:${username}`;
}

/**
 * Data-access Service for Conquistas (Requirement 10).
 *
 * A thin orchestration layer: it exposes the data-driven catalog, reads the
 * user's persisted unlocked achievements and persists newly unlocked ones. All
 * unlock decisions are delegated to the pure `evaluateAchievements` function so
 * the rules stay data-driven and property-testable without any UI or network
 * concern (Requirements 10.1, 10.6).
 */
export class AchievementService {
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
   * Returns the data-driven achievement catalog (Requirements 10.1, 10.2).
   *
   * The catalog is static configuration data; a fresh array copy is returned so
   * callers cannot mutate the shared {@link ACHIEVEMENT_CATALOG}.
   *
   * @returns The list of {@link AchievementDef} entries.
   */
  getDefinitions(): AchievementDef[] {
    return ACHIEVEMENT_CATALOG.map((def) => ({ ...def }));
  }

  /**
   * Returns the user's persisted unlocked achievements, kept between sessions
   * (Requirement 10.5).
   *
   * Reads the `user_achievements` table cache-first, falling back to the most
   * recent stale value on a network failure (Requirement 1.8).
   *
   * @param username The authenticated user's username.
   * @returns The user's unlocked {@link Achievement} list (empty when none).
   */
  async getUnlocked(username: string): Promise<Achievement[]> {
    const rows = await this.getAchievementRows(username);
    return rows.map((row) => ({ id: row.achievement_id, unlockedAt: row.unlocked_at }));
  }

  /**
   * Evaluates the catalog against the user's context and persists any newly
   * unlocked achievements idempotently (Requirements 10.1, 10.5, 10.6).
   *
   * The unlock decision is delegated entirely to the pure
   * {@link evaluateAchievements} function. Only achievements that transition
   * from not-unlocked to unlocked during this evaluation are written, and each
   * write is an upsert (`resolution=merge-duplicates`) keyed on
   * `(username, achievement_id)`, so re-evaluating an already-unlocked
   * achievement never duplicates a row nor re-stamps its `unlocked_at`
   * (idempotency, Requirement 10.6 / Property 17).
   *
   * On success the cached unlocked set is refreshed so a subsequent
   * {@link getUnlocked} reflects the change.
   *
   * @param username The authenticated user's username.
   * @param ctx The user's current unlock state and participation stats.
   * @returns The full set of unlocked {@link Achievement}s after evaluation.
   */
  async evaluateAndPersist(
    username: string,
    ctx: AchievementContext,
  ): Promise<Achievement[]> {
    const defs = ACHIEVEMENT_CATALOG as AchievementDef[];

    // Snapshot which achievements were already unlocked before evaluating, so
    // only genuine transitions are persisted (idempotency, Requirement 10.6).
    const previouslyUnlocked = new Set(
      ctx.unlocked.filter((a) => a.unlockedAt !== null).map((a) => a.id),
    );

    const evaluated = evaluateAchievements(ctx, defs);
    const unlocked = evaluated.unlocked.filter((a) => a.unlockedAt !== null);

    const newlyUnlocked = unlocked.filter((a) => !previouslyUnlocked.has(a.id));

    // Persist each newly unlocked achievement via upsert (no duplicates).
    let persistedAny = false;
    for (const achievement of newlyUnlocked) {
      const row: SupabaseAchievementRow = {
        username,
        achievement_id: achievement.id,
        unlocked_at: achievement.unlockedAt as string,
      };
      const res = await this.supa.post<SupabaseAchievementRow[]>('user_achievements', row, {
        prefer: 'resolution=merge-duplicates',
      });
      if (res.ok) {
        persistedAny = true;
      }
    }

    // Refresh the cached unlocked set so the next read reflects the writes.
    if (persistedAny) {
      const rows: SupabaseAchievementRow[] = unlocked.map((a) => ({
        username,
        achievement_id: a.id,
        unlocked_at: a.unlockedAt as string,
      }));
      this.cache.set<SupabaseAchievementRow[]>(achievementsCacheKey(username), rows);
    }

    return unlocked;
  }

  // -------------------------------------------------------------------------
  // Internal read helpers (cached, with stale fallback)
  // -------------------------------------------------------------------------

  /**
   * Fetches the user's unlocked achievement rows cache-first, with a stale
   * fallback when the network request fails (Requirements 1.7, 1.8).
   */
  private async getAchievementRows(username: string): Promise<SupabaseAchievementRow[]> {
    const key = achievementsCacheKey(username);
    const cached = this.cache.get<SupabaseAchievementRow[]>(key);
    if (cached !== null) {
      return cached;
    }

    const res = await this.supa.get<SupabaseAchievementRow[]>(
      'user_achievements',
      `select=*&username=eq.${encodeURIComponent(username)}`,
    );
    if (res.ok) {
      const rows = res.data ?? [];
      this.cache.set<SupabaseAchievementRow[]>(key, rows);
      return rows;
    }

    return this.cache.getStale<SupabaseAchievementRow[]>(key) ?? [];
  }
}
