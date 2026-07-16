/**
 * Unit tests for {@link SquadService} (`services/squad.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} (each verb is a `vi.fn`
 * returning a typed {@link Result}) together with a mock {@link Cache} whose
 * `get`/`getStale` are independent `vi.fn`s. Mocking the cache lets the
 * service's stale-fallback branch be exercised in isolation — `get` reports a
 * miss while `getStale` still yields the last known value — without depending
 * on the real cache's eviction timing.
 *
 * They cover the two behaviours owned by the service:
 * - reads through the cache with a stale fallback on a network/non-2xx failure
 *   (Requirement 1.8);
 * - the batch import contract: whole-batch rejection on any invalid item and
 *   partial-success reporting otherwise (Requirement 28.5).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SquadService } from './squad.service';
import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';
import type { Player } from '@/types/domain';
import type { SupabaseSquadRow } from '@/types/supabase';
import type { PlayerInput } from '@/types/service';

const SQUAD_CACHE_KEY = 'squad';

/** A single raw `squad` row used to seed the mock backend. */
function row(overrides: Partial<SupabaseSquadRow> = {}): SupabaseSquadRow {
  return {
    id: 'p1',
    name: 'Cassio',
    position: 'Goalkeeper',
    number: 1,
    nationality: 'Brazil',
    photo: null,
    ...overrides,
  };
}

/** The domain {@link Player} that {@link row} maps to via `toPlayer`. */
function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Cassio',
    position: 'Goalkeeper',
    number: 1,
    nationality: 'Brazil',
    photo: null,
    ...overrides,
  };
}

/** A valid {@link PlayerInput} for import/write tests. */
function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    id: 'p1',
    name: 'Cassio',
    position: 'Goalkeeper',
    ...overrides,
  };
}

/**
 * Builds a mock {@link SupabaseClient} whose four verbs are `vi.fn`s. Callers
 * override individual verbs per test via `mockResolvedValue*`.
 */
function makeSupa(): { [K in keyof SupabaseClient]: ReturnType<typeof vi.fn> } & SupabaseClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as { [K in keyof SupabaseClient]: ReturnType<typeof vi.fn> } & SupabaseClient;
}

/** Builds a mock {@link Cache} whose methods are independent `vi.fn`s. */
function makeCache(): { [K in keyof Cache]: ReturnType<typeof vi.fn> } & Cache {
  return {
    get: vi.fn().mockReturnValue(null),
    getStale: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    invalidate: vi.fn(),
    sweep: vi.fn(),
  } as unknown as { [K in keyof Cache]: ReturnType<typeof vi.fn> } & Cache;
}

describe('SquadService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let cache: ReturnType<typeof makeCache>;
  let service: SquadService;

  beforeEach(() => {
    supa = makeSupa();
    cache = makeCache();
    service = new SquadService(supa, cache);
  });

  describe('getSquad — cached reads with stale fallback (Req 1.8)', () => {
    it('returns the fresh cached value without hitting Supabase', async () => {
      const cached = [player()];
      cache.get.mockReturnValue(cached);

      const result = await service.getSquad();

      expect(result).toStrictEqual(cached);
      expect(cache.get).toHaveBeenCalledWith(SQUAD_CACHE_KEY);
      expect(supa.get).not.toHaveBeenCalled();
    });

    it('fetches from Supabase on a cache miss, maps rows and caches the result', async () => {
      cache.get.mockReturnValue(null); // miss
      supa.get.mockResolvedValue({ ok: true, data: [row()] });

      const result = await service.getSquad();

      expect(result).toStrictEqual([player()]);
      expect(supa.get).toHaveBeenCalledTimes(1);
      expect(supa.get).toHaveBeenCalledWith('squad', 'select=*&order=name.asc');
      // The freshly fetched, mapped players are written back to the cache.
      expect(cache.set).toHaveBeenCalledWith(SQUAD_CACHE_KEY, [player()]);
    });

    it('falls back to the stale cached value when the fetch fails (Req 1.8)', async () => {
      const stale = [player({ name: 'Old Value' })];
      cache.get.mockReturnValue(null); // fresh miss (expired/absent)
      cache.getStale.mockReturnValue(stale); // last known value survives
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const result = await service.getSquad();

      expect(result).toStrictEqual(stale);
      expect(cache.getStale).toHaveBeenCalledWith(SQUAD_CACHE_KEY);
      // A failed fetch must not overwrite the cached value.
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('returns an empty array when the fetch fails and no stale value exists', async () => {
      cache.get.mockReturnValue(null);
      cache.getStale.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const result = await service.getSquad();

      expect(result).toStrictEqual([]);
    });
  });

  describe('importBatch — validation and partial success (Req 28.5)', () => {
    it('rejects the whole batch when any item is missing a required field', async () => {
      const players: PlayerInput[] = [
        input({ id: 'p1' }),
        input({ id: 'p2', name: '   ' }), // blank name -> invalid
        input({ id: 'p3' }),
      ];

      const result = await service.importBatch(players);

      expect(result).toStrictEqual({
        ok: false,
        succeeded: 0,
        failed: 3,
        errors: [{ index: 1, message: 'Campo obrigatório ausente: name' }],
      });
      // Nothing is persisted when validation rejects the batch.
      expect(supa.post).not.toHaveBeenCalled();
    });

    it('persists every valid item and reports full success', async () => {
      supa.post.mockResolvedValue({ ok: true, data: undefined });
      const players: PlayerInput[] = [input({ id: 'p1' }), input({ id: 'p2', name: 'Fagner' })];

      const result = await service.importBatch(players);

      expect(result).toStrictEqual({ ok: true, succeeded: 2, failed: 0, errors: [] });
      expect(supa.post).toHaveBeenCalledTimes(2);
      // Upserts use the merge-duplicates Prefer header.
      expect(supa.post).toHaveBeenCalledWith('squad', expect.any(Object), {
        prefer: 'resolution=merge-duplicates',
      });
      // A successful import invalidates the cached squad.
      expect(cache.invalidate).toHaveBeenCalledWith(SQUAD_CACHE_KEY);
    });

    it('reports a partial success when some items fail to persist', async () => {
      supa.post
        .mockResolvedValueOnce({ ok: true, data: undefined })
        .mockResolvedValueOnce({ ok: false, error: 'duplicate key' });
      const players: PlayerInput[] = [input({ id: 'p1' }), input({ id: 'p2', name: 'Fagner' })];

      const result = await service.importBatch(players);

      expect(result).toStrictEqual({
        ok: false,
        succeeded: 1,
        failed: 1,
        errors: [{ index: 1, message: 'duplicate key' }],
      });
      expect(supa.post).toHaveBeenCalledTimes(2);
    });

    it('validates before writing and does not invalidate the cache on rejection', async () => {
      const players: PlayerInput[] = [input({ id: '' })]; // missing id

      const result = await service.importBatch(players);

      expect(result.ok).toBe(false);
      expect(result.errors).toStrictEqual([
        { index: 0, message: 'Campo obrigatório ausente: id' },
      ]);
      // Nothing persisted, so the cache is never invalidated.
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });
});
