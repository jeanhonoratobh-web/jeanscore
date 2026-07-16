/**
 * Route table (`router/routes.tsx`).
 *
 * Declarative mapping of every application URL to its Page, built on
 * `createBrowserRouter` (Requirement 12.1). Each Page is loaded through
 * `React.lazy`, so Vite emits a separate chunk per route and the code is
 * fetched on demand (Requirements 1.10, 12). While a chunk loads, a
 * {@link Skeleton} is shown via `Suspense` so the layout is reserved instead of
 * flashing blank (Requirement 1.8).
 *
 * Access control is expressed by wrapping protected elements in
 * {@link ProtectedRoute} with a list of parameterizable {@link Guard}s:
 * `requireAuth` gates `/perfil`, `/avaliar` and `/onboarding` (Requirements
 * 8.10, 20.8); `requireAdmin` gates `/admin` (Requirement 12.6). Adding a new
 * protection is a matter of listing another guard here — no Router rewrite
 * (Requirement 5.2).
 *
 * Every route is nested under a single parent layout route whose element is the
 * {@link AppShell}: it renders the persistent {@link Navigation} header and a
 * `<main>` landmark hosting the matched child via `<Outlet />`. The header
 * therefore stays mounted across navigations, keeping the authenticated user's
 * name and the active link visible (Requirements 6.10, 12.8) while the page body
 * swaps without a reload.
 *
 * A catch-all (`*`) renders the 404 Page (Requirement 12.5). Native browser
 * history (Back/Forward, `popstate`) is handled by React Router, which restores
 * the previous content — including a prior 404 — without a page reload
 * (Requirements 12.2, 12.3, 12.4). The active navigation link is reflected by
 * `NavLink` in the `Navigation` component (Requirement 12.8).
 *
 * The router `basename` is derived from `import.meta.env.BASE_URL` so clean URLs
 * (`/jogador/:id`) resolve correctly under the GitHub Pages subpath
 * (Requirement 1.1).
 *
 * NOTE: `PerfilPage` does not exist yet. Until its own task lands,
 * `/perfil(/:username)` renders {@link NotFoundPage} as a safe, type-checked
 * placeholder so the route table compiles and navigation stays functional.
 */
import {
  Suspense,
  lazy,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/feedback';
import type { NotFoundVariant } from '@/pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { requireAdmin, requireAuth, type Guard } from './guards';

/**
 * Wraps a named-export module import so it satisfies `React.lazy`, which
 * requires a module whose `default` is the component.
 *
 * @param loader - Dynamic import returning the module.
 * @param pick - Selects the named component from the loaded module.
 * @returns A lazily-loaded component that emits its own chunk.
 */
function lazyNamed<M, P>(
  loader: () => Promise<M>,
  pick: (module: M) => ComponentType<P>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => ({ default: pick(await loader()) }));
}

// Existing Pages — one dynamic import each so Vite splits them per route.
const HomePage = lazyNamed(() => import('@/pages/HomePage'), (m) => m.HomePage);
const ElencoPage = lazyNamed(() => import('@/pages/ElencoPage'), (m) => m.ElencoPage);
const PlayerProfilePage = lazyNamed(
  () => import('@/pages/PlayerProfilePage'),
  (m) => m.PlayerProfilePage,
);
const CompararPage = lazyNamed(() => import('@/pages/CompararPage'), (m) => m.CompararPage);
const JogosPage = lazyNamed(() => import('@/pages/JogosPage'), (m) => m.JogosPage);
const MatchDetailPage = lazyNamed(
  () => import('@/pages/MatchDetailPage'),
  (m) => m.MatchDetailPage,
);
const RankingsPage = lazyNamed(() => import('@/pages/RankingsPage'), (m) => m.RankingsPage);
const TimeDoMesPage = lazyNamed(() => import('@/pages/TimeDoMesPage'), (m) => m.TimeDoMesPage);
const ColecoesPage = lazyNamed(() => import('@/pages/ColecoesPage'), (m) => m.ColecoesPage);
const PerfilPage = lazyNamed(() => import('@/pages/PerfilPage'), (m) => m.PerfilPage);
const AvaliarPage = lazyNamed(() => import('@/pages/AvaliarPage'), (m) => m.AvaliarPage);
const OnboardingPage = lazyNamed(() => import('@/pages/OnboardingPage'), (m) => m.OnboardingPage);
const AdminPage = lazyNamed(() => import('@/pages/AdminPage'), (m) => m.AdminPage);
const NotFoundPage = lazyNamed(() => import('@/pages/NotFoundPage'), (m) => m.NotFoundPage);

