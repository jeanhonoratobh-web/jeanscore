/**
 * Unit tests for {@link FixtureService} (`services/fixture.service.ts`).
 *
 * The Service is exercised through mocked collaborators — a {@link SupabaseClient}
 * and a {@link Cache} — injected via the constructor (Requirement 1.5), so no
 * network or real storage is touched. The tests focus on the three admin
 * behaviours covered by task 8.4:
 *
 * - `importBatch` validates the batch up front and rejects the whole batch when
 *   any required field is missing, persisting nothing (Requirement 28.6);
 * - `saveLineup` fully replaces the previous lineup, deleting existing rows
 *   *before* inserting the new ones (Requirement 28.7);
 * - `setLiberado` toggles the `liberado` flag and invalidates the fixtures cache
 *   so the next read reflects the change (Requirement 28.8).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixtureService } from './fixture.service';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { FixtureInput } from '@/types/service';

/** A mocked {@link SupabaseClient} whose four verbs are all `vi.fn()` spies. */
type MockClient = {
  [K in keyof SupabaseClient]: ReturnType<typeof vi.fn>;
};

/** A mocked {@link Cache} whose methods are all `vi.fn()` spies. */
type MockCache = {
  [K in keyof Cache]: ReturnType<typeof vi.fn>;
};

/** Builds a fresh mock Supabase client with all verbs stubbed. */
function makeClient(): MockClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

/** Builds a fresh mock cache; reads miss by default so Services hit the client. */
function makeCache(): MockCache {
  return {
    get: vi.fn().mockReturnValue(null),
    getStale: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    invalidate: vi.fn(),
    sweep: vi.fn(),
  };
}

/** A fully-valid fixture input; override individual fields per test. */
function validInput(overrides: Partial<FixtureInput> = {}): FixtureInput {
  return {
    homeTeam: 'Cruzeiro',
    awayTeam: 'Atlético',
    fixtureDate: '2024-05-01',
    competition: 71,
    ...overrides,
  };
}

