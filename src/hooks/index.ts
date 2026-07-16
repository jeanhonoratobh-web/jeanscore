/**
 * Hooks layer barrel.
 *
 * Reusable hooks (`useQuery`, `useCountdown`, `useDebounce`, `useMediaQuery`,
 * `useReducedMotion`) that build on the services + cache layers. Populated by
 * later tasks (11.x).
 */
export { useCountdown, computeCountdown } from './useCountdown';
export type { Countdown } from './useCountdown';
export { useDebounce } from './useDebounce';
export { useMediaQuery } from './useMediaQuery';
export { useReducedMotion } from './useReducedMotion';
export { useQuery, freshResult, staleResult } from './useQuery';
export type {
  QueryResult,
  QueryFetcher,
  UseQueryOptions,
  UseQueryResult,
} from './useQuery';
export { useReminders, selectNextFixture } from './useReminders';
export type { UseRemindersResult } from './useReminders';
