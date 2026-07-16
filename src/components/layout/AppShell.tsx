/**
 * `AppShell` — the persistent application layout (Requirements 6.10, 12.8, 33.10).
 *
 * Rendered as the element of the parent layout route (see `router/routes.tsx`),
 * `AppShell` provides the semantic frame shared by every page: the persistent
 * {@link Navigation} header (which keeps the authenticated user's name and the
 * active navigation link visible while browsing — Requirements 6.10, 12.8) and a
 * single `<main>` landmark whose content is the matched child route, resolved
 * through React Router's `<Outlet />`.
 *
 * Because the header lives in the layout route rather than inside each page, it
 * stays mounted across client-side navigations (no reload, no header flash) and
 * the whole tree exposes exactly one `<header>`/`<nav>`/`<main>` landmark set
 * (Requirement 33.10). Individual pages therefore render their content inside
 * this `<main>` and must not declare their own `<main>` landmark.
 *
 * All visual values come from Design_Tokens via the co-located CSS module
 * (Requirement 3.4); no literal colors are introduced.
 */
import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import styles from './AppShell.module.css';

/**
 * Renders the persistent app shell: the {@link Navigation} header followed by
 * the routed page content inside the single `<main>` landmark.
 *
 * @returns The application shell element wrapping the active route's `<Outlet />`.
 */
export function AppShell(): JSX.Element {
  return (
    <div className={styles.shell}>
      <Navigation />
      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
