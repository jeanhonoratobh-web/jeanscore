/**
 * Integration tests for the main product flows (task 17.6).
 *
 * These tests wire the **real** provider stack — Theme is not needed for
 * behaviour so it is omitted, but i18n, Services, Auth and Toast are the real
 * providers — around either the exported route table (mounted through
 * {@link useRoutes} inside a {@link MemoryRouter}) or a real Page, injecting
 * **mocked Services** through {@link ServicesProvider}'s `services` prop so no
 * component is changed for testing (Requirement 5.4). They cover the three
 * flows called out by the task:
 *
 * 1. Authentication (Requirement 6.4): a successful login flows through the real
 *    {@link AuthService} → {@link AuthProvider} → {@link Navigation} chain and
 *    the header swaps from the login link to the authenticated greeting.
 * 2. Rating submission with Fan Score gain (Requirement 20.10): submitting the
 *    {@link AvaliarPage} form persists the scores (with the fixture context),
 *    awards the participation Fan Score and surfaces both the success and the
 *    gain feedback.
 * 3. Client-side navigation (Requirement 12.2): clicking a nav link swaps the
 *    routed page and updates the URL without a full reload.
 *
 * The Toast provider renders each queued toast as its raw {@link I18nKey} (the
 * rich visual Toast resolves the text), so toast assertions match on the key,
 * consistent with the existing router smoke tests.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useRoutes } from 'react-router-dom';
import { routes } from '@/router/routes';
import { AvaliarPage } from '@/pages/AvaliarPage';
import { AuthProvider } from '@/context/AuthContext';
import { ServicesProvider, type Services } from '@/context/ServicesContext';
import { ToastProvider } from '@/context/ToastContext';
import { I18nProvider } from '@/i18n/I18nProvider';
import { DEFAULT_FAN_SCORE_CONFIG } from '@/services';
import type { AuthService, Session, Unsubscribe } from '@/services';
import type { Result } from '@/types/supabase';
import type { Fixture, Lineup, Player } from '@/types/domain';

/**
 * Minimal in-memory {@link AuthService} double (mirrors the router smoke tests).
 *
 * Its constructor seeds the session {@link init} restores, so a test can start
 * as a Visitante (`null`) or an already-authenticated user. {@link login}
 * activates a real session and notifies subscribers, exercising the reactive
 * {@link AuthProvider} → header chain without a backend (Requirement 5.4).
 */
class FakeAuthService implements AuthService {
  private session: Session | null;
  private readonly listeners = new Set<(s: Session | null) => void>();

  constructor(private readonly restored: Session | null = null) {
    this.session = restored;
  }

  get currentUser(): Session | null {
    return this.session;
  }

  init(): void {
    this.set(this.restored);
  }

  async register(): Promise<Result<string>> {
    return { ok: true, data: 'ok' };
  }

  async login(username: string): Promise<Result<Session>> {
    const session: Session = { username, email: `${username}@x.com`, role: 'user' };
    this.set(session);
    return { ok: true, data: session };
  }

  logout(): void {
    this.set(null);
  }

  isLoggedIn(): boolean {
    return this.session !== null;
  }

  isAdmin(): boolean {
    return this.session?.role === 'admin';
  }

