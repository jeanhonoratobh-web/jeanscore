/**
 * Card rarity and rating derivation (pure, framework-agnostic).
 *
 * Implements the FIFA-style card visuals for the JeanScore squad: the rarity
 * band a player falls into (bronze/silver/gold/legendary) and the 0-99 rating
 * shown on the {@link Rarity} card, both derived solely from a player's season
 * average. This module lives in the pure `domain` layer and imports ONLY from
 * `types` — no React, DOM, services or network (Requirement 1.2).
 *
 * @see Requirements 15.2 (Raridade_Carta bands) and 15.3 (0-99 rating).
 */

import type { Rarity } from '../types/domain';

/** Season-average threshold at/above which a card becomes Prata (silver). */
const SILVER_MIN = 6;
/** Season-average threshold at/above which a card becomes Ouro (gold). */
const GOLD_MIN = 7;
/** Season-average threshold at/above which a card becomes Lendária (legendary). */
const LEGENDARY_MIN = 8;

/** Lowest possible card rating shown on a Carta_FIFA. */
const RATING_MIN = 0;
/** Highest possible card rating shown on a Carta_FIFA. */
const RATING_MAX = 99;
/** Upper bound of the season-average input domain. */
const SCORE_MAX = 10;

/**
 * Classifies a season average into a {@link Rarity} band (Requirement 15.2).
 *
 * Bands: Bronze (`avg < 6`), Prata/silver (`6 <= avg < 7`), Ouro/gold
 * (`7 <= avg < 8`) and Lendária/legendary (`avg >= 8`). A missing average
 * (`null`, i.e. a player with no ratings yet) defaults to `'bronze'`, the
 * lowest band.
 *
 * The mapping is deterministic (equal inputs always yield equal outputs) and
 * monotonic non-decreasing in rarity rank as `avg` grows (Property 3).
 *
 * @param avg - The player's season average in `[0, 10]`, or `null` when the
 *   player has not been rated yet.
 * @returns Exactly one rarity in `{ 'bronze', 'silver', 'gold', 'legendary' }`.
 */
export function calcRarity(avg: number | null): Rarity {
  if (avg === null || avg < SILVER_MIN) {
    return 'bronze';
  }
  if (avg < GOLD_MIN) {
    return 'silver';
  }
  if (avg < LEGENDARY_MIN) {
    return 'gold';
  }
  return 'legendary';
}

/**
 * Maps a season average in `[0, 10]` to an integer card rating in `[0, 99]`
 * (Requirement 15.3).
 *
 * The mapping hits both extremes (`0 -> 0`, `10 -> 99`) and is monotonic
 * non-decreasing: a higher average never produces a lower rating (Property 3).
 * Inputs are clamped to `[0, 10]` for robustness, and the result is always an
 * integer within `[0, 99]`.
 *
 * @param avg - The player's season average, expected in `[0, 10]`.
 * @returns An integer rating in `[0, 99]`.
 */
export function mapScoreToRating(avg: number): number {
  const clamped = Math.min(Math.max(avg, RATING_MIN), SCORE_MAX);
  const rating = Math.round((clamped / SCORE_MAX) * RATING_MAX);
  return Math.min(Math.max(rating, RATING_MIN), RATING_MAX);
}
