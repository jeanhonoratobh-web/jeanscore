/**
 * Router layer barrel.
 *
 * Client-side navigation with parameterizable route guards (`requireAuth`,
 * `requireAdmin`, future `requirePremium`) (Requirement 1.4, 5.2, 12).
 * `ProtectedRoute` and the route table are added by later tasks (12.2).
 */
export { requireAuth, requireAdmin, requirePremium, createRequirePremium } from './guards';
export type { Guard, GuardResult } from './guards';

export { ProtectedRoute } from './ProtectedRoute';
export type { ProtectedRouteProps } from './ProtectedRoute';

export { router, routes } from './routes';
