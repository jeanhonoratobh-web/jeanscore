/**
 * Services context (`context/ServicesContext.tsx`).
 *
 * Instantiates **every** data-access Service exactly once, wiring each with a
 * shared {@link SupabaseClient} and {@link Cache} injected through its
 * constructor, and exposes them to the component tree via {@link useServices}
 * (Requirements 1.5, 5.4).
 *
 * Because the whole set is provided as a single context value, tests (and future
 * alternative backends) can supply mocked Services through the provider's
 * `services` prop without changing any consuming component (Requirement 5.4).
 * The `supabase` and `cache` props allow overriding only the shared
 * dependencies while still building the real Services.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  AchievementService,
  CraqueService,
  FanScoreService,
  FixtureService,
  LocalAuthService,
  PredictionService,
  ScoreService,
  SquadService,
  UserProfileService,
  UserService,
  createSupabaseClient,
  type AuthService,
  type SupabaseClient,
} from '@/services';
import { MemoryCache, type Cache } from '@/services/cache';

/**
 * Aggregates a single instance of every application Service.
 *
 * Consumers read this shape from {@link useServices}. Each field is one Service,
 * all sharing the same injected {@link SupabaseClient} and {@link Cache} so the
 * cache and stale-fallback behaviour is consistent across the app.
 */
export interface Services {
  /** Squad (players) reads and admin writes. */
  readonly squad: SquadService;
  /** Fixtures, lineups and match availability. */
  readonly fixtures: FixtureService;
  /** Per-match ratings and permanent (yearly) scores. */
  readonly scores: ScoreService;
  /** User accounts, status and roles. */
  readonly users: UserService;
  /** Authenticated user profiles, activity and timeline. */
  readonly userProfiles: UserProfileService;
  /** Fan Score accrual and supporter levels. */
  readonly fanScore: FanScoreService;
  /** Data-driven achievements catalog and unlocks. */
  readonly achievements: AchievementService;
  /** "Craque da Partida" (Man of the Match) voting. */
  readonly craque: CraqueService;
  /** Pre-match predictions (Palpites). */
  readonly predictions: PredictionService;
  /** Authentication / session management (swappable backend). */
  readonly auth: AuthService;
}

/**
 * Builds the full {@link Services} set from shared dependencies.
 *
 * Services are constructed once and wired with the same `supa` client and
 * `cache` instance (Requirements 1.5, 5.4). {@link PredictionService} also
 * receives the shared {@link FixtureService} it depends on for kickoff locking.
 *
 * @param supa Shared, typed Supabase REST client.
 * @param cache Shared in-memory cache backing reads and the stale fallback.
 * @returns A fully wired {@link Services} instance.
 */
export function createServices(supa: SupabaseClient, cache: Cache): Services {
  const fixtures = new FixtureService(supa, cache);
  return {
    squad: new SquadService(supa, cache),
    fixtures,
    scores: new ScoreService(supa, cache),
    users: new UserService(supa, cache),
    userProfiles: new UserProfileService(supa, cache),
    fanScore: new FanScoreService(supa, cache),
    achievements: new AchievementService(supa, cache),
    craque: new CraqueService(supa, cache),
    predictions: new PredictionService(supa, cache, fixtures),
    auth: new LocalAuthService(supa),
  };
}

/**
 * Context holding the single {@link Services} instance.
 *
 * Defaults to `null` so {@link useServices} can detect (and reject) usage
 * outside a {@link ServicesProvider}.
 */
const ServicesContext = createContext<Services | null>(null);

/** Props accepted by {@link ServicesProvider}. */
export interface ServicesProviderProps {
  /** Subtree that gains access to the Services. */
  children: ReactNode;
  /**
   * Pre-built Services to inject. When provided (e.g. in tests) it is used as-is
   * and no real client/cache is created, enabling mocks without touching
   * components (Requirement 5.4).
   */
  services?: Services;
  /**
   * Shared Supabase client override used when `services` is not supplied.
   * Defaults to {@link createSupabaseClient} (reads Vite env vars).
   */
  supabase?: SupabaseClient;
  /**
   * Shared cache override used when `services` is not supplied. Defaults to a
   * fresh {@link MemoryCache}.
   */
  cache?: Cache;
}

/**
 * Provides a single, memoized {@link Services} instance to its subtree.
 *
 * In production it builds the Services from a shared {@link SupabaseClient} and
 * {@link MemoryCache}; in tests, pass a `services` value to inject mocks
 * (Requirement 5.4). The instance is memoized so Services are created once and
 * remain stable across re-renders.
 */
export function ServicesProvider({
  children,
  services,
  supabase,
  cache,
}: ServicesProviderProps): JSX.Element {
  const value = useMemo<Services>(
    () =>
      services ??
      createServices(supabase ?? createSupabaseClient(), cache ?? new MemoryCache()),
    [services, supabase, cache],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

/**
 * Returns the shared {@link Services} instance.
 *
 * @throws Error when called outside a {@link ServicesProvider}.
 * @returns The aggregated {@link Services}.
 */
export function useServices(): Services {
  const value = useContext(ServicesContext);
  if (value === null) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return value;
}
