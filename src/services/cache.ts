/**
 * In-memory cache with a configurable TTL (`services/cache.ts`).
 *
 * The Cache prevents duplicate Supabase requests by holding recently fetched
 * data in memory for a configurable time-to-live (TTL). It also backs the
 * "stale fallback" behaviour: when a network request fails, Services can read
 * the most recent value regardless of expiry via {@link Cache.getStale}.
 *
 * Requirements:
 * - 1.7: configurable TTL per resource type, invalidation by key and automatic
 *   removal of expired entries (`sweep`).
 * - 1.8: `getStale` ignores the TTL so Services can serve the last known value
 *   when a request fails (stale fallback).
 */

/**
 * A single cached value together with the metadata needed to decide whether it
 * is still fresh.
 *
 * - `data`: the cached payload.
 * - `ts`: the epoch milliseconds timestamp when the entry was stored.
 * - `ttl`: the time-to-live in milliseconds for this entry.
 */
export interface CacheEntry<T> {
  data: T;
  ts: number;
  ttl: number;
}

/**
 * Cache contract consumed by the Services layer via dependency injection.
 *
 * `get` respects the TTL (returns `null` once an entry expires), while
 * `getStale` deliberately ignores it to support the stale fallback path.
 */
export interface Cache {
  /** Returns the cached value, or `null` if missing or expired. */
  get<T>(key: string): T | null;
  /** Returns the cached value ignoring the TTL, or `null` if missing (stale fallback). */
  getStale<T>(key: string): T | null;
  /** Stores a value under `key`, optionally overriding the default TTL. */
  set<T>(key: string, data: T, ttl?: number): void;
  /** Removes the entry for `key`, if any. */
  invalidate(key: string): void;
  /** Removes every expired entry from the cache. */
  sweep(): void;
}

/** Default time-to-live applied when a call does not specify one: 5 minutes. */
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Default in-memory {@link Cache} implementation backed by a `Map`.
 *
 * Entries expire once `now - entry.ts > entry.ttl`. The clock is injectable to
 * keep the implementation deterministic and testable; it defaults to
 * `Date.now`.
 */
export class MemoryCache implements Cache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  /**
   * @param defaultTtl Fallback TTL in milliseconds for `set` calls that omit a
   *   TTL. Defaults to {@link DEFAULT_TTL_MS} (5 minutes).
   * @param now Clock function returning epoch milliseconds. Injectable for
   *   deterministic tests; defaults to `Date.now`.
   */
  constructor(
    private readonly defaultTtl: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Returns the value stored under `key` while it is still within its TTL.
   *
   * Expired entries are evicted on access and reported as a miss (`null`).
   *
   * @typeParam T The expected value type.
   * @param key Cache key.
   * @returns The fresh value, or `null` if missing or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return null;
    }
    if (this.isExpired(entry)) {
      // Report a miss but KEEP the entry so `getStale` can still serve the last
      // known value as a fallback when a refresh fails (Requirement 1.8).
      // Expired entries are reclaimed explicitly by `sweep`.
      return null;
    }
    return entry.data as T;
  }

  /**
   * Returns the value stored under `key` regardless of its TTL.
   *
   * Used as the stale fallback when a network request fails so the last known
   * value can still be served (Requirement 1.8).
   *
   * @typeParam T The expected value type.
   * @param key Cache key.
   * @returns The last stored value, or `null` if the key was never set or was
   *   invalidated.
   */
  getStale<T>(key: string): T | null {
    const entry = this.store.get(key);
    return entry === undefined ? null : (entry.data as T);
  }

  /**
   * Stores `data` under `key`, stamping it with the current time and the given
   * TTL. A repeated call for the same key overwrites the previous entry.
   *
   * @typeParam T The value type.
   * @param key Cache key.
   * @param data Value to cache.
   * @param ttl Optional TTL in milliseconds for this entry; defaults to the
   *   cache's default TTL (5 minutes).
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.store.set(key, { data, ts: this.now(), ttl });
  }

  /**
   * Removes the entry for `key`. No-op when the key is absent.
   *
   * @param key Cache key to remove.
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Removes every expired entry, freeing memory for keys that will never be
   * served fresh again (Requirement 1.7).
   */
  sweep(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
      }
    }
  }

  /** Returns `true` when the entry's age has exceeded its TTL. */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return this.now() - entry.ts > entry.ttl;
  }
}
