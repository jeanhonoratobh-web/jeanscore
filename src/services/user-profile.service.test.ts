/**
 * Unit tests for {@link UserProfileService} (`services/user-profile.service.ts`).
 *
 * The service is exercised with a mock {@link SupabaseClient} whose `get()`
 * returns a different payload per table path (`users`, `game_scores`,
 * `fan_scores`, `user_achievements`, `onboarding`, `squad`) and a real
 * {@link MemoryCache}. The tests assert the personal-statistics aggregation and
 * the persistence of onboarding completion:
 *
 * - `getProfile` derives `totalRatings` (all ratings), `matchesRated` (distinct
 *   fixtures) and `favoritePlayerId` (most-rated player) from `game_scores`
 *   (Requirement 8.2).
 * - `getFavoritePlayer` resolves the most-rated player from the `squad` table
 *   (Requirement 8.2).
 * - `completeOnboarding` upserts the `onboarding` row and
 *   `isOnboardingComplete` reports `true` afterwards (Requirement 7.2).
 *
 * Requirements: 7.2 (persistent onboarding completion), 8.2 (personal stats +
 * favorite player).
 */
import { describe, it, expect, vi } from 'vitest';
import { UserProfileService } from './user-profile.service';
import { MemoryCache } from './cache';
import type { PreferHeader, SupabaseClient } from './supabase-client';
import type { Result } from '@/types/supabase';
import type {
  SupabaseGameScoreRow,
  SupabaseSquadRow,
} from '@/types/supabase';

const USERNAME = 'jean';