describe('FixtureService', () => {
  let supa: MockClient;
  let cache: MockCache;
  let service: FixtureService;

  beforeEach(() => {
    supa = makeClient();
    cache = makeCache();
    service = new FixtureService(
      supa as unknown as SupabaseClient,
      cache as unknown as Cache,
    );
  });

  // -------------------------------------------------------------------------
  // importBatch — batch validation (Requirement 28.6)
  // -------------------------------------------------------------------------
  describe('importBatch (Requirement 28.6)', () => {
    it('rejects the whole batch when any item is missing a required field and persists nothing', async () => {
      const fixtures: FixtureInput[] = [
        validInput(),
        validInput({ homeTeam: '' }), // missing home_team
        validInput(),
      ];

      const result = await service.importBatch(fixtures);

      expect(result.ok).toBe(false);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.errors).toStrictEqual([
        { index: 1, message: 'Campo obrigatório ausente: home_team' },
      ]);
      // Whole-batch rejection: nothing is written and the cache is untouched.
      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('reports every invalid required field (away_team, fixture_date, competition)', async () => {
      const fixtures: FixtureInput[] = [
        validInput({ awayTeam: '   ' }),
        validInput({ fixtureDate: '' }),
        validInput({ competition: Number.NaN }),
      ];

      const result = await service.importBatch(fixtures);

      expect(result.ok).toBe(false);
      expect(result.succeeded).toBe(0);
      expect(result.errors).toStrictEqual([
        { index: 0, message: 'Campo obrigatório ausente: away_team' },
        { index: 1, message: 'Campo obrigatório ausente: fixture_date' },
        { index: 2, message: 'Campo obrigatório ausente: competition' },
      ]);
      expect(supa.post).not.toHaveBeenCalled();
    });

    it('persists each item as a merge-duplicates upsert and invalidates the cache when validation passes', async () => {
      supa.post.mockResolvedValue({ ok: true, data: [] });
      const fixtures = [validInput({ id: 'f1' }), validInput({ id: 'f2' })];

      const result = await service.importBatch(fixtures);

      expect(result).toStrictEqual({ ok: true, succeeded: 2, failed: 0, errors: [] });
      expect(supa.post).toHaveBeenCalledTimes(2);
      // Every persist call is an upsert on the fixtures table.
      for (const call of supa.post.mock.calls) {
        expect(call[0]).toBe('fixtures');
        expect(call[2]).toStrictEqual({ prefer: 'resolution=merge-duplicates' });
      }
      expect(cache.invalidate).toHaveBeenCalledWith('fixtures');
    });

    it('reports partial success and still invalidates the cache when at least one item persists', async () => {
      supa.post
        .mockResolvedValueOnce({ ok: true, data: [] })
        .mockResolvedValueOnce({ ok: false, error: 'conflict', status: 409 });
      const fixtures = [validInput({ id: 'f1' }), validInput({ id: 'f2' })];

      const result = await service.importBatch(fixtures);

      expect(result.ok).toBe(false);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toStrictEqual([{ index: 1, message: 'conflict' }]);
      expect(cache.invalidate).toHaveBeenCalledWith('fixtures');
    });

    it('does not invalidate the cache when every item fails to persist', async () => {
      supa.post.mockResolvedValue({ ok: false, error: 'boom' });
      const fixtures = [validInput({ id: 'f1' })];

      const result = await service.importBatch(fixtures);

      expect(result.succeeded).toBe(0);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // saveLineup — replace previous lineup (Requirement 28.7)
  // -------------------------------------------------------------------------
  describe('saveLineup (Requirement 28.7)', () => {
    it('deletes the previous lineup BEFORE inserting the new one', async () => {
      supa.delete.mockResolvedValue({ ok: true, data: undefined });
      supa.post.mockResolvedValue({ ok: true, data: [] });

      const result = await service.saveLineup('f1', ['p1', 'p2']);

      expect(result).toStrictEqual({ ok: true, data: undefined });
      expect(supa.delete).toHaveBeenCalledWith('escalacoes', 'fixture_id=eq.f1');
      expect(supa.post).toHaveBeenCalledWith('escalacoes', [
        { fixture_id: 'f1', player_id: 'p1' },
        { fixture_id: 'f1', player_id: 'p2' },
      ]);
      // Replace semantics: the delete must be issued before the insert.
      const deleteOrder = supa.delete.mock.invocationCallOrder[0];
      const postOrder = supa.post.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(postOrder);
      // Cache is invalidated so the next read reflects the replacement.
      expect(cache.invalidate).toHaveBeenCalledWith('lineup:f1');
    });

    it('removes duplicate player ids before inserting', async () => {
      supa.delete.mockResolvedValue({ ok: true, data: undefined });
      supa.post.mockResolvedValue({ ok: true, data: [] });

      await service.saveLineup('f1', ['p1', 'p1', 'p2']);

      expect(supa.post).toHaveBeenCalledWith('escalacoes', [
        { fixture_id: 'f1', player_id: 'p1' },
        { fixture_id: 'f1', player_id: 'p2' },
      ]);
    });

    it('clears the lineup (delete only, no insert) when given an empty list', async () => {
      supa.delete.mockResolvedValue({ ok: true, data: undefined });

      const result = await service.saveLineup('f1', []);

      expect(result).toStrictEqual({ ok: true, data: undefined });
      expect(supa.delete).toHaveBeenCalledWith('escalacoes', 'fixture_id=eq.f1');
      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.invalidate).toHaveBeenCalledWith('lineup:f1');
    });

    it('propagates the delete failure and skips the insert', async () => {
      supa.delete.mockResolvedValue({ ok: false, error: 'delete failed', status: 500 });

      const result = await service.saveLineup('f1', ['p1']);

      expect(result).toStrictEqual({ ok: false, error: 'delete failed', status: 500 });
      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('propagates the insert failure without invalidating the cache', async () => {
      supa.delete.mockResolvedValue({ ok: true, data: undefined });
      supa.post.mockResolvedValue({ ok: false, error: 'insert failed', status: 500 });

      const result = await service.saveLineup('f1', ['p1']);

      expect(result).toStrictEqual({ ok: false, error: 'insert failed', status: 500 });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // setLiberado — toggle flag + invalidate cache (Requirement 28.8)
  // -------------------------------------------------------------------------
  describe('setLiberado (Requirement 28.8)', () => {
    it('patches the fixture with the new flag and invalidates the fixtures cache', async () => {
      supa.patch.mockResolvedValue({ ok: true, data: [] });

      const result = await service.setLiberado('f1', true);

      expect(result).toStrictEqual({ ok: true, data: undefined });
      expect(supa.patch).toHaveBeenCalledWith(
        'fixtures',
        { liberado: true },
        'id=eq.f1',
      );
      expect(cache.invalidate).toHaveBeenCalledWith('fixtures');
    });

    it('toggles the flag off as well', async () => {
      supa.patch.mockResolvedValue({ ok: true, data: [] });

      await service.setLiberado('f1', false);

      expect(supa.patch).toHaveBeenCalledWith(
        'fixtures',
        { liberado: false },
        'id=eq.f1',
      );
    });

    it('propagates the error and does not invalidate the cache on failure', async () => {
      supa.patch.mockResolvedValue({ ok: false, error: 'patch failed', status: 500 });

      const result = await service.setLiberado('f1', true);

      expect(result).toStrictEqual({ ok: false, error: 'patch failed', status: 500 });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });
});
