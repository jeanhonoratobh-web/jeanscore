/**
 * Route guards (`router/guards.ts`).
 *
 * Parameterizable, framework-agnostic access rules for the client-side Router
 * (Requirements 1.4, 5.2). A {@link Guard} is a pure function of the reactive
 * {@link AuthContextValue}: it inspects the `isLoggedIn` / `isAdmin` flags and
 * returns a {@link GuardResult} that either allows the navigation or asks the
 * Router to redirect (optionally surfacing a pt-BR toast). Guards never touch
 * the {@link AuthService} directly, never read `localStorage`, and never import
 * from `react-router-dom` — the `ProtectedRoute` component (task 12.2) is what
 * consumes a list of guards, applies them, and performs the actual
 * `<Navigate />` plus toast.
 *
 * Keeping guards as plain data-returning functions is what makes them
 * parameterizable and future-proof: adding a new protection (for example the
 * upcoming {@link requirePremium}) is a matter of declaring another {@link Guard}
 * and listing it on a route — no Router rewrite and no component change
 * (Requirement 5.2).
 */
import type { AuthContextValue } from '@/context/AuthContext';
import type { I18nKey } from '@/i18n/keys';

/**
 * Outcome of evaluating a {@link Guard} against the current auth state.
 *
 * A discriminated union on `allow`:
 * - `{ allow: true }` — the navigation may proceed.
 * - `{ allow: false; redirect; toastKey? }` — the navigation is denied; the
 *   Router should redirect to `redirect` and, when `toastKey` is present,
 *   display the corresponding pt-BR message (Requirements 12.6, 12.7).
 *
 * `toastKey` is an {@link I18nKey} (never a hardcoded string) so all user-facing
 * copy stays in the pt-BR dictionary per the two-language rule (Requirement 2).
 */
export type GuardResult =
  | { readonly allow: true }
  | { readonly allow: false; readonly redirect: string; readonly toastKey?: I18nKey };

/**
 * A parameterizable route guard: a pure decision function over the reactive
 * {@link AuthContextValue}.
 *
 * Guards are composable (a route may declare several) and side-effect free —
 * they only compute a {@link GuardResult}; the Router applies it. This is the
 * extension point that lets new protections be added without rewriting the
 * Router (Requirement 5.2).
 *
 * @param ctx - The current auth context (source of `isLoggedIn` / `isAdmin`).
 * @returns Whether access is allowed, or where to redirect on denial.
 */
export type Guard = (ctx: AuthContextValue) => GuardResult;

/** Shared "allowed" result, reused to avoid re-allocating the constant object. */
const ALLOW: GuardResult = { allow: true };

/**
 * Requires an authenticated session.
 *
 * Used by routes such as `/perfil`, `/avaliar` and `/onboarding`. When no user
 * is logged in, it denies access and redirects to the login form with an
 * explanatory pt-BR message (Requirement 12.7).
 *
 * @param ctx - The current auth context.
 * @returns `{ allow: true }` when a session exists; otherwise a redirect to
 *   `/login` carrying the `guard.authRequired` toast key.
 */
export const requireAuth: Guard = (ctx) =>
  ctx.isLoggedIn ? ALLOW : { allow: false, redirect: '/login', toastKey: 'guard.authRequired' };

/**
 * Requires the authenticated user to have the `admin` role.
 *
 * Guards the `/admin` route. A non-admin (whether a Visitante or a regular
 * Usuário_Autenticado) is redirected to the home page (`/`) with the pt-BR
 * toast "Acesso restrito a administradores." (Requirement 12.6).
 *
 * @param ctx - The current auth context.
 * @returns `{ allow: true }` when the user is an admin; otherwise a redirect to
 *   `/` carrying the `guard.adminOnly` toast key.
 */
export const requireAdmin: Guard = (ctx) =>
  ctx.isAdmin ? ALLOW : { allow: false, redirect: '/', toastKey: 'guard.adminOnly' };

/**
 * Creates a premium-subscription guard.
 *
 * Prepared for a future premium tier (Requirement 5.2): because guards are just
 * functions, this protection can be attached to any route later without
 * touching the Router or any component. Premium status is not yet modeled on
 * the session, so the guard currently allows every navigation; once a premium
 * flag exists it can be evaluated here, and the redirect target is already
 * parameterized so callers can send users to an upgrade page.
 *
 * @param options - Optional configuration.
 * @param options.redirect - Where to send users who lack premium once the tier
 *   is enforced. Defaults to `/`.
 * @param options.toastKey - Optional pt-BR toast key to show on denial.
 * @returns A {@link Guard} that gates access on premium status.
 */
export function createRequirePremium(options: {
  readonly redirect?: string;
  readonly toastKey?: I18nKey;
} = {}): Guard {
  const { redirect = '/', toastKey } = options;
  // A guard may accept fewer parameters than `Guard` declares and still be
  // assignable to it, so the auth context is intentionally omitted while
  // premium status is not yet modeled on the session.
  return () => {
    // Premium is not part of the session model yet, so access is granted.
    // When a `premium` flag is introduced, gate on it here and return a
    // denial with `redirect`/`toastKey`. Referencing the closed-over config
    // keeps the parameterization intact until then.
    void redirect;
    void toastKey;
    return ALLOW;
  };
}

/**
 * Default premium guard instance (see {@link createRequirePremium}).
 *
 * Allows all navigation today; exists so routes and docs can reference a stable
 * `requirePremium` symbol and start gating the moment the premium tier ships,
 * with no component or Router changes (Requirement 5.2).
 */
export const requirePremium: Guard = createRequirePremium();
