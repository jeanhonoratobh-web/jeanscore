/**
 * Unit tests for {@link ScoreService} (`services/score.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} and a mock {@link Cache} so
 * the Service's data-access orchestration can be verified in isolation, without
 * touching the network or a real cache. They cover the three write/read
 * contracts that carry business rules:
 *
 * - `savePermanentScore` translates a unique-violation (SQLSTATE `23505`) into
 *   the domain message {@link PERMANENT_DUPLICATE_MESSAGE} and does NOT persist
 *   new data; a generic backend failure is passed through unchanged as
 *   `{ ok: false }`; a success returns `{ ok: true }` (Requirement 21.4).
 * - `submitScores` reports the whole batch as succeeded on a successful upsert
 *   (BatchResult happy path).
 * - `getFixtureScores` aggregates community ratings into one entry per player.
 *
 * Requirements: 21.4 (duplicate permanent rating blocked and translated).
 */
import { describe, it, expect, vi } from 'vitest';
import { ScoreService, PERMANENT_DUPLICATE_MESSAGE } from './score.service';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { ScoreEntry } from '@/domain/serialization';
import type { FixtureContext, PermanentScoreInput } from '@/types/service';
import type { Result } from '@/types/supabase';
import type { SupabaseGameScoreRow } from '@/types/supabase';

/**
 * Builds a mock {@link SupabaseClient} whose verbs are `vi.fn()` mocks. The
 * returned `get`/`post` mocks are the exact functions wired into the client, so
 * callers configure them (`mockResolvedValue`) and assert on their calls.
 */
