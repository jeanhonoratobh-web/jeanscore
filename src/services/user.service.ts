/**
 * User administration service (`services/user.service.ts`).
 *
 * Backs the admin user-management panel (Requirement 28): it lists every
 * account and mutates a user's approval `status` and application `role`. Like
 * every Service, it receives its collaborators — a {@link SupabaseClient} and a
 * {@link Cache} — via constructor injection so tests can supply mocks without
 * touching the UI (Requirement 1.5, 5.4).
 *
 * Reads follow the shared cache + stale-fallback contract: {@link getUsers}
 * serves a fresh cached list when available, fetches from Supabase on a miss,
 * and falls back to the most recent value on a network failure (Requirement
 * 1.8). Writes ({@link setStatus}, {@link setRole}) issue a filtered `PATCH`
 * and invalidate the cached list so the next read reflects the change
 * (Requirement 28.2).
 */

import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { User, UserRole, UserStatus } from '@/types/domain';
import type { Result, SupabaseUserRow } from '@/types/supabase';

/** Cache key under which the full user list is stored. */
const USERS_CACHE_KEY = 'users';

/**
 * PostgREST endpoint (relative to `/rest/v1/`) for the `users` table.
 * The password hash column is intentionally excluded from selections so it is
 * never carried into the domain layer or the UI (Requirement 6.9).
 */
const USERS_PATH = 'users';

/**
 * Column projection for user reads. Deliberately omits `pass_hash` so the
 * sensitive hash never leaves the database boundary.
 */
const USERS_SELECT = 'select=username,email,role,status,created_at&order=created_at.asc';

/**
 * Row shape returned by {@link getUsers}' projection: a {@link SupabaseUserRow}
 * without the excluded `pass_hash` column.
 */
type SafeUserRow = Omit<SupabaseUserRow, 'pass_hash'>;

/**
 * Data-access service for administering user accounts (Requirement 28).
 *
 * Instantiated once (with its injected dependencies) by the services provider
 * and consumed through the admin UI.
 */
export class UserService {
  /**
   * @param supa Typed Supabase REST client used for every request.
   * @param cache Shared cache providing TTL storage and stale fallback.
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
  ) {}

  /**
   * Lists every user account for the admin management panel (Requirement 28.1).
   *
   * Resolution order:
   * 1. Return the cached list when it is still within its TTL.
   * 2. Otherwise fetch from Supabase and cache the mapped result.
   * 3. On a network/non-2xx failure, return the most recent cached list
   *    regardless of TTL (stale fallback, Requirement 1.8); when nothing is
   *    cached, resolve to an empty array so the UI can render an empty state.
   *
   * The password hash is never selected, so returned {@link User} values carry
   * only the fields safe to display (username, email, role, status, created
   * date).
   *
   * @returns The list of users, ordered by registration date ascending.
   */
  async getUsers(): Promise<User[]> {
    const cached = this.cache.get<User[]>(USERS_CACHE_KEY);
    if (cached !== null) {
      return cached;
    }

    const result = await this.supa.get<SafeUserRow[]>(USERS_PATH, USERS_SELECT);
    if (result.ok) {
      const users = (result.data ?? []).map(toUser);
      this.cache.set(USERS_CACHE_KEY, users);
      return users;
    }

    // Network/non-2xx failure: serve the last known list if we have one.
    return this.cache.getStale<User[]>(USERS_CACHE_KEY) ?? [];
  }

  /**
   * Updates a user's approval `status` (Requirement 28.2).
   *
   * Used by the admin panel to approve or reject a pending registration. On
   * success the cached user list is invalidated so the next {@link getUsers}
   * reflects the new status immediately.
   *
   * @param username Username of the account to update.
   * @param status New approval status (`pending`, `approved` or `rejected`).
   * @returns A {@link Result} that is `ok` on success, or carries the error
   *   message, HTTP status and SQLSTATE code on failure.
   */
  async setStatus(username: string, status: UserStatus): Promise<Result<void>> {
    return this.patchUser(username, { status });
  }

  /**
   * Updates a user's application `role` (Requirement 28.1, 28.11).
   *
   * Promotes a user to `admin` or demotes them back to `user`. On success the
   * cached user list is invalidated so the next {@link getUsers} reflects the
   * new role immediately.
   *
   * Note: preventing an admin from demoting their own account (Requirement
   * 28.11) is enforced at the admin UI layer, which knows the currently
   * authenticated user; this method performs the persistence only.
   *
   * @param username Username of the account to update.
   * @param role New application role (`user` or `admin`).
   * @returns A {@link Result} that is `ok` on success, or carries the error
   *   message, HTTP status and SQLSTATE code on failure.
   */
  async setRole(username: string, role: UserRole): Promise<Result<void>> {
    return this.patchUser(username, { role });
  }

  /**
   * Issues a filtered `PATCH` against the `users` table for a single account
   * and invalidates the cached list on success.
   *
   * @param username Username used to filter the row to update.
   * @param fields Partial row columns to write (`status` and/or `role`).
   * @returns The client {@link Result}; the cache is only invalidated when it
   *   is `ok`.
   */
  private async patchUser(
    username: string,
    fields: Partial<Pick<SupabaseUserRow, 'status' | 'role'>>,
  ): Promise<Result<void>> {
    const params = `username=eq.${encodeURIComponent(username)}`;
    const result = await this.supa.patch<unknown>(USERS_PATH, fields, params);
    if (result.ok) {
      this.cache.invalidate(USERS_CACHE_KEY);
      return { ok: true, data: undefined };
    }
    return result;
  }
}

/**
 * Maps a raw (hash-free) `users` row into a domain {@link User}.
 *
 * A pure, total conversion: the snake_cased `created_at` column becomes
 * `createdAt`, and the free-form `role`/`status` strings are narrowed to their
 * respective unions ({@link UserRole}, {@link UserStatus}). The `pass_hash`
 * column is never part of the input projection and therefore never surfaces on
 * the domain entity (Requirement 6.9). The optional `premium` extension field
 * has no column and is left unset.
 *
 * @param row A `users` row without the `pass_hash` column.
 * @returns The corresponding domain {@link User}.
 */
function toUser(row: SafeUserRow): User {
  return {
    username: row.username,
    email: row.email,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    createdAt: row.created_at,
  };
}
