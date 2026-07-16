/**
 * Property-based tests for the pure (de)serialization boundary
 * (`domain/serialization.ts`).
 *
 * Covers Property 1 from the design document: the Avaliação (rating) round-trip.
 * A {@link ScoreEntry} serialized with {@link serializeScore} and parsed back
 * with {@link deserializeScore} reproduces the original entry exactly, with no
 * floating-point drift — because scores are multiples of `0.5`, all exactly
 * representable in binary floating point.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  deserializeScore,
  serializeScore,
  toFixture,
  toFixtureRow,
  type ScoreEntry,
} from './serialization';
import type { SupabaseFixtureRow } from '../types/supabase';

/**
 * Smart generator for a valid {@link ScoreEntry}.
 *
 * Constrains the input space to the domain's rating rules: the score is a
 * multiple of `0.5` in `[0, 10]`, generated as an integer in `[0, 20]` (the
 * number of half-points) divided by 2 so every value is exactly representable
 * and no invalid ratings are produced.
 */
const scoreEntryArb: fc.Arbitrary<ScoreEntry> = fc.record({
  playerId: fc.string(),
  playerName: fc.string(),
  score: fc.integer({ min: 0, max: 20 }).map((halfPoints) => halfPoints / 2),
});

describe('serialization — score (de)serialization', () => {
  /**
   * Property 1: Round-trip de Avaliação (serialização/deserialização).
   *
   * Para toda Avaliação com nota `n ∈ {0.0, 0.5, 1.0, …, 10.0}`,
   * `deserializeScore(serializeScore(entry))` produz um objeto equivalente ao
   * original, sem deriva de ponto flutuante.
   *
   * **Validates: Requirements 1.5, 20.3, 20.10**
   */
  it('deserializeScore(serializeScore(entry)) reproduces the entry (Property 1)', () => {
    fc.assert(
      fc.property(scoreEntryArb, (entry) => {
        const roundTripped = deserializeScore(serializeScore(entry));

        expect(roundTripped).toStrictEqual(entry);
        // No floating-point drift: the numeric score survives exactly.
        expect(roundTripped.score).toBe(entry.score);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Smart generator for a raw {@link SupabaseFixtureRow}.
 *
 * Constrains the input space to the shapes the mapping boundary must handle
 * losslessly:
 *  - `stadium` is nullable (unknown venue) — generated as a string or `null`;
 *  - `home_score`/`away_score` are nullable (match not yet played) — generated
 *    as an integer or `null`;
 *  - `competition` is a numeric string, because {@link toFixture} parses it to
 *    a number and {@link toFixtureRow} converts it back with `String(...)`; a
 *    non-numeric string would not survive that round-trip and is out of the
 *    real column's domain.
 */
const supabaseFixtureRowArb: fc.Arbitrary<SupabaseFixtureRow> = fc.record({
  id: fc.string(),
  home_team: fc.string(),
  away_team: fc.string(),
  home_score: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
  away_score: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
  fixture_date: fc.string(),
  ts: fc.integer({ min: 0 }),
  competition: fc.integer({ min: 0 }).map((n) => String(n)),
  stadium: fc.option(fc.string(), { nil: null }),
  status: fc.string(),
  liberado: fc.boolean(),
});

describe('serialization — fixture mapping round-trip', () => {
  /**
   * Property 2: Round-trip de Fixture (Supabase → Domínio → Supabase).
   *
   * Para toda linha `fixtures` válida do Supabase,
   * `toFixtureRow(toFixture(row))` reproduz a linha original — incluindo
   * `stadium` nulo e `home_score`/`away_score` nulos.
   *
   * **Validates: Requirements 1.5, 20.10**
   */
  it('toFixtureRow(toFixture(row)) reproduces the original row (Property 2)', () => {
    fc.assert(
      fc.property(supabaseFixtureRowArb, (row) => {
        const roundTripped = toFixtureRow(toFixture(row));

        expect(roundTripped).toStrictEqual(row);
      }),
      { numRuns: 100 },
    );
  });
});
