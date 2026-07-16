/**
 * Squad data-access service (`services/squad.service.ts`).
 *
 * Owns every read/write against the `squad` table on behalf of the UI. Like all
 * Services, it receives its collaborators — a {@link SupabaseClient} and a
 * {@link Cache} — through constructor injection (Requirements 1.5, 5.4), so unit
 * tests can supply mocks without touching the network or the DOM.
 *
 * Reads go through the injected Cache: {@link SquadService.getSquad} serves a
 * fresh value while it is within its TTL and, on a network/non-2xx failure,
 * falls back to the most recent value via `getStale` (stale fallback,
 * Requirement 1.8). Writes invalidate the cached squad so the next read
 * reflects the change.
 *
 * Mapping from the raw {@link SupabaseSquadRow} to the domain {@link Player} is
 * delegated to the pure `domain/serialization.ts` boundary via {@link toPlayer}.
 */

import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';
import { toPlayer } from '@/domain/serialization';
import type { Player } from '@/types/domain';
import type { Result, SupabaseSquadRow } from '@/types/supabase';
import type { BatchItemError, BatchResult, PlayerInput } from '@/types/service';

/** Cache key under which the full squad list is stored. */
const SQUAD_CACHE_KEY = 'squad';

/** REST table/endpoint path for the squad table (relative to `/rest/v1/`). */
const SQUAD_PATH = 'squad';

/**
 * Data-access service for the Cruzeiro squad.
 *
 * All public methods are documented with TSDoc per Requirement 5.5.
 */
export class SquadService {
  /**
   * @param supa Typed Supabase REST client (injected).
   * @param cache In-memory cache used for fresh reads and stale fallback
   *   (injected).
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
  ) {}

  /**
   * Returns the full squad as domain {@link Player}s.
   *
   * Serves the cached value while it is fresh (within its TTL). On a cache miss
   * it fetches from Supabase, caches the result and returns it. If the request
   * fails (network error or a non-2xx status) it falls back to the most recent
   * cached value regardless of expiry (stale fallback, Requirement 1.8);
   * when no stale value exists it resolves to an empty array so the UI can
   * render an explicit empty/error state.
   *
   * @returns The squad players; fresh, stale, or empty depending on cache and
   *   network state.
   */
  async getSquad(): Promise<Player[]> {
    const fresh = this.cache.get<Player[]>(SQUAD_CACHE_KEY);
    if (fresh !== null) {
      return fresh;
    }

    const res = await this.supa.get<SupabaseSquadRow[]>(
      SQUAD_PATH,
      'select=*&order=name.asc',
    );

    if (res.ok) {
      const players = (res.data ?? []).map(toPlayer);
      this.cache.set(SQUAD_CACHE_KEY, players);
      return players;
    }

    // Network/non-2xx failure: serve the last known value if we have one.
    const stale = this.cache.getStale<Player[]>(SQUAD_CACHE_KEY);
    return stale ?? [];
  }

  /**
   * Creates a single squad player and invalidates the cached squad.
   *
   * @param p Writable player fields; `id`, `name` and `position` are required.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` carrying the
   *   backend message (and `status`/`code` when available).
   */
  async addPlayer(p: PlayerInput): Promise<Result<void>> {
    const res = await this.supa.post<unknown>(SQUAD_PATH, toSquadBody(p));
    if (res.ok) {
      this.cache.invalidate(SQUAD_CACHE_KEY);
      return { ok: true, data: undefined };
    }
    return res;
  }

  /**
   * Updates the given fields of an existing player and invalidates the cached
   * squad.
   *
   * @param id Identifier of the player to update.
   * @param fields Partial set of writable fields to change.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
   */
  async updatePlayer(
    id: string,
    fields: Partial<PlayerInput>,
  ): Promise<Result<void>> {
    const res = await this.supa.patch<unknown>(
      SQUAD_PATH,
      toSquadBody(fields),
      `id=eq.${encodeURIComponent(id)}`,
    );
    if (res.ok) {
      this.cache.invalidate(SQUAD_CACHE_KEY);
      return { ok: true, data: undefined };
    }
    return res;
  }

