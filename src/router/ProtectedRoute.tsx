/**
 * `ProtectedRoute` (`router/ProtectedRoute.tsx`).
 *
 * Wraps a route `element` with a list of parameterizable {@link Guard}s and
 * enforces them against the reactive {@link AuthContextValue} exposed by
 * {@link useAuth}. Guards are evaluated in order; the first one that denies
 * access wins. On denial the component performs a client-side redirect via
 * `<Navigate to={redirect} replace />` and, when the guard supplied a
 * `toastKey`, surfaces the corresponding pt-BR message through {@link useToast}
 * (Requirements 12.6, 12.7).
 *
 * Keeping the guard-application logic in a single component is what lets the
 * route table stay declarative: a route simply lists which guards protect it,
 * and adding a new protection (for example the future `requirePremium`) never
 * requires touching this component or the Router (Requirement 5.2).
 *
 * The redirect uses `replace` so a denied navigation does not push a dead entry
 * onto the history stack — pressing Back from the login/home target returns the
 * user to wherever they came from, not back into the blocked route.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Guard, GuardResult } from './guards';

/** Props for {@link ProtectedRoute}. */
export interface ProtectedRouteProps {
  /**
   * Guards protecting the wrapped `element`, evaluated left-to-right. The first
   * guard returning `{ allow: false }` denies access; an empty list always
   * allows.
   */
  readonly guards: readonly Guard[];
  /** The route content rendered when every guard allows access. */
  readonly children: ReactNode;
}

/**
 * Evaluates `guards` against the current auth state, returning the first denial
 * or an allow result.
 *
 * @param guards - The ordered guard list to apply.
 * @param ctx - The reactive auth context guards decide upon.
 * @returns The first `{ allow: false }` result, or `{ allow: true }` when none
 *   deny.
 */
function evaluateGuards(guards: readonly Guard[], ctx: Parameters<Guard>[0]): GuardResult {
  for (const guard of guards) {
    const result = guard(ctx);
    if (!result.allow) {
      return result;
    }
  }
  return { allow: true };
}

/**
 * Renders `children` only when all `guards` allow access; otherwise redirects.
 *
 * When a guard denies access it may carry a `toastKey`; the message is shown
 * once via {@link useToast} as a side effect during the redirect render, so the
 * user understands why they were sent away (Requirements 12.6, 12.7).
 *
 * @param props - See {@link ProtectedRouteProps}.
 * @returns The protected content, or a `<Navigate />` redirect element.
 */
export function ProtectedRoute({ guards, children }: ProtectedRouteProps): JSX.Element {
  const auth = useAuth();
  const { showToast } = useToast();

  // Recompute only when the guard list or the auth flags change.
  const decision = useMemo<GuardResult>(
    () => evaluateGuards(guards, auth),
    [guards, auth],
  );

  const toastKey = decision.allow ? undefined : decision.toastKey;

  // Surface the denial toast as a side effect (never during render). Keyed on
  // the resolved toastKey so it fires once per denial rather than every render.
  useEffect(() => {
    if (toastKey !== undefined) {
      showToast('error', toastKey);
    }
  }, [toastKey, showToast]);

  if (!decision.allow) {
    return <Navigate to={decision.redirect} replace />;
  }

  return <>{children}</>;
}
