/**
 * Unit tests for {@link CraqueService} (`services/craque.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} and {@link Cache} so the
 * service's behaviour can be asserted without touching the network or the UI
 * (Requirement 5.4). They cover the "Craque da Partida" (Man of the Match)
 * voting contract:
 * - `vote` upserts a single active vote per user/fixture with
 *   `Prefer: resolution=merge-duplicates` and invalidates the cached tally on
 *   success (Requirement 22.3);
 * - `getVotes` tallies stored rows into one {@link CraqueResult} per player,
 *   ordered by vote count descending then playerId ascending (Requirement 22.4);
 * - `getManOfTheMatch` returns the current leader, or `null` when no votes have
 *   been cast (Requirement 22.4).
 *
 * Requirements: 22.3 (single active vote per user/fixture via upsert), 22.4
 * (tally per player and Man of the Match resolution).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CraqueService } from './craque.service';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { Result, SupabaseCraqueVoteRow } from '@/types/supabase';

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

const CRAQUE_VOTES_PATH = 'craque_votes';

/** Cache key holding the raw vote rows for a single fixture. */
function fixtureCacheKey(fixtureId: string): string {
  return `craque_votes:fixture:${fixtureId}`;
}

/** A raw `craque_votes` row as returned by Supabase. */
function voteRow(
  overrides: Partial<SupabaseCraqueVoteRow> = {},
): SupabaseCraqueVoteRow {
  return {
    fixture_id: 'fx-1',
    username: 'cassio',
    player_id: 'p1',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CraqueService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let cache: ReturnType<typeof makeCache>;
  let service: CraqueService;

  beforeEach(() => {
    supa = makeSupa();
    cache = makeCache();
    service = new CraqueService(supa, cache);
  });

  describe('vote', () => {
    it('upserts with Prefer: resolution=merge-duplicates and invalidates the cache on success (Req 22.3)', async () => {
      supa.post.mockResolvedValue({ ok: true, data: undefined });

      const result = await service.vote('fx-1', 'p7', 'cassio');

      expect(supa.post).toHaveBeenCalledTimes(1);
      const [path, body, opts] = supa.post.mock.calls[0];
      expect(path).toBe(CRAQUE_VOTES_PATH);

      // Body is a single-row array carrying the identifying key + choice.
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        fixture_id: 'fx-1',
        username: 'cassio',
        player_id: 'p7',
      });

      // The merge-duplicates upsert is what guarantees one active vote per
      // user/fixture (Requirement 22.3).
      expect(opts).toStrictEqual({ prefer: 'resolution=merge-duplicates' });

      // Cache for the fixture is invalidated so the next read reflects the vote.
      expect(cache.invalidate).toHaveBeenCalledWith(fixtureCacheKey('fx-1'));
      expect(result).toStrictEqual({ ok: true, data: undefined });
    });

    it('propagates the failing Result and does not invalidate the cache', async () => {
      const failure: Result<unknown> = {
        ok: false,
        error: 'permission denied',
        status: 403,
        code: '42501',
      };
      supa.post.mockResolvedValue(failure);

      const result = await service.vote('fx-1', 'p7', 'cassio');

      expect(result).toStrictEqual(failure);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('getVotes', () => {
    it('tallies votes per player, ordered by count desc then playerId asc (Req 22.4)', async () => {
      cache.get.mockReturnValue(null);
      const rows: SupabaseCraqueVoteRow[] = [
        voteRow({ username: 'u1', player_id: 'p2' }),
        voteRow({ username: 'u2', player_id: 'p1' }),
        voteRow({ username: 'u3', player_id: 'p1' }),
        voteRow({ username: 'u4', player_id: 'p2' }),
        voteRow({ username: 'u5', player_id: 'p3' }),
      ];
      supa.get.mockResolvedValue({ ok: true, data: rows });

      const tally = await service.getVotes('fx-1');

      expect(tally.fixtureId).toBe('fx-1');
      expect(tally.totalVotes).toBe(5);
      // p1 and p2 both have 2 votes -> tie broken by playerId asc (p1 first);
      // p3 has 1 vote and comes last.
      expect(tally.results).toStrictEqual([
        { playerId: 'p1', votes: 2 },
        { playerId: 'p2', votes: 2 },
        { playerId: 'p3', votes: 1 },
      ]);
    });

    it('counts each stored row as exactly one vote for its player', async () => {
      cache.get.mockReturnValue(null);
      const rows: SupabaseCraqueVoteRow[] = [
        voteRow({ username: 'u1', player_id: 'p9' }),
        voteRow({ username: 'u2', player_id: 'p9' }),
        voteRow({ username: 'u3', player_id: 'p9' }),
      ];
      supa.get.mockResolvedValue({ ok: true, data: rows });

      const tally = await service.getVotes('fx-1');

      expect(tally.results).toStrictEqual([{ playerId: 'p9', votes: 3 }]);
      expect(tally.totalVotes).toBe(3);
    });

    it('returns an empty tally when there are no votes', async () => {
      cache.get.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: true, data: [] });

      const tally = await service.getVotes('fx-1');

      expect(tally).toStrictEqual({
        fixtureId: 'fx-1',
        results: [],
        totalVotes: 0,
      });
    });

    it('serves a fresh cache hit without hitting Supabase', async () => {
      const cached: SupabaseCraqueVoteRow[] = [voteRow({ player_id: 'p1' })];
      cache.get.mockReturnValue(cached);

      const tally = await service.getVotes('fx-1');

      expect(cache.get).toHaveBeenCalledWith(fixtureCacheKey('fx-1'));
      expect(supa.get).not.toHaveBeenCalled();
      expect(tally.results).toStrictEqual([{ playerId: 'p1', votes: 1 }]);
    });

    it('caches the fetched rows on a cache miss', async () => {
      cache.get.mockReturnValue(null);
      const rows: SupabaseCraqueVoteRow[] = [voteRow({ player_id: 'p1' })];
      supa.get.mockResolvedValue({ ok: true, data: rows });

      await service.getVotes('fx-1');

      expect(cache.set).toHaveBeenCalledWith(fixtureCacheKey('fx-1'), rows);
    });

    it('falls back to the stale cached rows when the fetch fails', async () => {
      cache.get.mockReturnValue(null);
      const stale: SupabaseCraqueVoteRow[] = [
        voteRow({ username: 'u1', player_id: 'p1' }),
        voteRow({ username: 'u2', player_id: 'p1' }),
      ];
      cache.getStale.mockReturnValue(stale);
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const tally = await service.getVotes('fx-1');

      expect(cache.getStale).toHaveBeenCalledWith(fixtureCacheKey('fx-1'));
      expect(tally.results).toStrictEqual([{ playerId: 'p1', votes: 2 }]);
      expect(tally.totalVotes).toBe(2);
    });

    it('returns an empty tally when the fetch fails and nothing is cached', async () => {
      cache.get.mockReturnValue(null);
      cache.getStale.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const tally = await service.getVotes('fx-1');

      expect(tally).toStrictEqual({
        fixtureId: 'fx-1',
        results: [],
        totalVotes: 0,
      });
    });
  });

  describe('getManOfTheMatch', () => {
    it('returns the leader (most-voted player) for a fixture (Req 22.4)', async () => {
      cache.get.mockReturnValue(null);
      const rows: SupabaseCraqueVoteRow[] = [
        voteRow({ username: 'u1', player_id: 'p1' }),
        voteRow({ username: 'u2', player_id: 'p2' }),
        voteRow({ username: 'u3', player_id: 'p2' }),
      ];
      supa.get.mockResolvedValue({ ok: true, data: rows });

      const motm = await service.getManOfTheMatch('fx-1');

      expect(motm).toStrictEqual({ playerId: 'p2', votes: 2 });
    });

    it('breaks ties by playerId ascending, matching getVotes ordering', async () => {
      cache.get.mockReturnValue(null);
      const rows: SupabaseCraqueVoteRow[] = [
        voteRow({ username: 'u1', player_id: 'p2' }),
        voteRow({ username: 'u2', player_id: 'p1' }),
      ];
      supa.get.mockResolvedValue({ ok: true, data: rows });

      const motm = await service.getManOfTheMatch('fx-1');

      expect(motm).toStrictEqual({ playerId: 'p1', votes: 1 });
    });

    it('returns null when no votes have been cast (Req 22.4)', async () => {
      cache.get.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: true, data: [] });

      const motm = await service.getManOfTheMatch('fx-1');

      expect(motm).toBeNull();
    });
  });
});