  /**
   * Deletes a player from the squad and invalidates the cached squad.
   *
   * @param id Identifier of the player to delete.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
   */
  async deletePlayer(id: string): Promise<Result<void>> {
    const res = await this.supa.delete(
      SQUAD_PATH,
      `id=eq.${encodeURIComponent(id)}`,
    );
    if (res.ok) {
      this.cache.invalidate(SQUAD_CACHE_KEY);
      return { ok: true, data: undefined };
    }
    return res;
  }

  /**
   * Imports multiple players in a single admin operation (Requirement 28.5).
   *
   * The required fields (`id`, `name`, `position`) of every item are validated
   * **before** any write. If any item is invalid the whole batch is rejected
   * and nothing is persisted: the result reports `ok: false`, `succeeded: 0`,
   * `failed` equal to the batch size, and one {@link BatchItemError} per invalid
   * item. When validation passes, items are upserted individually so a partial
   * success can be reported (Requirement 31.5): `succeeded`/`failed` count the
   * per-item outcomes and `errors` lists any items that failed to persist. The
   * cached squad is invalidated whenever at least one item is persisted.
   *
   * @param players Players to import.
   * @returns A {@link BatchResult} describing validation and persistence
   *   outcomes.
   */
  async importBatch(players: PlayerInput[]): Promise<BatchResult> {
    // Phase 1: up-front required-field validation (Requirement 28.5).
    const validationErrors: BatchItemError[] = [];
    players.forEach((player, index) => {
      const message = validateRequiredFields(player);
      if (message !== null) {
        validationErrors.push({ index, message });
      }
    });

    // Any invalid item rejects the entire batch — nothing is persisted.
    if (validationErrors.length > 0) {
      return {
        ok: false,
        succeeded: 0,
        failed: players.length,
        errors: validationErrors,
      };
    }

    // Phase 2: persist each item individually to report a partial success.
    const errors: BatchItemError[] = [];
    let succeeded = 0;
    for (let index = 0; index < players.length; index += 1) {
      const player = players[index] as PlayerInput;
      const res = await this.supa.post<unknown>(SQUAD_PATH, toSquadBody(player), {
        prefer: 'resolution=merge-duplicates',
      });
      if (res.ok) {
        succeeded += 1;
      } else {
        errors.push({ index, message: res.error });
      }
    }

    if (succeeded > 0) {
      this.cache.invalidate(SQUAD_CACHE_KEY);
    }

    return {
      ok: errors.length === 0,
      succeeded,
      failed: errors.length,
      errors,
    };
  }
}

/**
 * Builds a `squad` row body from writable player fields, defaulting omitted
 * optional columns (`number`, `nationality`, `photo`) to `null` so a partial
 * update never sends `undefined`.
 */
function toSquadBody(fields: Partial<PlayerInput>): Partial<SupabaseSquadRow> {
  const body: Partial<SupabaseSquadRow> = {};
  if (fields.id !== undefined) body.id = fields.id;
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.position !== undefined) body.position = fields.position;
  if (fields.number !== undefined) body.number = fields.number;
  if (fields.nationality !== undefined) body.nationality = fields.nationality;
  if (fields.photo !== undefined) body.photo = fields.photo;
  return body;
}

/**
 * Validates the required fields of a {@link PlayerInput} (`id`, `name`,
 * `position`). Returns a human-readable message describing the first missing
 * field, or `null` when the item is valid.
 */
function validateRequiredFields(player: PlayerInput): string | null {
  if (!isNonEmptyString(player.id)) {
    return 'Campo obrigatório ausente: id';
  }
  if (!isNonEmptyString(player.name)) {
    return 'Campo obrigatório ausente: name';
  }
  if (!isNonEmptyString(player.position)) {
    return 'Campo obrigatório ausente: position';
  }
  return null;
}

/** Returns `true` when `value` is a string with at least one non-space char. */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
