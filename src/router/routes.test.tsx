/**
 * Router smoke tests (task 12.3).
 *
 * Exercises the client-side Router for its three access outcomes, using an
 * in-memory history ({@link MemoryRouter}) so navigation runs entirely in jsdom
 * without a real browser:
 *
 * - An unauthenticated visit to a `requireAuth` route (`/perfil`) is denied and
 *   redirected to the login form (Requirement 12.7).
 * - A non-admin visit to `/admin` is denied, redirected to `/`, and surfaces
 *   the "Acesso restrito a administradores." toast (Requirement 12.6).
 * - An unknown route (`/does-not-exist`) resolves to the 404 {@link
 *   NotFoundPage} via the catch-all `*` route (Requirement 12.5).
 *
 * The `/perfil` and unknown-route cases mount the **exported `routes`** table
 * (via {@link useRoutes}), so the real route mapping, `requireAuth` guard and
 * lazy 404 Page are all verified end to end. The `/admin` denial redirects to
 * `/`, whose real `HomePage` is a heavy composition over many Services; per the
 * task guidance, that guard is instead exercised through the real {@link
 * ProtectedRoute} + {@link requireAdmin} guard with a lightweight sentinel
 * target, keeping the test focused on the guard decision and its toast.
 *
 * Navigation is driven through the classic (non-data) router API on purpose:
 * `createMemoryRouter` uses `fetch`/`AbortSignal` internally, which the Node
 * test runtime rejects during a redirect. `MemoryRouter` + `useRoutes` resolves
 * the same route descriptors without that machinery.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useRoutes,
} from 'react-router-dom';
import { routes } from './routes';
import { ProtectedRoute } from './ProtectedRoute';
import { requireAdmin } from './guards';
import { AuthProvider } from '@/context/AuthContext';
import { ServicesProvider, type Services } from '@/context/ServicesContext';
import { ToastProvider } from '@/context/ToastContext';
import { I18nProvider } from '@/i18n/I18nProvider';
import type { AuthService, Session, Unsubscribe } from '@/services';
import type { Result } from '@/types/supabase';

/**
 * Minimal in-memory {@link AuthService} double. Its constructor seeds the
 * session {@link init} restores, letting each test start as a Visitante, a
 * regular Usuário_Autenticado, or an Admin without any real backend
 * (Requirement 5.4).
 */
class FakeAuthService implements AuthService {
  private session: Session | null;
  private readonly listeners = new Set<(s: Session | null) => void>();

  constructor(private readonly restored: Session | null = null) {
    // Seed synchronously so `currentUser` is already populated on the first
    // render: AuthProvider reads it in its useState initializer, so a restored
    // (e.g. admin) session is visible to guards on first paint — before any
    // effect runs — avoiding a transient unauthenticated redirect.
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

/** Wraps a bare {@link AuthService} into the {@link Services} shape guards need. */
function makeServices(auth: AuthService): Services {
  return { auth } as unknown as Services;
}

/**
 * Renders `ui` at `initialPath` inside the full provider stack the Router
 * depends on: Services (source of the auth backend) → i18n (toast/404 text) →
 * Toast (guard denials) → Auth (the guards' source of truth) → MemoryRouter.
 * A {@link LocationProbe} exposes the current pathname for assertions.
 */
function renderAt(initialPath: string, ui: ReactNode, auth: AuthService): void {
  render(
    <ServicesProvider services={makeServices(auth)}>
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

/** Renders the live pathname so tests can assert where the Router settled. */
function LocationProbe(): JSX.Element {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

/** Resolves the exported route table via the classic router API. */
function AppRoutes(): ReactNode {
  return useRoutes(routes);
}

describe('Router guards and 404 (smoke)', () => {
  it('redirects an unauthenticated visit to /perfil to the login form (Requirement 12.7)', async () => {
    const auth = new FakeAuthService(null); // Visitante
    renderAt('/perfil', <AppRoutes />, auth);

    // requireAuth denies before the (lazy) PerfilPage mounts and sends the user
    // to /login, which is unmapped here and therefore resolves to the 404 Page.
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Página não encontrada' },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    // The guard surfaces its explanatory pt-BR toast (Requirement 12.7).
    expect(screen.getByText('guard.authRequired')).toBeInTheDocument();
  });

  it('renders the 404 NotFoundPage for an unknown route (Requirement 12.5)', async () => {
    const auth = new FakeAuthService(null);
    renderAt('/does-not-exist', <AppRoutes />, auth);

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Página não encontrada' },
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    // The catch-all does not rewrite the URL — it stays on the requested path.
    expect(screen.getByTestId('location')).toHaveTextContent('/does-not-exist');
  });

  it('redirects a non-admin away from /admin to / with the restricted toast (Requirement 12.6)', () => {
    const auth = new FakeAuthService(null); // non-admin (Visitante)

    // A lightweight sentinel stands in for the heavy HomePage at "/", so the
    // test isolates the guard decision and its toast rather than mounting the
    // real landing composition.
    renderAt(
      '/admin',
      <Routes>
        <Route path="/" element={<div>home-sentinel</div>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute guards={[requireAdmin]}>
              <div>admin-only</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      auth,
    );

    // Redirected to home; protected content never rendered.
    expect(screen.getByText('home-sentinel')).toBeInTheDocument();
    expect(screen.queryByText('admin-only')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    // The denial surfaces the "restricted" toast key (Requirement 12.6).
    expect(screen.getByText('guard.adminOnly')).toBeInTheDocument();
  });

  it('allows an admin to reach /admin (Requirement 12.6)', () => {
    const admin: Session = { username: 'root', email: 'root@x.com', role: 'admin' };
    const auth = new FakeAuthService(admin);

    renderAt(
      '/admin',
      <Routes>
        <Route path="/" element={<div>home-sentinel</div>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute guards={[requireAdmin]}>
              <div>admin-only</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      auth,
    );

    expect(screen.getByText('admin-only')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin');
  });
});
