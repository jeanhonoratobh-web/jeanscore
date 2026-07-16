/**
 * Unit tests for {@link RestSupabaseClient} (`services/supabase-client.ts`).
 *
 * These tests inject a mock `fetch` (via {@link SupabaseClientConfig.fetchFn})
 * and assert the client's contract for mapping HTTP outcomes to a typed
 * {@link Result}:
 * - 2xx responses become `{ ok: true, data }`;
 * - 204 responses become `{ ok: true, data: undefined }` with no body read;
 * - non-2xx responses become `{ ok: false, error, status, code }`, propagating
 *   the PostgreSQL SQLSTATE `code` from the error body;
 * - transport/network failures become `{ ok: false, error }` (no status/code);
 * - upserts send the `Prefer: resolution=merge-duplicates` header.
 *
 * Requirements: 1.6 (typed responses for every Supabase call), 31.4 (structured
 * error propagation for user-facing messaging).
 */
import { describe, it, expect, vi } from 'vitest';
import { RestSupabaseClient, type SupabaseClientConfig } from './supabase-client';

const BASE_URL = 'https://project.supabase.co';
const ANON_KEY = 'test-anon-key';

/**
 * Builds a minimal `Response`-like stub sufficient for the client, which only
 * reads `ok`, `status`, and `json()`.
 */
function makeResponse(
  status: number,
  body: unknown,
  opts: { jsonThrows?: boolean } = {},
): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    json: opts.jsonThrows
      ? vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input'))
      : vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

/**
 * Instantiates a client whose `fetch` resolves to `response`, returning both
 * the client and the mock so callers can assert on request arguments.
 */
function clientReturning(response: Response) {
  const fetchFn = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
  const config: SupabaseClientConfig = { url: BASE_URL, anonKey: ANON_KEY, fetchFn };
  return { client: new RestSupabaseClient(config), fetchFn };
}

describe('RestSupabaseClient', () => {
  describe('2xx responses', () => {
    it('maps a 200 GET to { ok: true, data }', async () => {
      const payload = [{ id: '1', name: 'Cassio' }];
      const { client } = clientReturning(makeResponse(200, payload));

      const result = await client.get<typeof payload>('squad', 'select=*');

      expect(result).toStrictEqual({ ok: true, data: payload });
    });

    it('maps a 201 POST to { ok: true, data }', async () => {
      const payload = [{ fixture_id: 'f1', player_id: 'p1' }];
      const { client } = clientReturning(makeResponse(201, payload));

      const result = await client.post<typeof payload>('escalacoes', {
        fixture_id: 'f1',
        player_id: 'p1',
      });

      expect(result).toStrictEqual({ ok: true, data: payload });
    });

    it('builds the REST URL with the query string and auth headers', async () => {
      const { client, fetchFn } = clientReturning(makeResponse(200, []));

      await client.get('fixtures', 'select=*&order=ts.asc');

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/fixtures?select=*&order=ts.asc`);
      expect(init.method).toBe('GET');
      expect(init.headers.apikey).toBe(ANON_KEY);
      expect(init.headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
    });

    it('strips a trailing slash from the configured base URL', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(200, [])) as unknown as typeof fetch;
      const client = new RestSupabaseClient({
        url: `${BASE_URL}/`,
        anonKey: ANON_KEY,
        fetchFn,
      });

      await client.get('squad');

      const [url] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/squad`);
    });
  });

  describe('204 No Content', () => {
    it('maps a 204 DELETE to { ok: true, data: undefined } without reading the body', async () => {
      const response = makeResponse(204, undefined);
      const { client } = clientReturning(response);

      const result = await client.delete('squad', 'id=eq.1');

      expect(result).toStrictEqual({ ok: true, data: undefined });
      // Body must not be parsed for a 204 response.
      expect((response.json as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });

  describe('non-2xx responses', () => {
    it('maps a 4xx to { ok: false, error, status, code } propagating the SQLSTATE code', async () => {
      const errBody = {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      };
      const { client } = clientReturning(makeResponse(409, errBody));

      const result = await client.post('permanent_scores', { player_id: 'p1' });

      expect(result).toStrictEqual({
        ok: false,
        error: errBody.message,
        status: 409,
        code: '23505',
      });
    });

    it('propagates status without a code when the error body has no SQLSTATE', async () => {
      const { client } = clientReturning(makeResponse(400, { message: 'bad request' }));

      const result = await client.get('squad');

      expect(result).toStrictEqual({ ok: false, error: 'bad request', status: 400 });
      // No `code` key when the backend omits the SQLSTATE.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBeUndefined();
      }
    });

    it('falls back to an "HTTP <status>" message when the error body is empty/unparsable', async () => {
      const { client } = clientReturning(makeResponse(500, null, { jsonThrows: true }));

      const result = await client.get('squad');

      expect(result).toStrictEqual({ ok: false, error: 'HTTP 500', status: 500 });
    });
  });

  describe('network/transport failures', () => {
    it('maps a rejected fetch to { ok: false, error } without status or code', async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValue(new Error('Failed to fetch')) as unknown as typeof fetch;
      const client = new RestSupabaseClient({ url: BASE_URL, anonKey: ANON_KEY, fetchFn });

      const result = await client.get('squad');

      expect(result).toStrictEqual({ ok: false, error: 'Failed to fetch' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBeUndefined();
        expect(result.code).toBeUndefined();
      }
    });

    it('uses a default message when a non-Error value is thrown', async () => {
      const fetchFn = vi.fn().mockRejectedValue('boom') as unknown as typeof fetch;
      const client = new RestSupabaseClient({ url: BASE_URL, anonKey: ANON_KEY, fetchFn });

      const result = await client.get('squad');

      expect(result).toStrictEqual({ ok: false, error: 'Erro de rede' });
    });
  });

  describe('Prefer header', () => {
    it('sends Prefer: resolution=merge-duplicates on an upsert POST', async () => {
      const { client, fetchFn } = clientReturning(makeResponse(201, []));

      await client.post(
        'craque_votes',
        { fixture_id: 'f1', username: 'u1', player_id: 'p1' },
        { prefer: 'resolution=merge-duplicates' },
      );

      const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers.Prefer).toBe('resolution=merge-duplicates');
      expect(init.body).toBe(
        JSON.stringify({ fixture_id: 'f1', username: 'u1', player_id: 'p1' }),
      );
    });

    it('defaults Prefer to return=representation when no option is given', async () => {
      const { client, fetchFn } = clientReturning(makeResponse(201, []));

      await client.post('squad', { name: 'New Player' });

      const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers.Prefer).toBe('return=representation');
    });
  });
});
