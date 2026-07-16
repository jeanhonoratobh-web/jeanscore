/**
 * Unit tests for {@link LocalAuthService} (`services/auth.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient} and an in-memory
 * {@link SessionStorageLike} double so the service's behaviour can be asserted
 * without touching the network or a real DOM (Requirement 5.4). They cover the
 * authentication contract:
 * - `register` rejects a duplicate username (Requirement 6.2) and a duplicate
 *   email (Requirement 6.3);
 * - `login` blocks `pending` (Requirement 6.5) and `rejected` (Requirement 6.6)
 *   accounts;
 * - a successful `login` persists the session to storage and `init()` restores
 *   it on a fresh instance (session round-trip, Requirement 6.8);
 * - `onChange` subscribers are notified on login and logout (Requirement 6.10).
 *
 * Requirements: 6.2, 6.3, 6.5, 6.6, 6.8.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalAuthService } from './auth.service';
import type { Session, SessionStorageLike } from './auth.service';
import type { SupabaseClient } from './supabase-client';

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

/** An in-memory {@link SessionStorageLike} double backed by a `Map`. */
function makeStorage(): SessionStorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

/** A `users` row as projected by the login query. */
function loginRow(
  overrides: Partial<{ username: string; email: string; role: string; status: string }> = {},
) {
  return {
    username: 'cassio',
    email: 'cassio@example.com',
    role: 'user',
    status: 'approved',
    ...overrides,
  };
}

const SESSION_KEY = 'js_session';

describe('LocalAuthService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let storage: ReturnType<typeof makeStorage>;
  let service: LocalAuthService;

  beforeEach(() => {
    supa = makeSupa();
    storage = makeStorage();
    service = new LocalAuthService(supa, storage);
  });

  describe('register', () => {
    it('rejects a duplicate username without inserting (Requirement 6.2)', async () => {
      // Duplicate-check query finds a row matching the username.
      supa.get.mockResolvedValue({
        ok: true,
        data: [{ username: 'cassio', email: 'other@example.com' }],
      });

      const result = await service.register('cassio', 'new@example.com', 'secret123');

      expect(result).toStrictEqual({ ok: false, error: 'Nome de usuário já existe' });
      expect(supa.post).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email without inserting (Requirement 6.3)', async () => {
      // Duplicate-check query finds a row matching the email only.
      supa.get.mockResolvedValue({
        ok: true,
        data: [{ username: 'someoneelse', email: 'taken@example.com' }],
      });

      const result = await service.register('brandnew', 'taken@example.com', 'secret123');

      expect(result).toStrictEqual({ ok: false, error: 'E-mail já cadastrado' });
      expect(supa.post).not.toHaveBeenCalled();
    });

    it('inserts a pending account when neither username nor email exist', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [] });
      supa.post.mockResolvedValue({ ok: true, data: undefined });

      const result = await service.register('brandnew', 'fresh@example.com', 'secret123');

      expect(result.ok).toBe(true);
      expect(supa.post).toHaveBeenCalledTimes(1);
      const [path, body] = supa.post.mock.calls[0];
      expect(path).toBe('users');
      expect(body).toMatchObject({
        username: 'brandnew',
        email: 'fresh@example.com',
        role: 'user',
        status: 'pending',
      });
      // The stored value is a hash, never the plain-text password (Req 6.9).
      expect(body.pass_hash).toEqual(expect.any(String));
      expect(body.pass_hash).not.toBe('secret123');
    });
  });

  describe('login', () => {
    it('blocks a pending account (Requirement 6.5)', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [loginRow({ status: 'pending' })] });

      const result = await service.login('cassio', 'secret123');

      expect(result).toStrictEqual({ ok: false, error: 'Cadastro ainda não aprovado' });
      expect(service.isLoggedIn()).toBe(false);
      expect(storage.getItem(SESSION_KEY)).toBeNull();
    });

    it('blocks a rejected account (Requirement 6.6)', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [loginRow({ status: 'rejected' })] });

      const result = await service.login('cassio', 'secret123');

      expect(result).toStrictEqual({ ok: false, error: 'Cadastro recusado' });
      expect(service.isLoggedIn()).toBe(false);
      expect(storage.getItem(SESSION_KEY)).toBeNull();
    });

    it('returns an invalid-credentials error when no row matches', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [] });

      const result = await service.login('cassio', 'wrongpass');

      expect(result).toStrictEqual({ ok: false, error: 'Usuário ou senha incorretos' });
      expect(service.isLoggedIn()).toBe(false);
    });
  });

  describe('session round-trip (Requirement 6.8)', () => {
    it('persists the session on a successful login and restores it via init() on a new instance', async () => {
      supa.get.mockResolvedValue({
        ok: true,
        data: [loginRow({ username: 'cassio', email: 'cassio@example.com', role: 'admin', status: 'approved' })],
      });

      const login = await service.login('cassio', 'secret123');

      expect(login.ok).toBe(true);
      const expected: Session = { username: 'cassio', email: 'cassio@example.com', role: 'admin' };
      expect(service.currentUser).toStrictEqual(expected);

      // The session was written to storage.
      const persisted = storage.getItem(SESSION_KEY);
      expect(persisted).not.toBeNull();
      expect(JSON.parse(persisted as string)).toStrictEqual(expected);

      // A fresh instance sharing the same storage restores the session on init.
      const restored = new LocalAuthService(makeSupa(), storage);
      expect(restored.currentUser).toBeNull();
      restored.init();
      expect(restored.currentUser).toStrictEqual(expected);
      expect(restored.isLoggedIn()).toBe(true);
      expect(restored.isAdmin()).toBe(true);
    });

    it('clears the persisted session on logout', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [loginRow({ status: 'approved' })] });
      await service.login('cassio', 'secret123');
      expect(storage.getItem(SESSION_KEY)).not.toBeNull();

      service.logout();

      expect(service.isLoggedIn()).toBe(false);
      expect(storage.getItem(SESSION_KEY)).toBeNull();
    });

    it('treats a corrupt persisted payload as signed out and clears it', () => {
      storage.setItem(SESSION_KEY, '{not valid json');

      service.init();

      expect(service.currentUser).toBeNull();
      expect(storage.getItem(SESSION_KEY)).toBeNull();
    });
  });

  describe('onChange', () => {
    it('notifies subscribers on login and logout', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [loginRow({ status: 'approved' })] });
      const listener = vi.fn();
      service.onChange(listener);

      await service.login('cassio', 'secret123');
      expect(listener).toHaveBeenLastCalledWith(
        expect.objectContaining({ username: 'cassio' }),
      );

      service.logout();
      expect(listener).toHaveBeenLastCalledWith(null);
    });

    it('stops notifying after unsubscribe', async () => {
      supa.get.mockResolvedValue({ ok: true, data: [loginRow({ status: 'approved' })] });
      const listener = vi.fn();
      const unsubscribe = service.onChange(listener);

      unsubscribe();
      await service.login('cassio', 'secret123');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
