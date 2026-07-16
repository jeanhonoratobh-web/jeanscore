/**
 * Unit tests for AuthContext / AuthProvider / useAuth (Requirements 6.7, 6.8,
 * 6.10).
 *
 * A tiny in-memory {@link AuthService} double drives the tests through the
 * {@link ServicesProvider}, so no real Supabase client or DOM storage is
 * touched (Requirement 5.4).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ServicesProvider, type Services } from './ServicesContext';
import type { AuthService, Session, Unsubscribe } from '@/services';
import type { Result } from '@/types/supabase';

/**
 * Minimal, in-memory {@link AuthService} that emits on every session change,
 * mirroring the reactive contract used by the real `LocalAuthService`.
 */
class FakeAuthService implements AuthService {
  private session: Session | null;
  private readonly listeners = new Set<(s: Session | null) => void>();
  /** Session restored by {@link init}, simulating a persisted session. */
  constructor(private readonly restored: Session | null = null) {
    this.session = null;
  }

  get currentUser(): Session | null {
    return this.session;
  }

  init(): void {
    this.set(this.restored);
  }

  async register(): Promise<Result<string>> {
    return { ok: true, data: 'Cadastro solicitado! Aguarde aprovação do admin.' };
  }

  async login(username: string): Promise<Result<Session>> {
    const session: Session = { username, email: `${username}@x.com`, role: 'user' };
    this.set(session);
    return { ok: true, data: session };
  }

  logout(): void {
    this.set(null);
  }

  isLoggedIn(): boolean {
    return this.session !== null;
  }

  isAdmin(): boolean {
    return this.session?.role === 'admin';
  }

  onChange(listener: (s: Session | null) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test helper: sets the session and notifies subscribers. */
  set(session: Session | null): void {
    this.session = session;
    for (const l of this.listeners) l(session);
  }
}

function makeServices(auth: AuthService): Services {
  // Only `auth` is exercised by these tests; the rest are never touched.
  return { auth } as unknown as Services;
}

function makeWrapper(auth: AuthService) {
  return function wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <ServicesProvider services={makeServices(auth)}>
        <AuthProvider>{children}</AuthProvider>
      </ServicesProvider>
    );
  };
}

describe('useAuth', () => {
  it('throws a descriptive error when used outside an AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      /useAuth must be used within an AuthProvider/,
    );
    spy.mockRestore();
  });
});

describe('AuthProvider', () => {
  it('restores the persisted session on mount via init() (Requirement 6.8)', () => {
    const restored: Session = { username: 'ana', email: 'ana@x.com', role: 'user' };
    const auth = new FakeAuthService(restored);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(auth) });

    expect(result.current.session).toEqual(restored);
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('starts signed out when no session is persisted', () => {
    const auth = new FakeAuthService(null);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(auth) });

    expect(result.current.session).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('updates reactively on login and exposes it to guards (Requirement 6.10)', async () => {
    const auth = new FakeAuthService(null);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(auth) });

    await act(async () => {
      await result.current.login('bia', 'secret');
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.session?.username).toBe('bia');
  });

  it('flags admin sessions for the requireAdmin guard', () => {
    const admin: Session = { username: 'root', email: 'root@x.com', role: 'admin' };
    const auth = new FakeAuthService(admin);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(auth) });

    expect(result.current.isAdmin).toBe(true);
  });

  it('clears the session reactively on logout (Requirement 6.7)', () => {
    const restored: Session = { username: 'ana', email: 'ana@x.com', role: 'user' };
    const auth = new FakeAuthService(restored);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(auth) });

    expect(result.current.isLoggedIn).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
  });
});
