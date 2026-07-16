/**
 * Fixture data-access Service (`services/fixture.service.ts`).
 *
 * Orchestrates all reads and writes for matches (`fixtures`) and their called-up
 * squads (`escalacoes`), sitting between the pure domain/serialization layer and
 * the typed {@link SupabaseClient}. Like every Service, it receives its
 * dependencies — a {@link SupabaseClient} and a {@link Cache} — through the
 * constructor (Requirement 1.5, 5.4), so tests can inject mocks without touching
 * the UI.
 *
 * Responsibilities:
 * - {@link FixtureService.getFixtures} / {@link FixtureService.getFixture}: cached
 *   reads with a stale fallback when the network fails (Requirement 1.8).
 * - {@link FixtureService.importBatch}: bulk import with up-front required-field
 *   validation and whole-batch rejection, then per-item persistence with
 *   partial-success reporting (Requirement 28.6, 31.5).
 * - {@link FixtureService.setLiberado}: toggles the `liberado` flag (Req. 28.8).
 * - {@link FixtureService.getLineup} / {@link FixtureService.saveLineup}: read and
 *   replace a fixture's lineup, where saving fully **replaces** the previous
 *   lineup (Requirement 28.7).
 *
 * Row <-> domain conversion is delegated to `domain/serialization.ts`
 * (`toFixture`, `toFixtureRow`); no mapping logic lives here.
 */

import { toFixture, toFixtureRow } from '@/domain/serialization';
import type { Fixture, Lineup } from '@/types/domain';
import type { BatchItemError, BatchResult, FixtureInput } from '@/types/service';
import type {
  Result,
  SupabaseEscalacaoRow,
  SupabaseFixtureRow,
} from '@/types/supabase';
import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';

/** Cache key holding the full list of fixtures. */
const FIXTURES_CACHE_KEY = 'fixtures';

/** Builds the per-fixture cache key for a lineup. */
function lineupCacheKey(fixtureId: string): string {
  return `lineup:${fixtureId}`;
}

/**
 * Data-access Service for fixtures and their lineups.
 *
 * All dependencies are injected via the constructor (Requirement 1.5).
 */
export class FixtureService {
  /**
   * @param supa Typed Supabase REST client used for every backend call.
   * @param cache In-memory cache backing fresh reads and the stale fallback.
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
  ) {}

  /**
   * Returns every fixture, most recent first.
   *
   * Serves the cached value while it is fresh; on a cache miss it fetches from
   * Supabase and repopulates the cache. If the request fails, it falls back to
   * the last known value regardless of TTL (stale fallback, Requirement 1.8),
   * and returns an empty array only when no data was ever cached.
   *
   * @returns The list of {@link Fixture}s (fresh, or stale on network failure).
   */
  async getFixtures(): Promise<Fixture[]> {
    const cached = this.cache.get<Fixture[]>(FIXTURES_CACHE_KEY);
    if (cached !== null) {
      return cached;
    }

    const res = await this.supa.get<SupabaseFixtureRow[]>(
      'fixtures',
      'select=*&order=ts.desc',
    );

    if (res.ok) {
      const fixtures = (res.data ?? []).map(toFixture);
      this.cache.set(FIXTURES_CACHE_KEY, fixtures);
      return fixtures;
    }

    // Network/non-2xx failure: serve the most recent value if we have one.
    return this.cache.getStale<Fixture[]>(FIXTURES_CACHE_KEY) ?? [];
  }

  /**
   * Returns a single fixture by id, or `null` when it does not exist.
   *
   * Reuses {@link getFixtures} so the lookup benefits from the same cache and
   * stale fallback behaviour.
   *
   * @param id Fixture identifier.
   * @returns The matching {@link Fixture}, or `null` if not found.
   */
  async getFixture(id: string): Promise<Fixture | null> {
    const fixtures = await this.getFixtures();
    return fixtures.find((f) => f.id === id) ?? null;
  }

  /**
   * Imports multiple fixtures from a batch (Requirement 28.6, 31.5).
   *
   * Validates the required fields (`homeTeam`, `awayTeam`, `fixtureDate`,
   * `competition`) of **every** item up front; if any item is invalid the whole
   * batch is rejected and nothing is persisted (`ok: false`, `succeeded: 0`).
   * When validation passes, items are upserted individually so a partial
   * success can be reported. The fixtures cache is invalidated when at least one
   * item persists.
   *
   * @param fixtures Fixtures to import.
   * @returns A {@link BatchResult} summarizing successes and per-item failures.
   */
  async importBatch(fixtures: FixtureInput[]): Promise<BatchResult> {
    // Phase 1: up-front validation — reject the entire batch on any failure.
    const validationErrors: BatchItemError[] = [];
    fixtures.forEach((fixture, index) => {
      const message = validateFixtureInput(fixture);
      if (message !== null) {
        validationErrors.push({ index, message });
      }
    });

    if (validationErrors.length > 0) {
      return {
        ok: false,
        succeeded: 0,
        failed: fixtures.length,
        errors: validationErrors,
      };
    }

    // Phase 2: persist each item, upserting so re-imports merge duplicates.
    const errors: BatchItemError[] = [];
    let succeeded = 0;

    for (let index = 0; index < fixtures.length; index += 1) {
      const row = inputToRow(fixtures[index]);
      const res = await this.supa.post<SupabaseFixtureRow[]>('fixtures', [row], {
        prefer: 'resolution=merge-duplicates',
      });
      if (res.ok) {
        succeeded += 1;
      } else {
        errors.push({ index, message: res.error });
      }
    }

    if (succeeded > 0) {
      this.cache.invalidate(FIXTURES_CACHE_KEY);
    }

    return {
      ok: errors.length === 0,
      succeeded,
      failed: errors.length,
      errors,
    };
  }

