/**
 * "Craque da Partida" (Man of the Match) voting Service
 * (`services/craque.service.ts`).
 *
 * Owns every read and write against the `craque_votes` table. The Man of the
 * Match vote is deliberately distinct from the 0-10 ratings handled by
 * {@link ScoreService}: each authenticated user contributes at most one active
 * vote per fixture, and voting again replaces the previous vote rather than
 * adding a second one (Requirements 22.2, 22.3).
 *
 * Like the rest of the Services layer, it receives its dependencies — the typed
 * {@link SupabaseClient} and the {@link Cache} — via constructor injection
 * (Requirements 1.5, 5.4) and returns typed values instead of throwing. Reads
 * are served from the cache when fresh and fall back to the most recent stale
 * value when a network request fails (stale fallback, Requirements 1.7, 1.8).
 *
 * The single-active-vote guarantee is enforced at persistence time: a vote is
 * upserted with `Prefer: resolution=merge-duplicates` on the
 * `(fixture_id, username)` key, so re-voting overwrites the user's prior choice
 * in place (Requirement 22.3).
 */

import type { CraqueResult, CraqueTally } from '@/types/service';
import type { Result, SupabaseCraqueVoteRow } from '@/types/supabase';
import type { Cache } from './cache';
import type { SupabaseClient } from './supabase-client';

/** REST table path for Man of the Match votes. */
const CRAQUE_VOTES_PATH = 'craque_votes';

/**
 * Data-access Service for "Craque da Partida" community voting.
 *
 * @see Requirement 22 (Man of the Match voting, distinct from 0-10 ratings).
 */
export class CraqueService {
  /**
   * @param supa Typed Supabase REST client (injected, Requirement 5.4).
   * @param cache In-memory cache used for reads with a stale fallback
   *   (Requirements 1.7, 1.8).
   */
  constructor(
    private readonly supa: SupabaseClient,
    private readonly cache: Cache,
  ) {}

  /**
   * Aggregates the community Man of the Match votes for a fixture into a
   * {@link CraqueTally}, one {@link CraqueResult} per voted player
   * (Requirement 22.4).
   *
   * Because each user has at most one active vote per fixture, every stored row
   * counts as exactly one vote for its player. Results are ordered by vote
   * count (desc) then player id (asc) for deterministic output, so the first
   * entry is the current leader.
   *
   * @param fixtureId Identifier of the fixture to tally.
   * @returns The per-player vote counts and total votes; an empty tally when no
   *   votes exist or the read fails with no cached value.
   */
  async getVotes(fixtureId: string): Promise<CraqueTally> {
    const rows = await this.fetchFixtureVotes(fixtureId);

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
    }

    const results: CraqueResult[] = [];
    for (const [playerId, votes] of counts) {
      results.push({ playerId, votes });
    }
    results.sort((a, b) => b.votes - a.votes || a.playerId.localeCompare(b.playerId));

    return { fixtureId, results, totalVotes: rows.length };
  }

  /**
   * Registers (or replaces) a user's Man of the Match vote for a fixture,
   * keeping exactly one active vote per user per fixture (Requirements 22.2,
   * 22.3).
   *
   * The row is upserted with `Prefer: resolution=merge-duplicates` on the
   * `(fixture_id, username)` key, so voting again overwrites the user's prior
   * choice instead of creating a duplicate. On success the cached tally for the
   * fixture is invalidated so a subsequent {@link getVotes} reflects the vote.
   *
   * @param fixtureId Identifier of the fixture being voted on.
   * @param playerId Identifier of the player the user is voting for.
   * @param username Author of the vote.
   * @returns `{ ok: true }` on success; `{ ok: false }` with the backend error
   *   otherwise.
   */
  async vote(
    fixtureId: string,
    playerId: string,
    username: string,
  ): Promise<Result<void>> {
    const row: SupabaseCraqueVoteRow = {
      fixture_id: fixtureId,
      username,
      player_id: playerId,
      created_at: new Date().toISOString(),
    };

    const res = await this.supa.post<SupabaseCraqueVoteRow[]>(CRAQUE_VOTES_PATH, [row], {
      prefer: 'resolution=merge-duplicates',
    });

    if (!res.ok) {
      return res;
    }

    // Invalidate the cached tally so the new/updated vote is reflected.
    this.cache.invalidate(this.fixtureCacheKey(fixtureId));
    return { ok: true, data: undefined };
  }

  /**
   * Returns the current Man of the Match — the most-voted player — for a
   * fixture, or `null` when no votes have been cast (Requirement 22.4).
   *
   * Ties are resolved deterministically by player id (ascending), matching the
   * ordering used by {@link getVotes}.
   *
   * @param fixtureId Identifier of the fixture.
   * @returns The leading {@link CraqueResult}, or `null` when there are no votes.
   */
  async getManOfTheMatch(fixtureId: string): Promise<CraqueResult | null> {
    const tally = await this.getVotes(fixtureId);
    return tally.results[0] ?? null;
  }

  /**
   * Fetches the raw vote rows for one fixture, backed by the cache with a stale
   * fallback (Requirements 1.7, 1.8). Serves both {@link getVotes} and, through
   * it, {@link getManOfTheMatch} from a single request.
   */
  private async fetchFixtureVotes(
    fixtureId: string,
  ): Promise<SupabaseCraqueVoteRow[]> {
    const cacheKey = this.fixtureCacheKey(fixtureId);

    const cached = this.cache.get<SupabaseCraqueVoteRow[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const res = await this.supa.get<SupabaseCraqueVoteRow[]>(
      CRAQUE_VOTES_PATH,
      `fixture_id=eq.${encodeURIComponent(fixtureId)}&select=*`,
    );
    if (res.ok) {
      const rows = res.data ?? [];
      this.cache.set(cacheKey, rows);
      return rows;
    }

    return this.cache.getStale<SupabaseCraqueVoteRow[]>(cacheKey) ?? [];
  }

  /** Cache key holding the raw vote rows for a single fixture. */
  private fixtureCacheKey(fixtureId: string): string {
    return `craque_votes:fixture:${fixtureId}`;
  }
}
