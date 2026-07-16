/**
 * Unit tests for {@link PredictionService} (`services/prediction.service.ts`).
 *
 * These tests inject a mock {@link SupabaseClient}, a mock {@link Cache}, a
 * stub {@link FixtureService} (only `getFixture`/`getLineup` are exercised) and
 * a deterministic `now` clock so the kickoff lock and scoring can be asserted
 * without touching the network or the UI (Requirement 5.4). They cover the
 * prediction submission/scoring contract:
 * - `submit` is **blocked** once the fixture kickoff timestamp has been reached,
 *   returning {@link PREDICTION_LOCKED_MESSAGE} and persisting nothing
 *   (Requirement 23.2);
 * - `submit` before kickoff upserts the prediction and invalidates the cache
 *   (Requirement 23.3);
 * - `submit` against a missing fixture returns {@link FIXTURE_NOT_FOUND_MESSAGE};
 * - `scoreForFixture` delegates to the pure `scorePrediction` domain function
 *   and returns the per-prediction outcomes computed against the real fixture
 *   result and lineup (Requirement 23.4).
 *
 * Requirements: 23.2 (block submission/edition after kickoff), 23.4 (score
 * predictions against the real result via the data-driven config).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PredictionService,
  DEFAULT_PREDICTION_CONFIG,
  PREDICTION_LOCKED_MESSAGE,
  FIXTURE_NOT_FOUND_MESSAGE,
} from './prediction.service';
import { scorePrediction } from '@/domain/predictions';
import type { SupabaseClient } from './supabase-client';
import type { Cache } from './cache';
import type { FixtureService } from './fixture.service';
import type { Fixture, Lineup, Prediction } from '@/types/domain';
import type { PredictionInput } from '@/types/service';
import type { SupabasePredictionRow } from '@/types/supabase';

/** A mock {@link SupabaseClient} whose four verbs are `vi.fn()` spies. */
function makeSupa() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as SupabaseClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

/** A mock {@link Cache} whose methods are `vi.fn()` spies. */
function makeCache() {
  return {
    get: vi.fn(),
    getStale: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    sweep: vi.fn(),
  } as unknown as Cache & {
    get: ReturnType<typeof vi.fn>;
    getStale: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
    sweep: ReturnType<typeof vi.fn>;
  };
}

/** A stub {@link FixtureService} exposing only the methods the service calls. */
function makeFixtures() {
  return {
    getFixture: vi.fn(),
    getLineup: vi.fn(),
  } as unknown as FixtureService & {
    getFixture: ReturnType<typeof vi.fn>;
    getLineup: ReturnType<typeof vi.fn>;
  };
}

/** Kickoff timestamp (seconds) used across the lock tests. */
const KICKOFF_TS = 1_700_000_000; // seconds
const KICKOFF_MS = KICKOFF_TS * 1000;

/** Builds a {@link Fixture} with sensible defaults, overridable per test. */
function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'f1',
    homeTeam: 'Corinthians',
    awayTeam: 'Palmeiras',
    homeScore: null,
    awayScore: null,
    fixtureDate: '2023-11-14',
    ts: KICKOFF_TS,
    competition: 1,
    stadium: null,
    status: 'notstarted',
    liberado: false,
    ...overrides,
  };
}

/** Builds a raw `predictions` row with defaults. */
function makeRow(overrides: Partial<SupabasePredictionRow> = {}): SupabasePredictionRow {
  return {
    fixture_id: 'f1',
    username: 'cassio',
    home_score: 2,
    away_score: 1,
    lineup_player_ids: ['p1'],
    points: null,
    created_at: '2023-11-01T00:00:00Z',
    ...overrides,
  };
}

const PREDICTIONS_PATH = 'predictions';

