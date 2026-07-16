/**
 * Authentication service (`services/auth.service.ts`).
 *
 * Defines the substitutable {@link AuthService} interface (Requirement 5.1) and
 * its default implementation {@link LocalAuthService}, which authenticates
 * against the `users` table via the injected {@link SupabaseClient}, hashes
 * passwords with SHA-256 through the Web Crypto API (`crypto.subtle`), and
 * persists the active session in `localStorage` (Requirements 6.4, 6.8, 6.9).
 *
 * The interface deliberately hides the storage mechanism so the app can migrate
 * to Supabase Auth (or any other provider) without changing a single UI
 * component (Requirement 5.1). The reactive {@link AuthService.onChange}
 * subscription lets the header re-render whenever the session changes
 * (Requirement 6.10).
 *
 * Like every Service, {@link LocalAuthService} receives its collaborators via
 * constructor injection so tests can supply a mock client and storage without
 * touching the UI (Requirement 1.5, 5.4).
 */

import type { SupabaseClient } from './supabase-client';
import type { UserRole } from '@/types/domain';
import type { Result, SupabaseUserRow } from '@/types/supabase';

/**
 * The authenticated session carried across the application.
 *
 * Holds only the non-sensitive identity fields needed by the UI and route
 * guards. The password hash is never part of a session (Requirement 6.9).
 */
export interface Session {
  /** Authenticated user's username, shown in the header (Requirement 6.10). */
  username: string;
  /** Authenticated user's email. */
  email: string;
  /** Application role, used by the admin route guard. */
  role: UserRole;
}

/**
 * Handle returned by {@link AuthService.onChange}; call it to stop receiving
 * session-change notifications.
 */
export type Unsubscribe = () => void;

/**
 * Substitutable authentication contract (Requirement 5.1).
 *
 * Every method that can fail returns a typed {@link Result} rather than
 * throwing, so callers branch on `ok` instead of catching exceptions. The
 * concrete mechanism (local SHA-256 + `localStorage`, Supabase Auth, ...) is an
 * implementation detail hidden behind this interface.
 */
export interface AuthService {
  /**
   * Restores a previously persisted session from storage on application
   * bootstrap and notifies subscribers (Requirement 6.8).
   */
  init(): void;

  /**
   * Registers a new account with `status = 'pending'` (Requirement 6.1).
   *
   * Validates the inputs, rejects duplicate usernames/emails, and persists the
   * SHA-256 password hash.
   *
   * @param username Desired username (minimum 3 characters).
   * @param email Valid email address.
   * @param password Plain-text password (minimum 6 characters); only its hash
   *   is stored.
   * @returns A {@link Result} whose `data` is the pt-BR confirmation message on
   *   success, or an error message on failure.
   */
  register(username: string, email: string, password: string): Promise<Result<string>>;

  /**
   * Authenticates a user and, on success, persists and activates the session
   * (Requirement 6.4).
   *
   * @param username Account username.
   * @param password Plain-text password; compared as a SHA-256 hash.
   * @returns A {@link Result} whose `data` is the active {@link Session} on
   *   success, or an error message (invalid credentials, or a blocked
   *   `pending`/`rejected` account) on failure.
   */
  login(username: string, password: string): Promise<Result<Session>>;

  /**
   * Clears the active session from memory and storage, then notifies
   * subscribers (Requirement 6.7).
   */
  logout(): void;

  /** The active session, or `null` when no user is authenticated. */
  readonly currentUser: Session | null;

  /** Whether a user is currently authenticated. */
  isLoggedIn(): boolean;

  /** Whether the authenticated user has the `admin` role. */
  isAdmin(): boolean;

  /**
   * Subscribes to session changes to keep the UI reactive (Requirement 6.10).
   *
   * @param listener Invoked with the new session (or `null` on logout) whenever
   *   the session changes.
   * @returns An {@link Unsubscribe} that removes the listener.
   */
  onChange(listener: (s: Session | null) => void): Unsubscribe;
}

/**
 * Minimal storage surface required by {@link LocalAuthService}.
 *
 * Structurally satisfied by the browser `localStorage` object; declared
 * narrowly so tests can inject an in-memory double without a DOM.
 */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `localStorage` key under which the active session is persisted. */
const SESSION_KEY = 'js_session';

/** Minimum accepted username length (Requirement 6.1). */
const MIN_USERNAME_LENGTH = 3;

/** Minimum accepted password length (Requirement 6.1). */
const MIN_PASSWORD_LENGTH = 6;

/** Pragmatic email shape check used during registration (Requirement 6.1). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PostgREST endpoint (relative to `/rest/v1/`) for the `users` table. */
const USERS_PATH = 'users';

/** pt-BR confirmation shown after a successful registration (Requirement 6.1). */
const REGISTER_CONFIRMATION = 'Cadastro solicitado! Aguarde aprovação do admin.';

/**
 * Local authentication implementation backed by SHA-256 + `localStorage`
 * (Requirements 6.4, 6.8, 6.9).
 *
 * Passwords are hashed with the Web Crypto API and compared against the
 * `pass_hash` column; sessions survive reloads via `localStorage`. Because it
 * implements {@link AuthService}, it can be swapped for a Supabase Auth backend
 * without changing any consumer (Requirement 5.1).
 */
