/**
 * `useQuery` — data fetching over Services + Cache (`hooks/useQuery.ts`).
 *
 * Encapsulates the app's server-state pattern: run an async `fetcher` (typically
 * a Service method such as `squad.getSquad()`), expose the request lifecycle as
 * `{ data, loading, error, isStale }`, and provide a `refetch` action. Since the
 * Services layer already implements caching and the **stale fallback**
 * internally (Requirements 1.8, 32.3) — serving the last known value on a
 * network/non-2xx failure — this hook does not re-implement caching; it simply
 * surfaces the outcome to the UI, including whether the value came from the
 * stale fallback so pages can show a discreet offline notice (Requirement 34.3).
 *
 * ## Signalling a stale origin
 *
 * A plain fetcher returning `T` is always treated as **fresh**. To flag that a
 * value came from the stale fallback, a fetcher resolves to a branded
 * {@link QueryResult} built with {@link staleResult} (or {@link freshResult} for
 * symmetry). The brand (a private symbol) lets the hook distinguish a wrapper
 * from a domain value that merely happens to be an object, so any `T` — objects
 * included — can flow through unwrapped:
 *
 * ```ts
 * // plain value → fresh
 * const squad = useQuery(() => services.squad.getSquad(), []);
 *
 * // service that signals origin → isStale reflects the fallback
 * const squad = useQuery(
 *   () => services.squad.getSquadWithOrigin(), // resolves to QueryResult<Player[]>
 *   [],
 * );
 * if (squad.isStale) showOfflineBanner();
 * ```
 *
 * The hook re-runs on mount and whenever `deps` change, guards against setting
 * state after unmount (or after a superseded run), and keeps the latest value
 * visible on error so a failed refetch does not blank the screen.
 *
 * This local abstraction is intentionally compatible with a future swap to
 * TanStack Query without changing consuming components.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react';

/** Private brand marking a {@link QueryResult} wrapper. */
const QUERY_RESULT_TAG = Symbol('jeanscore.queryResult');

/**
 * A fetcher outcome that explicitly carries its origin.
 *
 * Returned by {@link freshResult}/{@link staleResult}; the {@link QUERY_RESULT_TAG}
 * brand lets {@link useQuery} tell a wrapper apart from a plain domain `T`
 * (which may itself be an object) without ambiguity.
 *
 * @typeParam T - The resolved data type.
 */
export interface QueryResult<T> {
  /** Brand identifying this object as a wrapper rather than a domain value. */
  readonly [QUERY_RESULT_TAG]: true;
  /** The fetched value. */
  readonly value: T;
  /** `true` when `value` came from the stale fallback (Requirement 1.8). */
  readonly stale: boolean;
}

/**
 * Wraps a value as a **fresh** {@link QueryResult}.
 *
 * Use when a fetcher returns the wrapper form but the value is up to date.
 *
 * @typeParam T - The value type.
 * @param value - The fresh value.
 * @returns A {@link QueryResult} with `stale: false`.
 */
export function freshResult<T>(value: T): QueryResult<T> {
  return { [QUERY_RESULT_TAG]: true, value, stale: false };
}

/**
 * Wraps a value as a **stale** {@link QueryResult}.
 *
 * Use when a Service served the last known value via its stale fallback so the
 * UI can flag offline/outdated content (Requirements 1.8, 34.3).
 *
 * @typeParam T - The value type.
 * @param value - The stale value.
 * @returns A {@link QueryResult} with `stale: true`.
 */
export function staleResult<T>(value: T): QueryResult<T> {
  return { [QUERY_RESULT_TAG]: true, value, stale: true };
}

/**
 * An async data source for {@link useQuery}.
 *
 * Resolves either to a plain `T` (treated as fresh) or to a {@link QueryResult}
 * that carries an explicit stale origin.
 *
 * @typeParam T - The resolved data type.
 */
export type QueryFetcher<T> = () => Promise<T | QueryResult<T>>;

/** Options controlling {@link useQuery}. */
export interface UseQueryOptions {
  /**
   * When `false`, the query does not run and stays idle (`loading: false`) until
   * re-enabled or {@link UseQueryResult.refetch} is called. Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * The reactive result of a {@link useQuery} call.
 *
 * @typeParam T - The resolved data type.
 */
export interface UseQueryResult<T> {
  /** The most recent value, or `undefined` before the first success. */
  readonly data: T | undefined;
  /** `true` while a request is in flight. */
  readonly loading: boolean;
  /** The last error, or `null` when the latest run succeeded or is pending. */
  readonly error: Error | null;
  /** `true` when {@link data} came from a Service's stale fallback. */
  readonly isStale: boolean;
  /** Re-runs the fetcher imperatively (e.g. a "Tentar novamente" action). */
  readonly refetch: () => void;
}

/** Internal state shape held by {@link useQuery}. */
interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
}

/** Type guard distinguishing a branded {@link QueryResult} from a plain `T`. */
function isQueryResult<T>(value: T | QueryResult<T>): value is QueryResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<QueryResult<T>>)[QUERY_RESULT_TAG] === true
  );
}

/** Coerces an unknown thrown value into an {@link Error}. */
function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Runs an async `fetcher` and tracks its lifecycle for the UI.
 *
 * Runs on mount and whenever `deps` change. State updates are ignored after the
 * component unmounts or once a newer run supersedes the current one, preventing
 * races and post-unmount writes. On failure the previous {@link UseQueryResult.data}
 * is preserved so a failed refetch does not clear already-rendered content.
 *
 * @typeParam T - The resolved data type.
 * @param fetcher - Async data source; may resolve to `T` (fresh) or a
 *   {@link QueryResult} to signal a stale origin.
 * @param deps - Dependency list that re-triggers the query when it changes,
 *   mirroring the semantics of a `useEffect` dependency array. Defaults to `[]`
 *   (run once on mount).
 * @param options - Optional {@link UseQueryOptions} (e.g. `enabled`).
 * @returns The reactive {@link UseQueryResult}.
 */
export function useQuery<T>(
  fetcher: QueryFetcher<T>,
  deps: DependencyList = [],
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  const { enabled = true } = options;

  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    loading: enabled,
    error: null,
    isStale: false,
  });

  // Keep the latest fetcher without forcing it into the effect's deps: callers
  // typically pass a fresh closure each render, and `deps` is the source of
  // truth for when to re-run.
  const fetcherRef = useRef<QueryFetcher<T>>(fetcher);
  fetcherRef.current = fetcher;

  // Monotonic id: only the most recent run is allowed to commit state.
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const result = await fetcherRef.current();
        if (!mountedRef.current || runId !== runIdRef.current) return;
        const { value, stale } = isQueryResult(result)
          ? { value: result.value, stale: result.stale }
          : { value: result, stale: false };
        setState({ data: value, loading: false, error: null, isStale: stale });
      } catch (cause) {
        if (!mountedRef.current || runId !== runIdRef.current) return;
        // Preserve the last value/staleness so a failed refetch keeps content.
        setState((prev) => ({
          ...prev,
          loading: false,
          error: toError(cause),
        }));
      }
    })();
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Cancel any in-flight commit and settle into an idle, non-loading state.
      runIdRef.current += 1;
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    execute();
    // `execute` is stable; `deps` (plus `enabled`) drive re-runs by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, execute, ...deps]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    isStale: state.isStale,
    refetch: execute,
  };
}
