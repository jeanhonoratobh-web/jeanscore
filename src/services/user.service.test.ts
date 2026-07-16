/**
 * Unit tests for {@link UserService} (`services/user.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} and {@link Cache} so the
 * service's behaviour can be asserted without touching the network or the UI
 * (Requirement 5.4). They cover the admin user-management contract:
 * - `getUsers` maps hash-free rows into domain {@link User}s (never surfacing
 *   `pass_hash`) and caches the mapped list (Requirement 28.1);
 * - `setStatus` and `setRole` issue a filtered `PATCH` and invalidate the
 *   cached user list on success (Requirement 28.2);
 * - a failing `PATCH` propagates the client {@link Result} untouched and leaves
 *   the cache intact.
 *
 * Requirements: 28.1 (list users with status/role/actions), 28.2 (update
 * status/role and reflect the change immediately).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { Result } from '@/types/supabase';

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

const USERS_CACHE_KEY = 'users';
const USERS_PATH = 'users';

/** A raw (hash-free) `users` row as returned by the service's projection. */
function safeRow(overrides: Partial<{
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}> = {}) {
  return {
    username: 'cassio',
    email: 'cassio@example.com',
    role: 'user',
    status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('UserService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let cache: ReturnType<typeof makeCache>;
  let service: UserService;

  beforeEach(() => {
    supa = makeSupa();
    cache = makeCache();
    service = new UserService(supa, cache);
  });

  describe('getUsers', () => {
    it('returns the cached list without hitting Supabase on a fresh hit', async () => {
      const cached = [
        {
          username: 'cassio',
          email: 'cassio@example.com',
          role: 'user' as const,
          status: 'approved' as const,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      cache.get.mockReturnValue(cached);

      const users = await service.getUsers();

      expect(users).toBe(cached);
      expect(cache.get).toHaveBeenCalledWith(USERS_CACHE_KEY);
      expect(supa.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('fetches and maps rows to domain users on a cache miss, excluding pass_hash', async () => {
      cache.get.mockReturnValue(null);
      const rows = [
        safeRow({ username: 'cassio', role: 'user', status: 'approved' }),
        safeRow({ username: 'admin', email: 'a@x.com', role: 'admin', status: 'pending' }),
      ];
      supa.get.mockResolvedValue({ ok: true, data: rows } satisfies Result<typeof rows>);

      const users = await service.getUsers();

      // Reads exclude pass_hash via the projection select.
      const [path, select] = supa.get.mock.calls[0];
      expect(path).toBe(USERS_PATH);
      expect(select).toContain('select=username,email,role,status,created_at');
      expect(select).not.toContain('pass_hash');

      expect(users).toStrictEqual([
        {
          username: 'cassio',
          email: 'cassio@example.com',
          role: 'user',
          status: 'approved',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          username: 'admin',
          email: 'a@x.com',
          role: 'admin',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);
      // No mapped user carries a pass_hash field.
      for (const user of users) {
        expect(user).not.toHaveProperty('pass_hash');
      }
    });

    it('caches the mapped list after a successful fetch', async () => {
      cache.get.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: true, data: [safeRow()] });

      const users = await service.getUsers();

      expect(cache.set).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith(USERS_CACHE_KEY, users);
    });

    it('maps a null data payload to an empty list', async () => {
      cache.get.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: true, data: null });

      const users = await service.getUsers();

      expect(users).toStrictEqual([]);
      expect(cache.set).toHaveBeenCalledWith(USERS_CACHE_KEY, []);
    });

    it('falls back to the stale cached list when the fetch fails', async () => {
      cache.get.mockReturnValue(null);
      const stale = [
        {
          username: 'cassio',
          email: 'cassio@example.com',
          role: 'user' as const,
          status: 'approved' as const,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      cache.getStale.mockReturnValue(stale);
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const users = await service.getUsers();

      expect(users).toBe(stale);
      expect(cache.getStale).toHaveBeenCalledWith(USERS_CACHE_KEY);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('returns an empty list when the fetch fails and nothing is cached', async () => {
      cache.get.mockReturnValue(null);
      cache.getStale.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: false, error: 'Failed to fetch' });

      const users = await service.getUsers();

      expect(users).toStrictEqual([]);
    });
  });

  describe('setStatus', () => {
    it('issues a filtered PATCH with only the status field and invalidates the cache on success', async () => {
      supa.patch.mockResolvedValue({ ok: true, data: undefined });

      const result = await service.setStatus('cassio', 'approved');

      expect(supa.patch).toHaveBeenCalledTimes(1);
      const [path, body, params] = supa.patch.mock.calls[0];
      expect(path).toBe(USERS_PATH);
      expect(body).toStrictEqual({ status: 'approved' });
      expect(params).toBe('username=eq.cassio');

      expect(cache.invalidate).toHaveBeenCalledWith(USERS_CACHE_KEY);
      expect(result).toStrictEqual({ ok: true, data: undefined });
    });

    it('URL-encodes the username in the filter params', async () => {
      supa.patch.mockResolvedValue({ ok: true, data: undefined });

      await service.setStatus('jean luca', 'rejected');

      const [, , params] = supa.patch.mock.calls[0];
      expect(params).toBe('username=eq.jean%20luca');
    });

    it('propagates the failing Result and does not invalidate the cache', async () => {
      const failure: Result<unknown> = {
        ok: false,
        error: 'permission denied',
        status: 403,
        code: '42501',
      };
      supa.patch.mockResolvedValue(failure);

      const result = await service.setStatus('cassio', 'approved');

      expect(result).toStrictEqual(failure);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('setRole', () => {
    it('issues a filtered PATCH with only the role field and invalidates the cache on success', async () => {
      supa.patch.mockResolvedValue({ ok: true, data: undefined });

      const result = await service.setRole('cassio', 'admin');

      expect(supa.patch).toHaveBeenCalledTimes(1);
      const [path, body, params] = supa.patch.mock.calls[0];
      expect(path).toBe(USERS_PATH);
      expect(body).toStrictEqual({ role: 'admin' });
      expect(params).toBe('username=eq.cassio');

      expect(cache.invalidate).toHaveBeenCalledWith(USERS_CACHE_KEY);
      expect(result).toStrictEqual({ ok: true, data: undefined });
    });

    it('propagates the failing Result and does not invalidate the cache', async () => {
      const failure: Result<unknown> = { ok: false, error: 'network down' };
      supa.patch.mockResolvedValue(failure);

      const result = await service.setRole('cassio', 'user');

      expect(result).toStrictEqual(failure);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });
});