  onChange(listener: (s: Session | null) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(session: Session | null): void {
    this.session = session;
    for (const l of this.listeners) l(session);
  }
}

/** The mocked Services surface the tested Pages actually touch. */
interface FakeServices {
  auth: AuthService;
  squad: { getSquad: Mock };
  scores: { getAllGameScores: Mock; getUserScores: Mock; submitScores: Mock };
  fixtures: { getFixtures: Mock; getFixture: Mock; getLineup: Mock };
  fanScore: { awardAction: Mock; getConfig: Mock };
}

/**
 * Builds a fully-defaulted {@link FakeServices} whose reads resolve to empty
 * collections and whose writes succeed, so any Page renders without crashing.
 * Individual tests override the specific spies they assert on.
 */
function makeServices(auth: AuthService): FakeServices {
  return {
    auth,
    squad: { getSquad: vi.fn(async () => [] as Player[]) },
    scores: {
      getAllGameScores: vi.fn(async () => []),
      getUserScores: vi.fn(async () => new Map<string, number>()),
      submitScores: vi.fn(async () => ({ ok: true, succeeded: 0, failed: 0, errors: [] })),
    },
    fixtures: {
      getFixtures: vi.fn(async () => [] as Fixture[]),
      getFixture: vi.fn(async () => null),
      getLineup: vi.fn(async (id: string): Promise<Lineup> => ({ fixtureId: id, playerIds: [] })),
    },
    fanScore: {
      awardAction: vi.fn(async () => ({
        ok: true,
        data: {
          fanScore: 10,
          fanLevel: 'iniciante',
          previousLevel: 'iniciante',
          leveledUp: false,
        },
      })),
      getConfig: vi.fn(() => DEFAULT_FAN_SCORE_CONFIG),
    },
  };
}

/** Renders the live pathname so tests can assert where the Router settled. */
function LocationProbe(): JSX.Element {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

/** Resolves the exported route table via the classic router API. */
function AppRoutes(): ReactNode {
  return useRoutes(routes);
}

/**
 * Renders `ui` inside the full provider stack: Services (source of the mocked
 * backend and auth) → i18n → Toast → Auth → MemoryRouter at `initialPath`.
 */
function renderWithProviders(
  initialPath: string,
  ui: ReactNode,
  services: FakeServices,
): void {
  render(
    <ServicesProvider services={services as unknown as Services}>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={[initialPath]}>
              <LocationProbe />
              {ui}
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ServicesProvider>,
  );
}

/** Builds a squad {@link Player} with sensible defaults. */
function player(id: string, name: string, position: Player['position']): Player {
  return { id, name, position, number: null, nationality: null, photo: null };
}

describe('Main flows (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authentication: logging in swaps the header to the authenticated greeting (Requirement 6.4)', async () => {
    const auth = new FakeAuthService(null); // Visitante
    const services = makeServices(auth);

    renderWithProviders('/elenco', <AppRoutes />, services);

    // The Elenco page (a light route) resolves through the real route table.
    // The route Page is code-split (React.lazy), so allow extra time for the
    // chunk to resolve when the whole suite compiles under load.
    expect(
      await screen.findByRole('heading', { name: 'Elenco' }, { timeout: 15000 }),
    ).toBeInTheDocument();
    // As a Visitante the header shows the login link, not a greeting.
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();

    // Log in through the real AuthService; the AuthProvider subscription keeps
    // the header reactive (Requirements 6.4, 6.10).
    await act(async () => {
      await auth.login('torcedor');
    });

    // The header now greets the authenticated user and the login link is gone.
    expect(await screen.findByText('Olá, torcedor')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('rating: submitting scores persists them with context and awards Fan Score (Requirements 20.10, 9.2)', async () => {
    const session: Session = { username: 'torcedor', email: 'torcedor@x.com', role: 'user' };
    const auth = new FakeAuthService(session);
    const services = makeServices(auth);

    const fixture: Fixture = {
      id: 'f1',
      homeTeam: 'Cruzeiro',
      awayTeam: 'Flamengo',
      homeScore: 2,
      awayScore: 1,
      fixtureDate: '2025-03-10',
      ts: 0,
      competition: 71,
      stadium: 'Mineirão',
      status: 'finished',
      liberado: true,
    };
    const squad = [
      player('p1', 'Cássio', 'Goalkeeper'),
      player('p2', 'Matheus Pereira', 'Midfielder'),
    ];

    services.fixtures.getFixture = vi.fn(async () => fixture);
    services.fixtures.getLineup = vi.fn(async (): Promise<Lineup> => ({
      fixtureId: 'f1',
      playerIds: ['p1', 'p2'],
    }));
    services.squad.getSquad = vi.fn(async () => squad);
    services.scores.getUserScores = vi.fn(async () => new Map<string, number>());
    const submitScores = vi.fn(async () => ({
      ok: true,
      succeeded: 2,
      failed: 0,
      errors: [],
    }));
    services.scores.submitScores = submitScores;
    const awardAction = vi.fn(async () => ({
      ok: true,
      data: {
        fanScore: 10,
        fanLevel: 'iniciante',
        previousLevel: 'iniciante',
        leveledUp: false,
      },
    }));
    services.fanScore.awardAction = awardAction;

    renderWithProviders('/', <AvaliarPage fixtureId="f1" />, services);

    // The rating form renders one input per lineup player once data resolves.
    expect(await screen.findByText('Cássio')).toBeInTheDocument();
    const submit = await screen.findByRole('button', { name: 'Enviar avaliações' });

    await act(async () => {
      submit.click();
    });

    // Scores are persisted for the fixture, by the authenticated user, with the
    // fixture context recorded on every row (Requirement 20.10).
    await waitFor(() => expect(submitScores).toHaveBeenCalledTimes(1));
    const [fixtureId, entries, user, ctx] = submitScores.mock.calls[0] as unknown as [
      string,
      Array<{ playerId: string; playerName: string; score: number }>,
      string,
      { homeTeam: string; awayTeam: string; fixtureDate: string },
    ];
    expect(fixtureId).toBe('f1');
    expect(user).toBe('torcedor');
    expect(entries.map((e) => e.playerId)).toEqual(['p1', 'p2']);
    expect(ctx).toEqual({
      homeTeam: 'Cruzeiro',
      awayTeam: 'Flamengo',
      fixtureDate: '2025-03-10',
    });

    // The participation Fan Score is awarded for the rating action (Req 9.2).
    await waitFor(() => expect(awardAction).toHaveBeenCalledWith('torcedor', 'rate_match'));

    // Both the success confirmation and the Fan Score gain are surfaced.
    expect(await screen.findByText('rate.success')).toBeInTheDocument();
    expect(await screen.findByText('fanScore.gain')).toBeInTheDocument();
  });

  it('navigation: clicking a nav link swaps the page and URL without a reload (Requirement 12.2)', async () => {
    const auth = new FakeAuthService(null);
    const services = makeServices(auth);

    renderWithProviders('/elenco', <AppRoutes />, services);

    // Start on the Elenco route (code-split Page, allow extra load time).
    expect(
      await screen.findByRole('heading', { name: 'Elenco' }, { timeout: 15000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/elenco');

    // Click the "Jogos" link in the persistent header (client-side navigation).
    const nav = screen.getByRole('navigation');
    await act(async () => {
      within(nav).getByRole('link', { name: 'Jogos' }).click();
    });

    // The Jogos page is now mounted, the URL reflects it, and the previous
    // page's heading is gone — all without a full-page reload.
    expect(
      await screen.findByRole('heading', { name: 'Jogos' }, { timeout: 15000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/jogos');
    expect(screen.queryByRole('heading', { name: 'Elenco' })).not.toBeInTheDocument();
  });
});