describe('PredictionService', () => {
  let supa: ReturnType<typeof makeSupa>;
  let cache: ReturnType<typeof makeCache>;
  let fixtures: ReturnType<typeof makeFixtures>;
  let now: ReturnType<typeof vi.fn>;
  let service: PredictionService;

  beforeEach(() => {
    supa = makeSupa();
    cache = makeCache();
    fixtures = makeFixtures();
    now = vi.fn();
    service = new PredictionService(
      supa,
      cache,
      fixtures,
      DEFAULT_PREDICTION_CONFIG,
      now as unknown as () => number,
    );
  });

  describe('submit — kickoff lock (Requirement 23.2)', () => {
    const input: PredictionInput = {
      fixtureId: 'f1',
      username: 'cassio',
      homeScore: 2,
      awayScore: 1,
      lineupPlayerIds: ['p1'],
    };

    it('blocks submission exactly at kickoff and persists nothing', async () => {
      fixtures.getFixture.mockResolvedValue(makeFixture());
      now.mockReturnValue(KICKOFF_MS); // now === kickoff

      const result = await service.submit(input);

      expect(result).toStrictEqual({ ok: false, error: PREDICTION_LOCKED_MESSAGE });
      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('blocks submission after kickoff and persists nothing', async () => {
      fixtures.getFixture.mockResolvedValue(makeFixture());
      now.mockReturnValue(KICKOFF_MS + 60_000); // one minute past kickoff

      const result = await service.submit(input);

      expect(result).toStrictEqual({ ok: false, error: PREDICTION_LOCKED_MESSAGE });
      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('upserts the prediction and invalidates the cache when submitted before kickoff (Req 23.3)', async () => {
      fixtures.getFixture.mockResolvedValue(makeFixture());
      now.mockReturnValue(KICKOFF_MS - 1000); // one second before kickoff
      supa.post.mockResolvedValue({ ok: true, data: [] });

      const result = await service.submit(input);

      expect(result).toStrictEqual({ ok: true, data: undefined });
      expect(supa.post).toHaveBeenCalledTimes(1);
      const [path, body, options] = supa.post.mock.calls[0];
      expect(path).toBe(PREDICTIONS_PATH);
      expect(options).toStrictEqual({ prefer: 'resolution=merge-duplicates' });
      expect(body).toStrictEqual([
        {
          fixture_id: 'f1',
          username: 'cassio',
          home_score: 2,
          away_score: 1,
          lineup_player_ids: ['p1'],
          points: null,
          created_at: new Date(KICKOFF_MS - 1000).toISOString(),
        },
      ]);
      expect(cache.invalidate).toHaveBeenCalledWith('predictions:fixture:f1');
    });

    it('does not invalidate the cache when the upsert fails', async () => {
      fixtures.getFixture.mockResolvedValue(makeFixture());
      now.mockReturnValue(KICKOFF_MS - 1000);
      const failure = { ok: false as const, error: 'network down' };
      supa.post.mockResolvedValue(failure);

      const result = await service.submit(input);

      expect(result).toStrictEqual(failure);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('returns FIXTURE_NOT_FOUND_MESSAGE and persists nothing when the fixture is missing', async () => {
      fixtures.getFixture.mockResolvedValue(null);

      const result = await service.submit(input);

      expect(result).toStrictEqual({ ok: false, error: FIXTURE_NOT_FOUND_MESSAGE });
      expect(now).not.toHaveBeenCalled();
      expect(supa.post).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('scoreForFixture — scoring vs real result (Requirement 23.4)', () => {
    it('returns an empty array when the fixture does not exist', async () => {
      fixtures.getFixture.mockResolvedValue(null);

      const outcomes = await service.scoreForFixture('missing');

      expect(outcomes).toStrictEqual([]);
      expect(fixtures.getLineup).not.toHaveBeenCalled();
    });

    it('delegates to scorePrediction, scoring each prediction against the real result and lineup', async () => {
      const fixture = makeFixture({ homeScore: 2, awayScore: 1 });
      const lineup: Lineup = { fixtureId: 'f1', playerIds: ['p1', 'p2'] };
      fixtures.getFixture.mockResolvedValue(fixture);
      fixtures.getLineup.mockResolvedValue(lineup);

      // cassio: exact 2-1 hit + lineup p1 hit; palmeirense: wrong result, no hits.
      const rows: SupabasePredictionRow[] = [
        makeRow({ username: 'cassio', home_score: 2, away_score: 1, lineup_player_ids: ['p1'] }),
        makeRow({ username: 'gil', home_score: 0, away_score: 3, lineup_player_ids: ['p9'] }),
      ];
      cache.get.mockReturnValue(null);
      supa.get.mockResolvedValue({ ok: true, data: rows });

      const outcomes = await service.scoreForFixture('f1');

      // The service must produce exactly what the pure domain function produces.
      const actual = { homeScore: 2, awayScore: 1, lineupPlayerIds: ['p1', 'p2'] };
      const expected = rows.map((row) => {
        const prediction: Prediction = {
          fixtureId: row.fixture_id,
          username: row.username,
          homeScore: row.home_score,
          awayScore: row.away_score,
          lineupPlayerIds: row.lineup_player_ids ?? [],
          createdAt: row.created_at,
        };
        return scorePrediction(prediction, actual, DEFAULT_PREDICTION_CONFIG);
      });

      expect(outcomes).toStrictEqual(expected);

      // Sanity check the concrete numbers to guard against a silent config drift.
      expect(outcomes[0]).toMatchObject({
        username: 'cassio',
        exactScore: true,
        correctResult: true,
        lineupHits: 1,
        points: 16, // 10 (exact) + 5 (result) + 1 (lineup)
      });
      expect(outcomes[1]).toMatchObject({
        username: 'gil',
        exactScore: false,
        correctResult: false,
        lineupHits: 0,
        points: 0,
      });
    });
  });
});
