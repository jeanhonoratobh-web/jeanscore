/**
 * Auth context (`context/AuthContext.tsx`).
 *
 * Wraps the injected {@link AuthService} in a React context so the whole
 * component tree observes a single, reactive authentication state. It exposes
 * the current {@link Session}, the derived `isLoggedIn` / `isAdmin` flags, and
 * the `login` / `logout` / `register` actions.
 *
 * The provider subscribes to {@link AuthService.onChange} so that any session
 * mutation (login, logout, or a restore during bootstrap) re-renders every
 * consumer — this is what keeps the header showing the authenticated user's
 * name reactive (Requirement 6.10). On mount it calls {@link AuthService.init}
 * to restore a previously persisted session (Requirement 6.8).
 *
 * This context is the single source of truth consumed by the route guards
 * (`requireAuth`, `requireAdmin`, ...): a {@link Guard} receives an
 * {@link AuthContextValue} and decides access from its `isLoggedIn` / `isAdmin`
 * flags, so guards never touch the Service directly.
 *
 * The concrete {@link AuthService} is obtained from {@link useServices}, so
 * tests can inject a mock auth backend through the {@link ServicesProvider}
 * without changing this context or any consumer (Requirement 5.4).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useServices } from './ServicesContext';
import type { Session } from '@/services';
import type { Result } from '@/types/supabase';

/**
 * Public shape of the auth context consumed via {@link useAuth}.
 *
 * Also the argument type of every route {@link Guard}: guards read `isLoggedIn`
 * / `isAdmin` to allow or redirect, making this value the source of truth for
 * access control.
 */
export interface AuthContextValue {
  /** The active session, or `null` when no user is authenticated. */
  readonly session: Session | null;
  /**
   * Whether a user is currently authenticated. Derived from {@link session};
   * kept as a boolean so guards and the header can read it directly.
   */
  readonly isLoggedIn: boolean;
  /** Whether the authenticated user has the `admin` role (drives `requireAdmin`). */
  readonly isAdmin: boolean;
  /**
   * Authenticates a user; on success the session is persisted by the Service
   * and this context updates reactively via {@link AuthService.onChange}.
   *
   * @param username - Account username.
   * @param password - Plain-text password (compared as a SHA-256 hash).
   * @returns A {@link Result} whose `data` is the active {@link Session} on
   *   success, or a pt-BR error message on failure.
   */
  login(username: string, password: string): Promise<Result<Session>>;
  /**
   * Clears the active session; consumers update reactively via
   * {@link AuthService.onChange} (Requirement 6.7).
   */
  logout(): void;
  /**
   * Registers a new account with `status = 'pending'` (Requirement 6.1).
   *
   * @param username - Desired username (minimum 3 characters).
   * @param email - Valid email address.
   * @param password - Plain-text password (minimum 6 characters); only its hash
   *   is stored.
   * @returns A {@link Result} whose `data` is the pt-BR confirmation message on
   *   success, or an error message on failure.
   */
  register(username: string, email: string, password: string): Promise<Result<string>>;
}

/**
 * Context holding the reactive {@link AuthContextValue}.
 *
 * Defaults to `null` so {@link useAuth} can detect (and reject) usage outside a
 * {@link AuthProvider}.
 */
const AuthContext = createContext<AuthContextValue | null>(null);

/** Props for {@link AuthProvider}. */
export interface AuthProviderProps {
  /** Application subtree that gains access to the auth state and actions. */
  readonly children: ReactNode;
}

/**
 * Provides the reactive authentication state to its subtree.
 *
 * Subscribes to the injected {@link AuthService} before restoring the persisted
 * session, so the initial `init()` emission is captured and the tree renders
 * the authenticated state on the first paint after bootstrap (Requirements 6.8,
 * 6.10).
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const { auth } = useServices();
  // Seed from the current session in case init() already ran during bootstrap.
  const [session, setSession] = useState<Session | null>(() => auth.currentUser);

  useEffect(() => {
    // Subscribe first, then restore: the synchronous emit from init() flows
    // into setSession, keeping the header reactive (Requirements 6.8, 6.10).
    const unsubscribe = auth.onChange(setSession);
    auth.init();
    return unsubscribe;
  }, [auth]);

  const login = useCallback(
    (username: string, password: string): Promise<Result<Session>> =>
      auth.login(username, password),
    [auth],
  );

  const logout = useCallback((): void => {
    auth.logout();
  }, [auth]);

  const register = useCallback(
    (username: string, email: string, password: string): Promise<Result<string>> =>
      auth.register(username, email, password),
    [auth],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoggedIn: session !== null,
      isAdmin: session?.role === 'admin',
      login,
      logout,
      register,
    }),
    [session, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the reactive authentication state from within an {@link AuthProvider}.
 *
 * @throws {Error} If called outside an {@link AuthProvider}, since there would
 *   be no session state to read — this surfaces the wiring mistake immediately
 *   instead of failing silently.
 * @returns The {@link AuthContextValue} for the nearest provider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