  /**
   * Toggles a fixture's `liberado` flag (Requirement 28.8).
   *
   * Patches the single row identified by `id`. On success the fixtures cache is
   * invalidated so the next read reflects the change.
   *
   * @param id Fixture identifier.
   * @param liberado New value for the release flag.
   * @returns `{ ok: true }` on success, otherwise the structured error.
   */
  async setLiberado(id: string, liberado: boolean): Promise<Result<void>> {
    const res = await this.supa.patch<SupabaseFixtureRow[]>(
      'fixtures',
      { liberado },
      `id=eq.${encodeURIComponent(id)}`,
    );

    if (!res.ok) {
      return res;
    }

    this.cache.invalidate(FIXTURES_CACHE_KEY);
    return { ok: true, data: undefined };
  }

  /**
   * Returns the lineup (called-up players) for a fixture.
   *
   * Serves the cached value while fresh; on a miss it fetches from Supabase and
   * repopulates the cache. On failure it falls back to the last known lineup,
   * or an empty lineup when nothing was ever cached (Requirement 1.8).
   *
   * @param fixtureId Fixture identifier.
   * @returns The {@link Lineup} for the fixture.
   */
  async getLineup(fixtureId: string): Promise<Lineup> {
    const key = lineupCacheKey(fixtureId);
    const cached = this.cache.get<Lineup>(key);
    if (cached !== null) {
      return cached;
    }

    const res = await this.supa.get<SupabaseEscalacaoRow[]>(
      'escalacoes',
      `fixture_id=eq.${encodeURIComponent(fixtureId)}&select=player_id`,
    );

    if (res.ok) {
      const lineup: Lineup = {
        fixtureId,
        playerIds: (res.data ?? []).map((row) => row.player_id),
      };
      this.cache.set(key, lineup);
      return lineup;
    }

    return this.cache.getStale<Lineup>(key) ?? { fixtureId, playerIds: [] };
  }

  /**
   * Saves a fixture's lineup, **replacing** any previous one (Requirement 28.7).
   *
   * Deletes all existing `escalacoes` rows for the fixture, then inserts the new
   * set of `player_id`s. Duplicate ids in the input are removed. Passing an
   * empty list clears the lineup. The per-fixture lineup cache is invalidated on
   * success so the next read reflects the replacement.
   *
   * @param fixtureId Fixture identifier.
   * @param playerIds Player ids called up for the fixture (order preserved,
   *   duplicates removed).
   * @returns `{ ok: true }` on success, otherwise the structured error.
   */
  async saveLineup(fixtureId: string, playerIds: string[]): Promise<Result<void>> {
    // Replace semantics: remove the previous lineup first.
    const del = await this.supa.delete(
      'escalacoes',
      `fixture_id=eq.${encodeURIComponent(fixtureId)}`,
    );
    if (!del.ok) {
      return del;
    }

    const uniqueIds = [...new Set(playerIds)];

    if (uniqueIds.length > 0) {
      const rows: SupabaseEscalacaoRow[] = uniqueIds.map((playerId) => ({
        fixture_id: fixtureId,
        player_id: playerId,
      }));
      const ins = await this.supa.post<SupabaseEscalacaoRow[]>('escalacoes', rows);
      if (!ins.ok) {
        return ins;
      }
    }

    this.cache.invalidate(lineupCacheKey(fixtureId));
    return { ok: true, data: undefined };
  }
}

/**
 * Validates a single {@link FixtureInput}'s required fields (Requirement 28.6).
 *
 * @param input The fixture input to validate.
 * @returns `null` when valid, otherwise a human-readable failure message.
 */
function validateFixtureInput(input: FixtureInput): string | null {
  if (!input || typeof input !== 'object') {
    return 'Partida inválida';
  }
  if (!isNonEmptyString(input.homeTeam)) {
    return 'Campo obrigatório ausente: home_team';
  }
  if (!isNonEmptyString(input.awayTeam)) {
    return 'Campo obrigatório ausente: away_team';
  }
  if (!isNonEmptyString(input.fixtureDate)) {
    return 'Campo obrigatório ausente: fixture_date';
  }
  if (typeof input.competition !== 'number' || Number.isNaN(input.competition)) {
    return 'Campo obrigatório ausente: competition';
  }
  return null;
}

/** Returns `true` when `value` is a non-empty, non-whitespace string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Converts a validated {@link FixtureInput} into a Supabase row payload using
 * {@link toFixtureRow}, applying defaults for optional columns. When no `id` is
 * supplied it is omitted from the payload so the database generates one.
 */
function inputToRow(input: FixtureInput): SupabaseFixtureRow | Omit<SupabaseFixtureRow, 'id'> {
  const fixture: Fixture = {
    id: input.id ?? '',
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeScore: input.homeScore ?? null,
    awayScore: input.awayScore ?? null,
    fixtureDate: input.fixtureDate,
    ts: input.ts ?? 0,
    competition: input.competition,
    stadium: input.stadium ?? null,
    status: input.status ?? 'notstarted',
    liberado: input.liberado ?? false,
  };

  const row = toFixtureRow(fixture);
  if (!isNonEmptyString(input.id)) {
    const { id: _omitted, ...rest } = row;
    return rest;
  }
  return row;
}
