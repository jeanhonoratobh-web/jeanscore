/**
 * Typed Supabase REST client (`services/supabase-client.ts`).
 *
 * Encapsulates **every** REST call to the Supabase backend, replacing the
 * legacy global `SUPA` object. Each method returns a typed {@link Result}, so
 * callers never inspect raw `Response` objects and every failure is a
 * structured value rather than a thrown exception (Requirement 1.6).
 *
 * The client is dependency-injected into Services (Requirement 5.4): its
 * configuration ({@link SupabaseClientConfig}) is passed to the constructor,
 * and a default instance reading Vite environment variables is produced by
 * {@link createSupabaseClient}.
 *
 * Error mapping contract: any response with a status outside the 2xx range is
 * translated to `{ ok: false, error, status, code }`, where `code` carries the
 * PostgreSQL `SQLSTATE` (e.g. `23505` for a unique-violation) so the domain
 * layer can translate specific database errors into user-facing messages
 * (Requirement 21.4). Network/transport failures are caught and returned as
 * `{ ok: false, error }` without a status or code.
 */

import type { Result } from '@/types/supabase';

/**
 * `Prefer` header options for write requests.
 *
 * - `resolution=merge-duplicates` performs an upsert, required for per-match
 *   voting, lineups, permanent scores, Man of the Match and predictions.
 * - `return=representation` asks PostgREST to return the affected rows.
 */
export interface PreferHeader {
  prefer?: 'resolution=merge-duplicates' | 'return=representation';
}

/**
 * The typed REST surface consumed by every Service (Requirement 1.6).
 *
 * `path` is a table/endpoint path relative to `/rest/v1/` (e.g. `squad`),
 * and `params` is a raw PostgREST query string (e.g. `select=*&order=ts.asc`).
 */
export interface SupabaseClient {
  /** Issues a `GET` request; `params` is an optional PostgREST query string. */
  get<T>(path: string, params?: string): Promise<Result<T>>;
  /** Issues a `POST` request; pass `{ prefer: 'resolution=merge-duplicates' }` to upsert. */
  post<T>(path: string, body: unknown, opts?: PreferHeader): Promise<Result<T>>;
  /** Issues a `PATCH` request filtered by the required `params` query string. */
  patch<T>(path: string, body: unknown, params: string): Promise<Result<T>>;
  /** Issues a `DELETE` request filtered by the required `params` query string. */
  delete(path: string, params: string): Promise<Result<void>>;
}

/**
 * Configuration required to reach a Supabase project's REST API.
 *
 * Supplied via constructor injection so tests can point the client at a mock
 * endpoint without touching environment variables (Requirement 5.4).
 */
export interface SupabaseClientConfig {
  /** Project base URL, e.g. `https://<project>.supabase.co` (no trailing slash). */
  url: string;
  /** Anonymous/publishable API key sent as both `apikey` and bearer token. */
  anonKey: string;
  /**
   * Optional `fetch` implementation. Defaults to the global `fetch`; injectable
   * for unit tests.
   */
  fetchFn?: typeof fetch;
}

/**
 * Shape of a PostgREST/PostgreSQL error body. All fields are optional because
 * the backend may return an empty body or a non-JSON payload on failure.
 */
interface SupabaseErrorBody {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Default REST implementation of {@link SupabaseClient} backed by `fetch`.
 *
 * All four verbs funnel through {@link request}, which builds the URL, attaches
 * the auth headers, and normalizes the response into a {@link Result}.
 */
export class RestSupabaseClient implements SupabaseClient {
  private readonly baseUrl: string;
  private readonly anonKey: string;
  private readonly fetchFn: typeof fetch;

  /**
   * @param config Connection details (URL, anon key) and an optional `fetch`.
   */
  constructor(config: SupabaseClientConfig) {
    // Normalize: strip any trailing slash so `${baseUrl}/rest/v1/...` is clean.
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.anonKey = config.anonKey;
    this.fetchFn = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /** {@inheritDoc SupabaseClient.get} */
  get<T>(path: string, params?: string): Promise<Result<T>> {
    return this.request<T>('GET', path, null, params);
  }

  /** {@inheritDoc SupabaseClient.post} */
  post<T>(path: string, body: unknown, opts?: PreferHeader): Promise<Result<T>> {
    return this.request<T>('POST', path, body, undefined, opts?.prefer);
  }

  /** {@inheritDoc SupabaseClient.patch} */
  patch<T>(path: string, body: unknown, params: string): Promise<Result<T>> {
    return this.request<T>('PATCH', path, body, params);
  }

  /** {@inheritDoc SupabaseClient.delete} */
  delete(path: string, params: string): Promise<Result<void>> {
    return this.request<undefined>('DELETE', path, null, params);
  }

  /**
   * Core request pipeline shared by all verbs.
   *
   * Builds the REST URL, sends the request with auth + `Prefer` headers, and
   * maps the outcome to a {@link Result}: 2xx responses become
   * `{ ok: true, data }`; non-2xx responses become
   * `{ ok: false, error, status, code }` with the SQLSTATE from the error body;
   * transport failures become `{ ok: false, error }`.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    params?: string,
    prefer?: PreferHeader['prefer'],
  ): Promise<Result<T>> {
    const query = params ? `?${params}` : '';
    const url = `${this.baseUrl}/rest/v1/${path}${query}`;

    const headers: Record<string, string> = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: prefer ?? 'return=representation',
    };

    const init: RequestInit = { method, headers };
    if (body !== null && body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, init);
    } catch (e) {
      // Network/transport failure: no HTTP status is available.
      const message = e instanceof Error ? e.message : 'Erro de rede';
      return { ok: false, error: message };
    }

    if (!res.ok) {
      const errBody = await this.safeJson<SupabaseErrorBody>(res);
      return {
        ok: false,
        error: errBody?.message ?? `HTTP ${res.status}`,
        status: res.status,
        // `code` carries the SQLSTATE (e.g. 23505) for domain-level translation.
        ...(errBody?.code !== undefined ? { code: errBody.code } : {}),
      };
    }

    // Success: 204 No Content (typical for DELETE) yields no body.
    if (res.status === 204) {
      return { ok: true, data: undefined as T };
    }

    const data = await this.safeJson<T>(res);
    return { ok: true, data: data as T };
  }

  /**
   * Parses a JSON response body without throwing. Returns `null` when the body
   * is empty or not valid JSON.
   */
  private async safeJson<T>(res: Response): Promise<T | null> {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Builds the default {@link SupabaseClient} from typed Vite environment
 * variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
 *
 * Kept separate from the class so the app bootstrap wires the concrete config
 * once, while tests instantiate {@link RestSupabaseClient} with explicit config
 * and a mock `fetch` (Requirement 5.4).
 *
 * @throws Error when either environment variable is missing at runtime.
 */
export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Configuração do Supabase ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    );
  }

  return new RestSupabaseClient({ url, anonKey });
}