function makeSupabase(): {
  supa: SupabaseClient;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn();
  const post = vi.fn();
  const supa = {
    get,
    post,
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as SupabaseClient;
  return { supa, get, post };
}

/**
 * Builds a mock {@link Cache} that always misses (so reads hit the client) and
 * records `invalidate` calls, letting tests assert cache invalidation on writes.
 */
function makeCache(): {
  cache: Cache;
  invalidate: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  const invalidate = vi.fn();
  const set = vi.fn();
  const cache: Cache = {
    get: vi.fn().mockReturnValue(null),
    getStale: vi.fn().mockReturnValue(null),
    set,
    invalidate,
    sweep: vi.fn(),
  };
  return { cache, invalidate, set };
}

const CTX: FixtureContext = {
  homeTeam: 'Cruzeiro',
  awayTeam: 'Atlético',
  fixtureDate: '2024-05-01',
};

const PERMANENT_INPUT: PermanentScoreInput = {
  playerId: 'p1',
  playerName: 'Cassio',
  username: 'jean',
  year: 2024,
  score: 8,
};

/** Builds a raw game-score row with sensible defaults for aggregation tests. */
function makeRow(overrides: Partial<SupabaseGameScoreRow> = {}): SupabaseGameScoreRow {
  return {
    fixture_id: 'f1',
    player_id: 'p1',
    player_name: 'Cassio',
    username: 'jean',
    score: 7,
    home_team: 'Cruzeiro',
    away_team: 'Atlético',
    fixture_date: '2024-05-01',
    created_at: '2024-05-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('ScoreService', () => {
  describe('savePermanentScore', () => {
    it('maps a 23505 duplicate to { ok: false, error: PERMANENT_DUPLICATE_MESSAGE } and does not persist', async () => {
      const failure: Result<SupabasePermanentPost> = {
        ok: false,
        error: 'duplicate key value violates unique constraint',
        status: 409,
        code: '23505',
      };
      const { supa, post } = makeSupabase();
      post.mockResolvedValue(failure);
      const { cache, invalidate } = makeCache();
      const service = new ScoreService(supa, cache);

      const result = await service.savePermanentScore(PERMANENT_INPUT);

      expect(result).toStrictEqual({
        ok: false,
        error: PERMANENT_DUPLICATE_MESSAGE,
        code: '23505',
      });
      // The insert was attempted exactly once and no cache was invalidated,
      // i.e. no new data was recorded (Requirement 21.4).
      expect(post).toHaveBeenCalledTimes(1);
      expect(invalidate).not.toHaveBeenCalled();
    });

    it('passes a generic backend failure through unchanged as { ok: false }', async () => {
      const failure: Result<SupabasePermanentPost> = {
        ok: false,
        error: 'boom',
        status: 500,
      };
      const { supa, post } = makeSupabase();
      post.mockResolvedValue(failure);
      const { cache, invalidate } = makeCache();
      const service = new ScoreService(supa, cache);

      const result = await service.savePermanentScore(PERMANENT_INPUT);

      expect(result).toStrictEqual({ ok: false, error: 'boom', status: 500 });
      expect(invalidate).not.toHaveBeenCalled();
    });

    it('returns { ok: true } and invalidates the year cache on success', async () => {
      const { supa, post } = makeSupabase();
      post.mockResolvedValue({ ok: true, data: [] });
      const { cache, invalidate } = makeCache();
      const service = new ScoreService(supa, cache);

      const result = await service.savePermanentScore(PERMANENT_INPUT);

      expect(result).toStrictEqual({ ok: true, data: undefined });
      expect(invalidate).toHaveBeenCalledWith('permanent_scores:2024');
    });
  });

  describe('submitScores', () => {
    it('reports the whole batch as succeeded on a successful upsert', async () => {
      const entries: ScoreEntry[] = [
        { playerId: 'p1', playerName: 'Cassio', score: 7 },
        { playerId: 'p2', playerName: 'Fagner', score: 8 },
      ];
      const { supa, post } = makeSupabase();
      post.mockResolvedValue({ ok: true, data: [] });
      const { cache, invalidate } = makeCache();
      const service = new ScoreService(supa, cache);

      const result = await service.submitScores('f1', entries, 'jean', CTX);

      expect(result).toStrictEqual({ ok: true, succeeded: 2, failed: 0, errors: [] });
      // Sent as a single upsert request carrying the match context on each row.
      expect(post).toHaveBeenCalledTimes(1);
      const [path, rows, opts] = post.mock.calls[0];
      expect(path).toBe('game_scores');
      expect(opts).toStrictEqual({ prefer: 'resolution=merge-duplicates' });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        fixture_id: 'f1',
        player_id: 'p1',
        username: 'jean',
        home_team: 'Cruzeiro',
        away_team: 'Atlético',
        fixture_date: '2024-05-01',
      });
      expect(invalidate).toHaveBeenCalledWith('game_scores:all');
      expect(invalidate).toHaveBeenCalledWith('game_scores:fixture:f1');
    });

    it('reports the whole batch as failed with the backend error on an upsert failure', async () => {
      const entries: ScoreEntry[] = [{ playerId: 'p1', playerName: 'Cassio', score: 7 }];
      const { supa, post } = makeSupabase();
      post.mockResolvedValue({ ok: false, error: 'network down' });
      const { cache, invalidate } = makeCache();
      const service = new ScoreService(supa, cache);

      const result = await service.submitScores('f1', entries, 'jean', CTX);

      expect(result).toStrictEqual({
        ok: false,
        succeeded: 0,
        failed: 1,
        errors: [{ index: 0, message: 'network down' }],
      });
      expect(invalidate).not.toHaveBeenCalled();
    });

    it('short-circuits an empty batch without calling the client', async () => {
      const { supa, post } = makeSupabase();
      const { cache } = makeCache();
      const service = new ScoreService(supa, cache);

      const result = await service.submitScores('f1', [], 'jean', CTX);

      expect(result).toStrictEqual({ ok: true, succeeded: 0, failed: 0, errors: [] });
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('getFixtureScores', () => {
    it('aggregates ratings into one entry per player, ordered by average desc', async () => {
      const rows: SupabaseGameScoreRow[] = [
        makeRow({ player_id: 'p1', player_name: 'Cassio', username: 'a', score: 6 }),
        makeRow({ player_id: 'p1', player_name: 'Cassio', username: 'b', score: 8 }),
        makeRow({ player_id: 'p2', player_name: 'Fagner', username: 'a', score: 9 }),
      ];
      const { supa, get } = makeSupabase();
      get.mockResolvedValue({ ok: true, data: rows });
      const { cache } = makeCache();
      const service = new ScoreService(supa, cache);

      const aggregates = await service.getFixtureScores('f1');

      expect(aggregates).toStrictEqual([
        { playerId: 'p2', playerName: 'Fagner', avg: 9, votes: 1 },
        { playerId: 'p1', playerName: 'Cassio', avg: 7, votes: 2 },
      ]);
    });

    it('returns an empty list when the fixture has no ratings', async () => {
      const { supa, get } = makeSupabase();
      get.mockResolvedValue({ ok: true, data: [] });
      const { cache } = makeCache();
      const service = new ScoreService(supa, cache);

      expect(await service.getFixtureScores('f1')).toStrictEqual([]);
    });
  });
});

/** Local alias mirroring the payload shape ScoreService POSTs to permanent_scores. */
type SupabasePermanentPost = unknown[];