export class LocalAuthService implements AuthService {
  /** Active session, or `null` when signed out. */
  private session: Session | null = null;

  /** Registered session-change listeners (Requirement 6.10). */
  private readonly listeners = new Set<(s: Session | null) => void>();

  /**
   * @param supa Typed Supabase REST client used to read/write the `users` table.
   * @param storage Session store; defaults to the browser `localStorage`.
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly storage: SessionStorageLike = globalThis.localStorage,
  ) {}

  /** {@inheritDoc AuthService.currentUser} */
  get currentUser(): Session | null {
    return this.session;
  }

  /** {@inheritDoc AuthService.init} */
  init(): void {
    const saved = this.storage.getItem(SESSION_KEY);
    if (saved) {
      try {
        this.session = JSON.parse(saved) as Session;
      } catch {
        // Corrupt payload: treat as signed out and clear it.
        this.session = null;
        this.storage.removeItem(SESSION_KEY);
      }
    }
    this.emit();
  }

  /** {@inheritDoc AuthService.register} */
  async register(username: string, email: string, password: string): Promise<Result<string>> {
    if (username.length < MIN_USERNAME_LENGTH) {
      return { ok: false, error: 'Nome de usuário muito curto (mín. 3 caracteres)' };
    }
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: 'E-mail inválido' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { ok: false, error: 'Senha muito curta (mín. 6 caracteres)' };
    }

    // Reject duplicates up front so the DB unique constraint is never the first
    // signal (Requirements 6.2, 6.3).
    const duplicate = await this.findDuplicate(username, email);
    if (!duplicate.ok) {
      return duplicate;
    }
    if (duplicate.data !== null) {
      return { ok: false, error: duplicate.data };
    }

    const passHash = await this.hash(password);
    const result = await this.supa.post<unknown>(USERS_PATH, {
      username,
      email,
      pass_hash: passHash,
      role: 'user',
      status: 'pending',
    });
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: REGISTER_CONFIRMATION };
  }

  /** {@inheritDoc AuthService.login} */
  async login(username: string, password: string): Promise<Result<Session>> {
    const passHash = await this.hash(password);
    const params =
      `select=username,email,role,status` +
      `&username=eq.${encodeURIComponent(username)}` +
      `&pass_hash=eq.${encodeURIComponent(passHash)}` +
      `&limit=1`;

    const result = await this.supa.get<LoginRow[]>(USERS_PATH, params);
    if (!result.ok) {
      return result;
    }

    const row = result.data?.[0];
    if (!row) {
      return { ok: false, error: 'Usuário ou senha incorretos' };
    }
    if (row.status === 'pending') {
      return { ok: false, error: 'Cadastro ainda não aprovado' };
    }
    if (row.status === 'rejected') {
      return { ok: false, error: 'Cadastro recusado' };
    }

    const session: Session = {
      username: row.username,
      email: row.email,
      role: row.role as UserRole,
    };
    this.setSession(session);
    return { ok: true, data: session };
  }

  /** {@inheritDoc AuthService.logout} */
  logout(): void {
    this.setSession(null);
  }

  /** {@inheritDoc AuthService.isLoggedIn} */
  isLoggedIn(): boolean {
    return this.session !== null;
  }

  /** {@inheritDoc AuthService.isAdmin} */
  isAdmin(): boolean {
    return this.session?.role === 'admin';
  }

  /** {@inheritDoc AuthService.onChange} */
  onChange(listener: (s: Session | null) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Checks whether the username or email already exists (Requirements 6.2, 6.3).
   *
   * @returns A {@link Result} whose `data` is the pt-BR error message for the
   *   conflicting field, or `null` when no duplicate exists. A failed lookup
   *   propagates the client error.
   */
  private async findDuplicate(
    username: string,
    email: string,
  ): Promise<Result<string | null>> {
    const params =
      `select=username,email` +
      `&or=(username.eq.${encodeURIComponent(username)},email.eq.${encodeURIComponent(email)})`;

    const result = await this.supa.get<Array<Pick<SupabaseUserRow, 'username' | 'email'>>>(
      USERS_PATH,
      params,
    );
    if (!result.ok) {
      return result;
    }

    const rows = result.data ?? [];
    if (rows.some((r) => r.username === username)) {
      return { ok: true, data: 'Nome de usuário já existe' };
    }
    if (rows.some((r) => r.email === email)) {
      return { ok: true, data: 'E-mail já cadastrado' };
    }
    return { ok: true, data: null };
  }

  /**
   * Updates the active session, persists (or clears) it in storage, and
   * notifies subscribers (Requirements 6.4, 6.7, 6.10).
   */
  private setSession(session: Session | null): void {
    this.session = session;
    if (session) {
      this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      this.storage.removeItem(SESSION_KEY);
    }
    this.emit();
  }

  /** Notifies every subscriber of the current session (Requirement 6.10). */
  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.session);
    }
  }

  /**
   * Computes the lowercase hex SHA-256 digest of a string via the Web Crypto
   * API (Requirement 6.9).
   */
  private async hash(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/** Column projection returned by the {@link LocalAuthService.login} query. */
type LoginRow = Pick<SupabaseUserRow, 'username' | 'email' | 'role' | 'status'>;
