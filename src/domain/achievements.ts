/**
 * Achievement evaluation (pure, framework-agnostic).
 *
 * Implements the data-driven, idempotent unlocking of Conquistas: given a
 * catalog of {@link AchievementDef} entries and an {@link AchievementContext}
 * (the user's already-unlocked achievements plus the participation stats needed
 * to test each condition), it returns an updated context whose `unlocked` set
 * reflects every achievement whose condition is now satisfied.
 *
 * The evaluation is **data-driven** (Requirement 10.1): conditions are
 * interpreted from {@link AchievementCondition} data, so new {@link AchievementDef}
 * entries that reuse an existing {@link AchievementConditionType} are added by
 * configuration alone, with no changes to this logic.
 *
 * The evaluation is **idempotent** (Requirement 10.6, Property 17): an
 * already-unlocked achievement is never duplicated nor re-emitted, and
 * `evaluateAchievements(evaluateAchievements(ctx, defs), defs)` is equivalent to
 * `evaluateAchievements(ctx, defs)`. Idempotency holds regardless of the `now`
 * timestamp because a re-evaluation finds every satisfied achievement already
 * unlocked and leaves its original `unlockedAt` untouched.
 *
 * This module lives in the pure `domain` layer and imports ONLY from `types` —
 * no React, DOM, services or network (Requirement 1.2).
 *
 * @see Requirements 10.1 (data-driven), 10.6 / Property 17 (idempotent unlock).
 */

import type { Achievement, AchievementDef, Position } from '../types/domain';
import type { AchievementConditionType } from '../types/config';

/**
 * The participation stats and current unlock state used to evaluate the
 * achievement catalog for a single user.
 *
 * `AchievementContext` doubles as both the input and the output of
 * {@link evaluateAchievements}: the function reads the stats and the current
 * {@link unlocked} set and returns a context whose {@link unlocked} set has been
 * extended with any newly satisfied achievements. Carrying the unlock state in
 * the context is what makes the function composable and idempotent
 * (Requirement 10.6, Property 17).
 *
 * The stat fields cover every {@link AchievementConditionType}:
 *   - `total_ratings`        -> {@link totalRatings}
 *   - `competition_complete` -> {@link completedCompetitions}
 *   - `position_specialist`  -> {@link positionRatings}
 *   - `full_season`          -> {@link fullSeason}
 *   - `veteran`              -> {@link tenureDays}
 */
export interface AchievementContext {
  /**
   * The achievements already recorded for the user. An entry is considered
   * unlocked when its `unlockedAt` is non-null (Requirement 10.4). This set is
   * the source of idempotency: satisfied achievements already present here are
   * never re-emitted or duplicated.
   */
  unlocked: Achievement[];
  /** Total number of ratings the user has submitted (`total_ratings`). */
  totalRatings: number;
  /**
   * Competition ids for which the user has rated every match
   * (`competition_complete`).
   */
  completedCompetitions: number[];
  /**
   * Number of players the user has rated per position (`position_specialist`).
   * Missing positions count as `0`.
   */
  positionRatings: Partial<Record<Position, number>>;
  /** Whether the user participated across a full season (`full_season`). */
  fullSeason: boolean;
  /** Days of community tenure since sign-up (`veteran`). */
  tenureDays: number;
}

/**
 * Tests whether a single achievement definition's condition is satisfied by the
 * given context. Interprets the {@link AchievementConditionType} data-driven
 * rule; any unrecognised type is treated as not satisfied.
 *
 * @param def - The achievement definition whose condition is tested.
 * @param ctx - The evaluation context with the user's participation stats.
 * @returns `true` when the condition is met by {@link ctx}.
 */
function isConditionMet(def: AchievementDef, ctx: AchievementContext): boolean {
  const { condition } = def;
  const type: AchievementConditionType = condition.type;

  switch (type) {
    case 'total_ratings':
      return ctx.totalRatings >= (condition.threshold ?? 1);

    case 'competition_complete':
      return (
        condition.competition != null &&
        ctx.completedCompetitions.includes(condition.competition)
      );

    case 'position_specialist':
      return (
        condition.position != null &&
        (ctx.positionRatings[condition.position] ?? 0) >= (condition.threshold ?? 1)
      );

    case 'full_season':
      return ctx.fullSeason === true;

    case 'veteran':
      return condition.threshold != null && ctx.tenureDays >= condition.threshold;

    default:
      return false;
  }
}

/**
 * Evaluates the achievement catalog against a user's context and returns an
 * updated context with any newly satisfied achievements unlocked
 * (Requirements 10.1, 10.6).
 *
 * Behaviour:
 *   - **Data-driven**: each {@link AchievementDef} is unlocked purely from its
 *     {@link AchievementCondition}; adding catalog entries needs no code change
 *     (Requirement 10.1).
 *   - **Idempotent**: an achievement already unlocked in `ctx.unlocked` keeps
 *     its original `unlockedAt` and is never duplicated; re-running the function
 *     on its own output yields an equal result (Requirement 10.6, Property 17).
 *   - Newly unlocked achievements are appended in catalog order with
 *     `unlockedAt = now`.
 *   - Pending entries (`unlockedAt === null`) in the incoming set whose
 *     condition is now met are promoted in place to unlocked.
 *
 * @param ctx - The user's current unlock state and participation stats.
 * @param defs - The data-driven achievement catalog.
 * @param now - ISO timestamp stamped on newly unlocked achievements. Pass an
 *   explicit value for deterministic results; defaults to the current time.
 * @returns A new {@link AchievementContext} with the updated {@link AchievementContext.unlocked} set.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  defs: AchievementDef[],
  now: string = new Date().toISOString(),
): AchievementContext {
  // Index existing entries by id so already-unlocked ones are preserved as-is
  // and pending ones can be promoted in place (idempotency, Property 17).
  const byId = new Map<string, Achievement>();
  for (const entry of ctx.unlocked) {
    byId.set(entry.id, entry);
  }

  const result: Achievement[] = ctx.unlocked.map((entry) => ({ ...entry }));

  for (const def of defs) {
    const existing = byId.get(def.id);

    // Already unlocked: never re-emit, re-stamp or duplicate (Requirement 10.6).
    if (existing && existing.unlockedAt !== null) {
      continue;
    }

    if (!isConditionMet(def, ctx)) {
      continue;
    }

    if (existing) {
      // Promote an existing pending entry in place.
      const idx = result.findIndex((a) => a.id === def.id);
      if (idx >= 0) {
        result[idx] = { ...result[idx], unlockedAt: now };
      }
    } else {
      // Append a freshly unlocked achievement.
      const unlockedEntry: Achievement = { id: def.id, unlockedAt: now };
      result.push(unlockedEntry);
      byId.set(def.id, unlockedEntry);
    }
  }

  return { ...ctx, unlocked: result };
}
