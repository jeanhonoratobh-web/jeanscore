/**
 * Unit tests for {@link AchievementService} (`services/achievement.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} and {@link Cache} so the
 * service's behaviour can be asserted without touching the network or the UI
 * (Requirement 5.4). They cover:
 * - `getDefinitions` returns the data-driven catalog (Requirements 10.1, 10.2);
 * - `getUnlocked` maps `user_achievements` rows into domain {@link Achievement}s
 *   (Requirement 10.5);
 * - `evaluateAndPersist` persists newly unlocked achievements via an upserting
 *   `POST` and refreshes the cache (Requirement 10.5);
 * - re-running `evaluateAndPersist` against an already-unlocked context does NOT
 *   persist duplicates — no `POST` is issued for ids already unlocked
 *   (idempotency, Requirement 10.6 / Property 17).
 *
 * Requirements: 10.5 (persisted unlocks kept between sessions), 10.6 (idempotent
 * unlock — re-evaluating never duplicates).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AchievementService, ACHIEVEMENT_CATALOG } from './achievement.service';
import type { AchievementContext } from '@/domain/achievements';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { SupabaseAchievementRow } from '@/types/supabase';

/** A mock {@link SupabaseClient} whose four verbs are `vi.fn()` spies. */
function makeSupa() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as SupabaseClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

/** A mock {@link Cache} whose methods are `vi.fn()` spies. */
function makeCache() {
  return {
    get: vi.fn(),
    getStale: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    sweep: vi.fn(),
  } as unknown as Cache & {
    get: ReturnType<typeof vi.fn>;
    getStale: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
    sweep: ReturnType<typeof vi.fn>;
  };
}

const USERNAME = 'cassio';
const CACHE_KEY = `achievements:${USERNAME}`;
const PATH = 'user_achievements';

/**
 * A baseline {@link AchievementContext} that satisfies no conditions, so the
 * catalog stays fully locked unless the test raises specific stats.
 */
function emptyContext(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    unlocked: [],
    totalRatings: 0,
    completedCompetitions: [],
    positionRatings: {},
    fullSeason: false,
    tenureDays: 0,
    ...overrides,
  };
}

