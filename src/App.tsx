/**
 * Application root (`src/App.tsx`).
 *
 * Composes the cross-cutting providers in the order mandated by the bootstrap
 * flow (design "Fluxo de Inicialização") and renders the router. From outermost
 * to innermost:
 *
 * 1. {@link ThemeProvider} — resolves and applies the saved theme (or the
 *    `prefers-color-scheme` fallback) to `<html data-theme>` before anything
 *    paints, so the first frame is already themed (Requirement 4.5).
 * 2. {@link I18nProvider} — sets `lang="pt-BR"` on `<html>` and exposes the
 *    translator used by every component (Requirement 2.5).
 * 3. {@link ServicesProvider} — instantiates the injected data-access Services
 *    once (Requirement 1.3); must wrap {@link AuthProvider}, which reads them.
 * 4. {@link AuthProvider} — calls `AuthService.init()` on mount to restore the
 *    persisted session and keep the tree reactive to auth changes
 *    (Requirement 6.8).
 * 5. {@link ToastProvider} — global user-feedback queue available to guards,
 *    pages and components.
 * 6. {@link RouterProvider} — resolves the current URL against the route table
 *    and mounts the matching Page.
 *
 * The provider nesting is intentional: an inner provider may depend on an outer
 * one (e.g. `AuthProvider` on `ServicesProvider`), never the reverse.
 */
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ServicesProvider } from '@/context/ServicesContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { router } from '@/router/routes';

/**
 * The application root component: the composed provider tree wrapping the
 * router. Rendered once by {@link file://./main.tsx | main.tsx}.
 *
 * @returns The fully wired application element.
 */
export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ServicesProvider>
          <AuthProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </AuthProvider>
        </ServicesProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