/**
 * Renders the 404 Page for a given variant. Used both for the catch-all `*`
 * route and as a temporary placeholder for Pages not yet implemented
 * (`/jogo/:id`, `/perfil`).
 *
 * @param variant - Which "not found" message to show (defaults to `'page'`).
 * @returns The lazily-loaded 404 Page element.
 */
function notFound(variant: NotFoundVariant = 'page'): ReactNode {
  return <NotFoundPage variant={variant} />;
}

/**
 * Wraps a route element in a `Suspense` boundary whose fallback is a
 * shape-preserving {@link Skeleton}, so a route's chunk can load without
 * blanking the view (Requirement 1.8).
 *
 * @param node - The (lazy) route element.
 * @returns The element wrapped in a `Suspense` boundary.
 */
function withSuspense(node: ReactNode): ReactNode {
  return <Suspense fallback={<Skeleton shape="card" />}>{node}</Suspense>;
}

/**
 * Wraps a route element in {@link ProtectedRoute} with the supplied guards and a
 * `Suspense` boundary, so guard evaluation and lazy loading compose cleanly.
 *
 * @param guards - Guards that must all allow access.
 * @param node - The (lazy) route element to protect.
 * @returns The guarded, suspense-wrapped element.
 */
function guarded(guards: readonly Guard[], node: ReactNode): ReactNode {
  return (
    <ProtectedRoute guards={guards}>{withSuspense(node)}</ProtectedRoute>
  );
}

/**
 * The application route definitions (Requirement 12.1).
 *
 * Exported for reuse in tests and for `createBrowserRouter` below.
 */
export const routes: RouteObject[] = [
  {
    // Layout route: the persistent app shell (header + <main><Outlet/></main>)
    // wrapping every page, so navigation swaps only the child (Requirements
    // 6.10, 12.8).
    element: <AppShell />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: 'elenco', element: withSuspense(<ElencoPage />) },
      { path: 'jogador/:id', element: withSuspense(<PlayerProfilePage />) },
      { path: 'comparar', element: withSuspense(<CompararPage />) },
      { path: 'jogos', element: withSuspense(<JogosPage />) },
      { path: 'jogo/:id', element: withSuspense(<MatchDetailPage />) },
      { path: 'rankings', element: withSuspense(<RankingsPage />) },
      { path: 'time-do-mes', element: withSuspense(<TimeDoMesPage />) },
      { path: 'colecoes', element: withSuspense(<ColecoesPage />) },
      // User profile — auth-guarded (Requirement 8.10).
      { path: 'perfil', element: guarded([requireAuth], <PerfilPage />) },
      { path: 'perfil/:username', element: guarded([requireAuth], <PerfilPage />) },
      { path: 'avaliar', element: guarded([requireAuth], <AvaliarPage />) },
      { path: 'avaliar/:fixtureId', element: guarded([requireAuth], <AvaliarPage />) },
      { path: 'onboarding', element: guarded([requireAuth], <OnboardingPage />) },
      { path: 'admin', element: guarded([requireAdmin], <AdminPage />) },
      // Catch-all: any unmapped route renders the generic 404 (Requirement 12.5).
      { path: '*', element: withSuspense(notFound('page')) },
    ],
  },
];

/**
 * Router `basename` derived from the Vite base path.
 *
 * `import.meta.env.BASE_URL` carries a trailing slash (e.g. `/jeanscore/`);
 * React Router expects a basename without a trailing slash, so it is trimmed
 * (while preserving the root `/`).
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/**
 * The configured browser router for the application, resolving clean URLs under
 * the GitHub Pages subpath (Requirements 1.1, 12).
 */
export const router = createBrowserRouter(routes, { basename });