describe('AchievementService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let cache: ReturnType<typeof makeCache>;
  let service: AchievementService;

  beforeEach(() => {
    supa = makeSupa();
    cache = makeCache();
    service = new AchievementService(supa, cache);
  });

  describe('getDefinitions', () => {
    it('returns the full data-driven catalog', () => {
      const defs = service.getDefinitions();

      expect(defs).toStrictEqual([...ACHIEVEMENT_CATALOG]);
      expect(defs).toHaveLength(ACHIEVEMENT_CATALOG.length);
    });

    it('returns a defensive copy so callers cannot mutate the shared catalog', () => {
      const defs = service.getDefinitions();
      const originalId = ACHIEVEMENT_CATALOG[0].id;

      defs[0].id = 'mutated';

      expect(ACHIEVEMENT_CATALOG[0].id).toBe(originalId);
      // A second call is unaffected by the earlier mutation.
      expect(service.getDefinitions()[0].id).toBe(originalId);
    });
  });

  describe('getUnlocked', () => {
    it('maps user_achievements rows to domain Achievements', async () => {
      const rows: SupabaseAchievementRow[] = [
        { username: USERNAME, achievement_id: 'firstRating', unlocked_at: '2024-01-01T00:00:00Z' },
        { username: USERNAME, achievement_id: 'tenRatings', unlocked_at: '2024-02-01T00:00:00Z' },
      ];
      cache.get.mockReturnValue(rows);

      const unlocked = await service.getUnlocked(USERNAME);

      expect(unlocked).toStrictEqual([
        { id: 'firstRating', unlockedAt: '2024-01-01T00:00:00Z' },
        { id: 'tenRatings', unlockedAt: '2024-02-01T00:00:00Z' },
      ]);
    });

    it('fetches, caches and maps rows on a cache miss', async () => {
      cache.get.mockReturnValue(null);
      const rows: SupabaseAchievementRow[] = [
        { username: USERNAME, achievement_id: 'firstRating', unlocked_at: '2024-01-01T00:00:00Z' },
      ];
      supa.get.mockResolvedValue({ ok: true, data: rows });

      const unlocked = await service.getUnlocked(USERNAME);

      const [path, select] = supa.get.mock.calls[0];
      expect(path).toBe(PATH);
      expect(select).toContain(`username=eq.${USERNAME}`);
      expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, rows);
      expect(unlocked).toStrictEqual([{ id: 'firstRating', unlockedAt: '2024-01-01T00:00:00Z' }]);
    });

    it('returns an empty list when nothing is cached and the fetch fails', async () => {
      cache.get.mockReturnValue(null);
      cache.getStale.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const unlocked = await service.getUnlocked(USERNAME);

      expect(unlocked).toStrictEqual([]);
    });
  });

  describe('evaluateAndPersist', () => {
    it('persists a newly unlocked achievement via an upserting POST (Requirement 10.5)', async () => {
      supa.post.mockResolvedValue({ ok: true, data: [] });
      // totalRatings >= 1 satisfies `firstRating`; nothing was unlocked before.
      const ctx = emptyContext({ totalRatings: 1 });

      const unlocked = await service.evaluateAndPersist(USERNAME, ctx);

      expect(supa.post).toHaveBeenCalledTimes(1);
      const [path, body, options] = supa.post.mock.calls[0];
      expect(path).toBe(PATH);
      expect(body).toMatchObject({ username: USERNAME, achievement_id: 'firstRating' });
      expect(body.unlocked_at).toEqual(expect.any(String));
      // Upsert semantics keyed on (username, achievement_id).
      expect(options).toStrictEqual({ prefer: 'resolution=merge-duplicates' });

      expect(unlocked.map((a) => a.id)).toContain('firstRating');
      // The cache is refreshed after a successful persist.
      expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, expect.any(Array));
    });

    it('does NOT persist duplicates for an already-unlocked achievement (idempotency, Requirement 10.6)', async () => {
      supa.post.mockResolvedValue({ ok: true, data: [] });
      // `firstRating` is already unlocked and its condition is still satisfied.
      const ctx = emptyContext({
        totalRatings: 1,
        unlocked: [{ id: 'firstRating', unlockedAt: '2024-01-01T00:00:00Z' }],
      });

      const unlocked = await service.evaluateAndPersist(USERNAME, ctx);

      // No POST is issued because there is no not-unlocked -> unlocked transition.
      expect(supa.post).not.toHaveBeenCalled();
      // The original unlock (and its unlockedAt) is preserved untouched.
      expect(unlocked).toContainEqual({ id: 'firstRating', unlockedAt: '2024-01-01T00:00:00Z' });
    });

    it('persists only genuine transitions, skipping ids already unlocked', async () => {
      supa.post.mockResolvedValue({ ok: true, data: [] });
      // `firstRating` already unlocked; raising totalRatings to 10 newly unlocks
      // `tenRatings`. Only the new one must be persisted.
      const ctx = emptyContext({
        totalRatings: 10,
        unlocked: [{ id: 'firstRating', unlockedAt: '2024-01-01T00:00:00Z' }],
      });

      await service.evaluateAndPersist(USERNAME, ctx);

      expect(supa.post).toHaveBeenCalledTimes(1);
      const [, body] = supa.post.mock.calls[0];
      expect(body.achievement_id).toBe('tenRatings');
    });

    it('does not refresh the cache when nothing new is unlocked', async () => {
      const ctx = emptyContext(); // satisfies no conditions

      const unlocked = await service.evaluateAndPersist(USERNAME, ctx);

      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
      expect(unlocked).toStrictEqual([]);
    });
  });
});
