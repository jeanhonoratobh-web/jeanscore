/**
 * Property-based tests for the scoring domain module (`domain/scoring.ts`).
 *
 * Coverage (per the design's testing table): P4, P5, P10, P12.
 * Each property lives in its own `describe` block so additional properties can
 * be appended independently without touching the existing blocks.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizeScore, calcAverage, isValidScore } from './scoring';

// A score is valid when it is within [0, 10] and a multiple of 0.5.
const isMultipleOfHalf = (n: number): boolean => Number.isInteger(n / 0.5);

describe('Property 4: Normalização de nota (limites e passo)', () => {
  // Para todo valor numérico `v`, `normalizeScore(v)` retorna `n` tal que
  // 0 <= n <= 10 e `n` é múltiplo de 0.5.
  // Validates: Requirements 20.2
  it('always returns a value in [0, 10] that is a multiple of 0.5', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (v) => {
          const n = normalizeScore(v);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(10);
          expect(isMultipleOfHalf(n)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 5: Média invariante à ordem e dentro dos limites', () => {
  // Para todo conjunto de notas `scores` não vazio, `calcAverage(scores)` é
  // invariante à ordem (embaralhamento) e está dentro de [min, max].
  // Validates: Requirements 20.6, 26.1
  it('is invariant to input order and lies within [min, max] of the inputs', () => {
    fc.assert(
      fc.property(
        fc
          .array(
            fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
            { minLength: 1 },
          )
          .chain((scores) =>
            fc.tuple(
              fc.constant(scores),
              fc.shuffledSubarray(scores, {
                minLength: scores.length,
                maxLength: scores.length,
              }),
            ),
          ),
        ([scores, shuffled]) => {
          const avg = calcAverage(scores);
          const avgShuffled = calcAverage(shuffled);

          // Shuffle invariance (floating-point tolerant).
          expect(avgShuffled).toBeCloseTo(avg, 8);

          // Within [min, max] of the inputs.
          const min = Math.min(...scores);
          const max = Math.max(...scores);
          expect(avg).toBeGreaterThanOrEqual(min - 1e-9);
          expect(avg).toBeLessThanOrEqual(max + 1e-9);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 10: Normalização de nota é idempotente', () => {
  // Para todo valor numérico `v`,
  // `normalizeScore(normalizeScore(v)) === normalizeScore(v)`.
  // Validates: Requirements 20.2
  it('normalizeScore(normalizeScore(v)) === normalizeScore(v)', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (v) => {
          const once = normalizeScore(v);
          const twice = normalizeScore(once);
          expect(twice).toBe(once);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 12: Rejeição de nota inválida', () => {
  // Para todo valor `v` fora do intervalo [0, 10], `isValidScore(v) === false`;
  // e para todo valor dentro de [0, 10], `isValidScore(v) === true`.
  // Validates: Requirements 20.2
  it('returns false for values outside [0, 10]', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }).filter((v) => v < 0 || v > 10),
        (v) => {
          expect(isValidScore(v)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns true for values within [0, 10]', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 10 }),
        (v) => {
          expect(isValidScore(v)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
