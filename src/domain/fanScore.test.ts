/**
 * Property-based tests for the Fan Score domain module (`domain/fanScore.ts`).
 *
 * Coverage (per the design's testing table): P14, P15.
 * Each property lives in its own `describe` block so additional properties can
 * be appended independently without touching the existing blocks.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { applyFanScore, fanLevel, levelIndex } from './fanScore';
import type { FanLevel } from '../types/domain';
import type { FanScoreAction, FanScoreConfig } from '../types/config';

// All scorable participation actions (Requirement 9.1).
const FAN_SCORE_ACTIONS: readonly FanScoreAction[] = [
  'rate_match',
  'rate_full_lineup',
  'consecutive_match',
  'daily_return',
  'full_season',
  'vote_craque',
  'prediction_hit',
] as const;

// Ascending Supporter Levels (Requirement 9.4).
const FAN_LEVELS: readonly FanLevel[] = [
  'iniciante',
  'torcedor',
  'apaixonado',
  'especialista',
  'lenda',
] as const;

const actionArb: fc.Arbitrary<FanScoreAction> = fc.constantFrom(...FAN_SCORE_ACTIONS);

// An arbitrary data-driven Fan Score config. Points may be any finite value
// (including negative) so the test exercises the monotonicity guarantee even
// when the configuration is mis-tuned.
const configArb: fc.Arbitrary<FanScoreConfig> = fc.record({
  actionPoints: fc.record(
    Object.fromEntries(
      FAN_SCORE_ACTIONS.map((a) => [
        a,
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1000, max: 1000 }),
      ]),
    ) as Record<FanScoreAction, fc.Arbitrary<number>>,
  ) as fc.Arbitrary<Record<FanScoreAction, number>>,
  levelThresholds: fc.array(
    fc.record({
      level: fc.constantFrom(...FAN_LEVELS),
      min: fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 100000 }),
    }),
  ),
});

describe('Property 14: Fan_Score é monotônico não decrescente', () => {
  // Para todo Fan_Score inicial `score` e qualquer ação pontuável `action`,
  // `applyFanScore(score, action, cfg) >= score`. Nenhuma ação pontuável
  // reduz o Fan_Score.
  // Validates: Requirements 9.1, 9.2
  it('applying any action never decreases the score', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1000000 }),
        actionArb,
        configArb,
        (score, action, cfg) => {
          const next = applyFanScore(score, action, cfg);
          expect(next).toBeGreaterThanOrEqual(score);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 15: Nível_de_Torcedor é monotônico em relação ao Fan_Score', () => {
  // Para todos os valores de Fan_Score `a, b`, se `a <= b` então
  // `levelIndex(fanLevel(a, cfg)) <= levelIndex(fanLevel(b, cfg))`. O Nível de
  // Torcedor nunca decresce à medida que o Fan Score cresce.
  // Validates: Requirements 9.4, 9.5
  it('the supporter level never decreases as the Fan Score grows', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1000000 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1000000 }),
        configArb,
        (x, y, cfg) => {
          const a = Math.min(x, y);
          const b = Math.max(x, y);
          expect(levelIndex(fanLevel(a, cfg))).toBeLessThanOrEqual(
            levelIndex(fanLevel(b, cfg)),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
