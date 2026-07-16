/**
 * Property-based tests for card rarity and rating derivation.
 *
 * Property 3: Raridade determinística e monotônica da Carta_FIFA.
 * **Validates: Requirements 15.2, 15.3**
 *
 * Verifies that {@link calcRarity} and {@link mapScoreToRating}:
 * - produce exactly one valid rarity band and respect the documented ranges,
 * - are deterministic (equal inputs always yield equal outputs),
 * - are monotonic non-decreasing (a higher average never yields a lower
 *   rarity rank nor a lower rating).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Rarity } from '../types/domain';
import { calcRarity, mapScoreToRating } from './rarity';

/** Ascending rank for each rarity band, used to assert monotonicity. */
const RARITY_RANK: Record<Rarity, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  legendary: 3,
};

/** All valid rarity bands. */
const VALID_RARITIES: readonly Rarity[] = ['bronze', 'silver', 'gold', 'legendary'];

/** Generates season averages in the `[0, 10]` domain, including edges. */
const scoreArb = fc.double({ min: 0, max: 10, noNaN: true });

describe('Property 3: Raridade determinística e monotônica da Carta_FIFA', () => {
  describe('calcRarity', () => {
    it('returns exactly one valid rarity band (including null input)', () => {
      fc.assert(
        fc.property(fc.option(scoreArb, { nil: null }), (avg) => {
          const rarity = calcRarity(avg);
          expect(VALID_RARITIES).toContain(rarity);
        }),
        { numRuns: 100 },
      );
    });

    it('respects the documented average -> band ranges', () => {
      fc.assert(
        fc.property(scoreArb, (avg) => {
          const rarity = calcRarity(avg);
          if (avg < 6) {
            expect(rarity).toBe('bronze');
          } else if (avg < 7) {
            expect(rarity).toBe('silver');
          } else if (avg < 8) {
            expect(rarity).toBe('gold');
          } else {
            expect(rarity).toBe('legendary');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('treats null as the lowest band (bronze)', () => {
      expect(calcRarity(null)).toBe('bronze');
    });

    it('is deterministic: equal inputs yield equal outputs', () => {
      fc.assert(
        fc.property(fc.option(scoreArb, { nil: null }), (avg) => {
          expect(calcRarity(avg)).toBe(calcRarity(avg));
        }),
        { numRuns: 100 },
      );
    });

    it('is monotonic non-decreasing in rarity rank as avg grows', () => {
      fc.assert(
        fc.property(scoreArb, scoreArb, (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          expect(RARITY_RANK[calcRarity(hi)]).toBeGreaterThanOrEqual(
            RARITY_RANK[calcRarity(lo)],
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('mapScoreToRating', () => {
    it('returns an integer within [0, 99] for avg in [0, 10]', () => {
      fc.assert(
        fc.property(scoreArb, (avg) => {
          const rating = mapScoreToRating(avg);
          expect(Number.isInteger(rating)).toBe(true);
          expect(rating).toBeGreaterThanOrEqual(0);
          expect(rating).toBeLessThanOrEqual(99);
        }),
        { numRuns: 100 },
      );
    });

    it('hits both extremes: 0 -> 0 and 10 -> 99', () => {
      expect(mapScoreToRating(0)).toBe(0);
      expect(mapScoreToRating(10)).toBe(99);
    });

    it('is deterministic: equal inputs yield equal outputs', () => {
      fc.assert(
        fc.property(scoreArb, (avg) => {
          expect(mapScoreToRating(avg)).toBe(mapScoreToRating(avg));
        }),
        { numRuns: 100 },
      );
    });

    it('is monotonic non-decreasing: higher avg never yields a lower rating', () => {
      fc.assert(
        fc.property(scoreArb, scoreArb, (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          expect(mapScoreToRating(hi)).toBeGreaterThanOrEqual(mapScoreToRating(lo));
        }),
        { numRuns: 100 },
      );
    });
  });
});
