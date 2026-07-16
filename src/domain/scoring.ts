/**
 * Scoring domain module.
 *
 * Pure, framework-agnostic helpers for validating and aggregating player
 * scores (Avaliações). All values are plain numbers on the 0–10 scale with a
 * step of 0.5, so this module has no dependency on `types` or any other layer.
 *
 * @see Requirement 20.2 — notas no intervalo [0, 10] com incrementos de 0.5,
 *      normalizando valores fora do intervalo para o limite mais próximo.
 * @see Requirement 20.6 — média das Avaliações.
 * @see Requirement 26.1 — desvio padrão para a categoria "Mais Consistente".
 */

/** Lower bound of the valid score scale. */
const MIN_SCORE = 0;
/** Upper bound of the valid score scale. */
const MAX_SCORE = 10;
/** Granularity of a valid score. */
const STEP = 0.5;

/**
 * Normalizes an arbitrary numeric input into a valid score.
 *
 * The value is clamped into the `[0, 10]` range and then rounded to the
 * nearest multiple of `0.5`. Non-finite inputs (`NaN`, `±Infinity`) collapse to
 * the lower bound so the result is always a persistable score.
 *
 * The function is idempotent: `normalizeScore(normalizeScore(v)) === normalizeScore(v)`.
 *
 * @param value - Raw numeric input (e.g. from a form field or slider).
 * @returns A score `n` such that `0 <= n <= 10` and `n` is a multiple of `0.5`.
 *
 * @example
 * normalizeScore(7.3);   // 7.5
 * normalizeScore(-2);    // 0
 * normalizeScore(11);    // 10
 * normalizeScore(NaN);   // 0
 */
export function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_SCORE;
  }
  const clamped = Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));
  return Math.round(clamped / STEP) * STEP;
}

/**
 * Checks whether a numeric input is a valid score.
 *
 * A valid score is a finite number within the inclusive `[0, 10]` range. Values
 * outside the range (or non-finite values) are rejected and must not be
 * persisted as an Avaliação.
 *
 * @param value - Numeric input to validate.
 * @returns `true` when `value` lies within `[0, 10]`, otherwise `false`.
 *
 * @example
 * isValidScore(6.5);   // true
 * isValidScore(-0.5);  // false
 * isValidScore(10.5);  // false
 */
export function isValidScore(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

/**
 * Computes the arithmetic mean of a list of scores.
 *
 * The result is invariant to the order of the input and lies within
 * `[min(scores), max(scores)]`. An empty list yields `0`.
 *
 * @param scores - List of numeric scores.
 * @returns The average of the scores, or `0` when the list is empty.
 *
 * @example
 * calcAverage([6, 7, 8]);  // 7
 * calcAverage([]);         // 0
 */
export function calcAverage(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return sum / scores.length;
}

/**
 * Computes the population standard deviation of a list of scores.
 *
 * Used to rank the "Mais Consistente" (most consistent) players: a lower
 * deviation means more consistent scores. The result is always `>= 0` and is
 * exactly `0` when every score is equal. An empty list yields `0`.
 *
 * @param scores - List of numeric scores.
 * @returns The standard deviation of the scores, or `0` when the list is empty.
 *
 * @example
 * calcStdDev([5, 5, 5]);  // 0
 * calcStdDev([]);         // 0
 */
export function calcStdDev(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  const mean = calcAverage(scores);
  const variance =
    scores.reduce((acc, score) => acc + (score - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}