/** Builds a `game_scores` row with sensible defaults, overriding what matters. */
function gameScore(overrides: Partial<SupabaseGameScoreRow>): SupabaseGameScoreRow {
  return {
    fixture_id: 'f1',
    player_id: 'p1',
    player_name: 'Player 1',
    username: USERNAME,
    score: 8,
    home_team: 'Cruzeiro',
    away_team: 'Rival',
    fixture_date: '2024-01-01',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A squad row for the favorite player used across tests. */
const SQUAD_P1: SupabaseSquadRow = {
  id: 'p1',
  name: 'Player 1',
  position: 'ATA',
  number: 9,
  nationality: 'BRA',
  photo: null,
};

/**
 * Builds a mock {@link SupabaseClient} whose `get()` resolves to the payload
 * registered for the requested table path. `post()` records upsert calls and
 * always succeeds unless configured otherwise.
 */
function makeSupa(payloads: Record<string, unknown>) {
  const post = vi.fn(
    async (
      _path: string,
      _body: unknown,
      _opts?: PreferHeader,
    ): Promise<Result<unknown>> => ({ ok: true, data: [_body] }),
  );

  const get = vi.fn(
    async (path: string, _params?: string): Promise<Result<unknown>> => {
      if (path in payloads) {
        return { ok: true, data: payloads[path] };
      }
      return { ok: true, data: [] };
    },
  );

  const supa: SupabaseClient = {
    get: get as SupabaseClient['get'],
    post: post as SupabaseClient['post'],
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return { supa, get, post };
}

describe('UserProfileService', () => {
  describe('getProfile', () => {
    it('aggregates total ratings, distinct matches rated and the most-rated favorite player', async () => {
      // p1 rated 3 times across fixtures f1/f2/f3; p2 rated once in f1.
      // => 4 total ratings, 3 distinct fixtures, favorite = p1.
      const scores: SupabaseGameScoreRow[] = [
        gameScore({ fixture_id: 'f1', player_id: 'p1' }),
        gameScore({ fixture_id: 'f1', player_id: 'p2', player_name: 'Player 2' }),
        gameScore({ fixture_id: 'f2', player_id: 'p1' }),
        gameScore({ fixture_id: 'f3', player_id: 'p1' }),
      ];
      const { supa } = makeSupa({
        users: [{ username: USERNAME, created_at: '2023-05-01T12:00:00.000Z' }],
        game_scores: scores,
        fan_scores: [{ username: USERNAME, fan_score: 120, fan_level: 'torcedor' }],
        user_achievements: [
          { username: USERNAME, achievement_id: 'a1', unlocked_at: '2024-02-01T00:00:00.000Z' },
        ],
        onboarding: [],
      });
      const service = new UserProfileService(supa, new MemoryCache());

      const profile = await service.getProfile(USERNAME);

      expect(profile.username).toBe(USERNAME);
      expect(profile.memberSince).toBe('2023-05-01T12:00:00.000Z');
      expect(profile.totalRatings).toBe(4);
      expect(profile.matchesRated).toBe(3);
      expect(profile.favoritePlayerId).toBe('p1');
      expect(profile.fanScore).toBe(120);
      expect(profile.fanLevel).toBe('torcedor');
      expect(profile.achievements).toStrictEqual([
        { id: 'a1', unlockedAt: '2024-02-01T00:00:00.000Z' },
      ]);
      expect(profile.onboardingComplete).toBe(false);
    });

    it('returns zeroed stats and a null favorite player when the user has no ratings', async () => {
      const { supa } = makeSupa({
        users: [{ username: USERNAME, created_at: '2023-05-01T12:00:00.000Z' }],
        game_scores: [],
      });
      const service = new UserProfileService(supa, new MemoryCache());

      const profile = await service.getProfile(USERNAME);

      expect(profile.totalRatings).toBe(0);
      expect(profile.matchesRated).toBe(0);
      expect(profile.favoritePlayerId).toBeNull();
      expect(profile.fanScore).toBe(0);
      expect(profile.fanLevel).toBe('iniciante');
    });
  });

  describe('getFavoritePlayer', () => {
    it('resolves the most-rated player from the squad', async () => {
      const scores: SupabaseGameScoreRow[] = [
        gameScore({ fixture_id: 'f1', player_id: 'p1' }),
        gameScore({ fixture_id: 'f2', player_id: 'p1' }),
        gameScore({ fixture_id: 'f1', player_id: 'p2', player_name: 'Player 2' }),
      ];
      const { supa, get } = makeSupa({
        game_scores: scores,
        squad: [SQUAD_P1],
      });
      const service = new UserProfileService(supa, new MemoryCache());

      const player = await service.getFavoritePlayer(USERNAME);

      expect(player).toStrictEqual({
        id: 'p1',
        name: 'Player 1',
        position: 'ATA',
        number: 9,
        nationality: 'BRA',
        photo: null,
      });
      // The squad lookup must target the most-rated player id.
      const squadCall = get.mock.calls.find(([path]) => path === 'squad');
      expect(squadCall?.[1]).toContain('id=eq.p1');
    });

    it('returns null when the user has no ratings', async () => {
      const { supa } = makeSupa({ game_scores: [] });
      const service = new UserProfileService(supa, new MemoryCache());

      expect(await service.getFavoritePlayer(USERNAME)).toBeNull();
    });

    it('returns null when the most-rated player is missing from the squad', async () => {
      const { supa } = makeSupa({
        game_scores: [gameScore({ player_id: 'ghost' })],
        squad: [],
      });
      const service = new UserProfileService(supa, new MemoryCache());

      expect(await service.getFavoritePlayer(USERNAME)).toBeNull();
    });
  });

  describe('onboarding completion (Requirement 7.2)', () => {
    it('upserts the onboarding row and reports completion afterwards', async () => {
      const { supa, post } = makeSupa({ onboarding: [] });
      const cache = new MemoryCache();
      const service = new UserProfileService(supa, cache);

      // Initially not complete (backend returns no onboarding row).
      expect(await service.isOnboardingComplete(USERNAME)).toBe(false);

      const result = await service.completeOnboarding(USERNAME);

      expect(result.ok).toBe(true);
      // Persisted as an upsert (merge-duplicates) with completed = true.
      expect(post).toHaveBeenCalledTimes(1);
      const [path, body, opts] = post.mock.calls[0];
      expect(path).toBe('onboarding');
      expect(body).toMatchObject({ username: USERNAME, completed: true });
      expect(opts).toStrictEqual({ prefer: 'resolution=merge-duplicates' });

      // Subsequent read reflects the completion.
      expect(await service.isOnboardingComplete(USERNAME)).toBe(true);
    });

    it('propagates the failure and does not mark completion when the upsert fails', async () => {
      const { supa } = makeSupa({ onboarding: [] });
      supa.post = vi
        .fn()
        .mockResolvedValue({ ok: false, error: 'boom', status: 500 }) as SupabaseClient['post'];
      const service = new UserProfileService(supa, new MemoryCache());

      const result = await service.completeOnboarding(USERNAME);

      expect(result.ok).toBe(false);
      // The cached flag was never set, so a fresh read stays false.
      expect(await service.isOnboardingComplete(USERNAME)).toBe(false);
    });
  });
});
