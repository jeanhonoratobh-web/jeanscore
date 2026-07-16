/**
 * Unit tests for {@link FanScoreService} (`services/fan-score.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} and {@link Cache} so the
 * service's Fan Score contract can be asserted without touching the network or
 * the UI (Requirement 5.4). They cover:
 * - `getFanScore` returning `0` when the user has no Fan Score row;
 * - `awardAction` incrementing the score by the action's configured points and
 *   persisting it via an upsert `POST` (Requirement 9.2);
 * - `awardAction` reporting `leveledUp = true` only when the award crosses a
 *   level threshold, and `false` otherwise (Requirement 9.5);
 * - the same behaviour driven by a custom {@link FanScoreConfig} to prove the
 *   rules are data-driven (Requirement 9.7).
 *
 * Requirements: 9.2 (increment on a scorable action + persist), 9.5 (promote on
 * reaching a new level).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FanScoreService,
  DEFAULT_FAN_SCORE_CONFIG,
} from './fan-score.service';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { FanScoreConfig } from '@/types/config';
import type { Result, SupabaseFanScoreRow } from '@/types/supabase';

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
const CACHE_KEY = `fan_score:${USERNAME}`;
const FAN_SCORES_PATH = 'fan_scores';

/** Builds a cached Fan Score row for the test user. */
function row(fanScore: number, fanLevel: SupabaseFanScoreRow['fan_level']): SupabaseFanScoreRow {
  return {
    username: USERNAME,
    fan_score: fanScore,
    fan_level: fanLevel,
    updated_at: '2024-01-01T00:00:00Z',
  };
}

describe('FanScoreService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let cache: ReturnType<typeof makeCache>;
  let service: FanScoreService;

  beforeEach(() => {
    supa = makeSupa();
    cache = makeCache();
    service = new FanScoreService(supa, cache);
  });

  describe('getFanScore', () => {
    it('returns 0 when the user has no Fan Score row', async () => {
      cache.get.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: true, data: [] } satisfies Result<SupabaseFanScoreRow[]>);

      const score = await service.getFanScore(USERNAME);

      expect(score).toBe(0);
    });

    it('returns the accumulated score from an existing row', async () => {
      cache.get.mockReturnValue([row(140, 'torcedor')]);

      const score = await service.getFanScore(USERNAME);

      expect(score).toBe(140);
    });
  });

  describe('awardAction', () => {
    it("increments the score by the action's points and persists via an upsert (Req 9.2)", async () => {
      // Current score 50 (iniciante); award rate_match (+10) -> 60.
      cache.get.mockReturnValue([row(50, 'iniciante')]);
      supa.post.mockResolvedValue({ ok: true, data: [] });

      const result = await service.awardAction(USERNAME, 'rate_match');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.data.fanScore).toBe(
        50 + DEFAULT_FAN_SCORE_CONFIG.actionPoints.rate_match,
      );

      // Persisted exactly once as an upsert carrying the new score.
      expect(supa.post).toHaveBeenCalledTimes(1);
      const [path, body, opts] = supa.post.mock.calls[0];
      expect(path).toBe(FAN_SCORES_PATH);
      expect(opts).toStrictEqual({ prefer: 'resolution=merge-duplicates' });
      expect(body).toMatchObject({
        username: USERNAME,
        fan_score: 60,
        fan_level: 'iniciante',
      });

      // Cache refreshed so a subsequent read reflects the award.
      expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, [body]);
    });

    it('reports leveledUp = true when the award crosses a level threshold (Req 9.5)', async () => {
      // Current score 90 (iniciante); award rate_match (+10) -> 100 = torcedor.
      cache.get.mockReturnValue([row(90, 'iniciante')]);
      supa.post.mockResolvedValue({ ok: true, data: [] });

      const result = await service.awardAction(USERNAME, 'rate_match');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.data.fanScore).toBe(100);
      expect(result.data.previousLevel).toBe('iniciante');
      expect(result.data.fanLevel).toBe('torcedor');
      expect(result.data.leveledUp).toBe(true);
    });

    it('reports leveledUp = false when the award stays within the same level (Req 9.5)', async () => {
      // Current score 50 (iniciante); award rate_match (+10) -> 60, still iniciante.
      cache.get.mockReturnValue([row(50, 'iniciante')]);
      supa.post.mockResolvedValue({ ok: true, data: [] });

      const result = await service.awardAction(USERNAME, 'rate_match');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.data.leveledUp).toBe(false);
      expect(result.data.fanLevel).toBe('iniciante');
      expect(result.data.previousLevel).toBe('iniciante');
    });

    it('propagates a persistence failure and does not refresh the cache', async () => {
      cache.get.mockReturnValue([row(50, 'iniciante')]);
      const failure: Result<SupabaseFanScoreRow[]> = {
        ok: false,
        error: 'permission denied',
        status: 403,
        code: '42501',
      };
      supa.post.mockResolvedValue(failure);

      const result = await service.awardAction(USERNAME, 'rate_match');

      expect(result).toStrictEqual(failure);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('applies a custom data-driven config for points and thresholds (Req 9.7)', async () => {
      // Custom rules: rate_match worth 40, torcedor threshold at 40.
      const customConfig: FanScoreConfig = {
        actionPoints: {
          rate_match: 40,
          rate_full_lineup: 0,
          consecutive_match: 0,
          daily_return: 0,
          full_season: 0,
          vote_craque: 0,
          prediction_hit: 0,
        },
        levelThresholds: [
          { level: 'iniciante', min: 0 },
          { level: 'torcedor', min: 40 },
        ],
      };
      service = new FanScoreService(supa, cache, customConfig);

      // Current score 0 (iniciante); award rate_match (+40) -> 40 = torcedor.
      cache.get.mockReturnValue([row(0, 'iniciante')]);
      supa.post.mockResolvedValue({ ok: true, data: [] });

      const result = await service.awardAction(USERNAME, 'rate_match');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected success');
      expect(result.data.fanScore).toBe(40);
      expect(result.data.fanLevel).toBe('torcedor');
      expect(result.data.leveledUp).toBe(true);
    });
  });
});
