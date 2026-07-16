/**
 * Property-based tests for the Achievement evaluation domain module
 * (`domain/achievements.ts`).
 *
 * Coverage (per the design's testing table): Property 17.
 * Each property lives in its own `describe` block so additional properties can
 * be appended independently without touching the existing blocks.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateAchievements, type AchievementContext } from './achievements';
import type { Achievement, AchievementDef, Position } from '../types/domain';
import type { I18nKey } from '../i18n/keys';
import type { AchievementConditionType } from '../types/config';

// Every player field position (Requirement 10.2 `position_specialist`).
const POSITIONS: readonly Position[] = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Attacker',
] as const;

// Every data-driven condition kind (Requirement 10.1).
const CONDITION_TYPES: readonly AchievementConditionType[] = [
  'total_ratings',
  'competition_complete',
  'position_specialist',
  'full_season',
  'veteran',
] as const;

// A small shared pool of ids so unlocked-state entries and catalog entries
// overlap frequently, exercising the "already unlocked" idempotency path.
const idArb: fc.Arbitrary<string> = fc.constantFrom(
  'a1',
  'a2',
  'a3',
  'a4',
  'a5',
);

// i18n keys are opaque to the evaluator; a placeholder cast keeps the test
// focused on the unlock logic rather than the key catalog.
const i18nKeyArb: fc.Arbitrary<I18nKey> = fc.constant('placeholder' as I18nKey);

// An arbitrary data-driven condition. All optional scoping fields are always
// populated so any generated condition is well-formed for its kind.
const conditionArb = fc.record({
  type: fc.constantFrom(...CONDITION_TYPES),
  threshold: fc.integer({ min: 0, max: 200 }),
  position: fc.constantFrom(...POSITIONS),
  competition: fc.integer({ min: 1, max: 5 }),
});

// An arbitrary catalog entry.
const defArb: fc.Arbitrary<AchievementDef> = fc.record({
  id: idArb,
  titleKey: i18nKeyArb,
  descriptionKey: i18nKeyArb,
  condition: conditionArb,
});

// A catalog. Entries may share ids (the pool is intentionally small) so the
// evaluator's id-indexing and de-duplication are exercised.
const defsArb: fc.Arbitrary<AchievementDef[]> = fc.array(defArb, { maxLength: 8 });

// An arbitrary current unlock-state entry: either pending (null) or unlocked.
const achievementArb: fc.Arbitrary<Achievement> = fc.record({
  id: idArb,
  unlockedAt: fc.option(
    fc.constant('2024-01-01T00:00:00.000Z'),
    { nil: null },
  ),
});

// An arbitrary evaluation context covering every stat field.
const contextArb: fc.Arbitrary<AchievementContext> = fc.record({
  unlocked: fc.uniqueArray(achievementArb, {
    maxLength: 5,
    selector: (a) => a.id,
  }),
  totalRatings: fc.integer({ min: 0, max: 300 }),
  completedCompetitions: fc.uniqueArray(fc.integer({ min: 1, max: 5 }), {
    maxLength: 5,
  }),
  positionRatings: fc.record(
    Object.fromEntries(
      POSITIONS.map((p) => [p, fc.integer({ min: 0, max: 300 })]),
    ) as Record<Position, fc.Arbitrary<number>>,
  ) as fc.Arbitrary<Partial<Record<Position, number>>>,
  fullSeason: fc.boolean(),
  tenureDays: fc.integer({ min: 0, max: 5000 }),
});

describe('Property 17: Desbloqueio de Conquista é idempotente', () => {
  // Para todo estado de Conquistas `state` e catálogo `defs`, reavaliar as
  // Conquistas de um Usuário que já as desbloqueou não altera o conjunto
  // desbloqueado nem o duplica:
  //   evaluateAchievements(evaluateAchievements(state, defs), defs)
  //     ≡ evaluateAchievements(state, defs)
  // Validates: Requirements 10.6
  it('re-evaluating the result yields an equal context (no duplicates, unlockedAt preserved)', () => {
    fc.assert(
      fc.property(
        contextArb,
        defsArb,
        // Two distinct timestamps prove idempotency holds regardless of `now`:
        // a re-evaluation must not re-stamp already-unlocked achievements.
        fc.constant('2024-06-01T12:00:00.000Z'),
        fc.constant('2025-06-01T12:00:00.000Z'),
        (ctx, defs, now1, now2) => {
          const once = evaluateAchievements(ctx, defs, now1);
          const twice = evaluateAchievements(once, defs, now2);

          // Idempotent: second evaluation equals the first.
          expect(twice).toEqual(once);

          // No duplicate unlocks: each id appears at most once.
          const ids = twice.unlocked.map((a) => a.id);
          expect(new Set(ids).size).toBe(ids.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
