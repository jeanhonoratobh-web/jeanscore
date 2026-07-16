/**
 * `useReducedMotion` — reactive `prefers-reduced-motion` preference.
 *
 * Lets components honour Requirement 30.7: when the user has requested reduced
 * motion, non-essential animations should be disabled (and state transitions
 * kept to at most 50ms). Built on {@link useMediaQuery}, so it reflects live
 * changes to the OS/browser preference without a reload.
 */
import { useMediaQuery } from './useMediaQuery';

/** Media query matching the reduced-motion accessibility preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reports whether the user prefers reduced motion (Requirement 30.7).
 *
 * @returns `true` when `prefers-reduced-motion: reduce` is active, so callers
 *   can suppress non-essential animations; `false` otherwise.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
