/**
 * `Navigation` — application header navigation (Requirements 3.2, 6.10, 12.8).
 *
 * A reusable, page-independent header that renders the primary route links,
 * highlights the link matching the current URL (Requirement 12.8) and keeps the
 * authenticated user's name visible in the header while they browse
 * (Requirement 6.10). On narrow viewports the link list collapses behind a
 * hamburger toggle.
 *
 * All labels are resolved from {@link I18nKey}s (Requirement 3.3) and all visual
 * values come from Design_Tokens via a co-located CSS module (Requirement 3.4).
 *
 * Navigation is rendered inside the client-side Router (via the {@link AppShell}
 * layout route), so links use React Router's {@link Link}/{@link NavLink}: clicks
 * navigate without a full-page reload (Requirement 12.2) and `NavLink` marks the
 * entry matching the current URL as active (`aria-current="page"`), keeping the
 * active navigation link in sync with the route (Requirement 12.8).
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/index';
import { useAuth } from '@/context';
import styles from './Navigation.module.css';

/** A single navigation entry: a route path and its i18n label key. */
export interface NavItem {
  /** Absolute route path the link points to (e.g. `'/rankings'`). */
  readonly href: string;
  /** i18n key resolved to the link label (Requirement 3.3). */
  readonly labelKey: I18nKey;
}

/** Props for {@link Navigation}. */
export interface NavigationProps {
  /**
   * Navigation entries shown for every visitor. Defaults to the primary public
   * routes (home, squad, compare, matches, rankings, team of the month,
   * collections).
   */
  readonly items?: readonly NavItem[];
}

/** Primary public navigation shown to every visitor (Requirement 12.1). */
const DEFAULT_ITEMS: readonly NavItem[] = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/elenco', labelKey: 'nav.squad' },
  { href: '/comparar', labelKey: 'nav.compare' },
  { href: '/jogos', labelKey: 'nav.matches' },
  { href: '/rankings', labelKey: 'nav.rankings' },
  { href: '/time-do-mes', labelKey: 'nav.teamOfMonth' },
  { href: '/colecoes', labelKey: 'nav.collections' },
];

/**
 * Renders the header navigation bar.
 *
 * Shows the authenticated user's name (and profile/admin shortcuts) when a
 * session exists, or a login link otherwise. The link list is exposed to
 * assistive tech as a `<nav>` landmark; the hamburger button toggles its
 * visibility on small screens via `aria-expanded` / `aria-controls`.
 *
 * @param props - See {@link NavigationProps}.
 * @returns The navigation header element.
 */
export function Navigation({ items = DEFAULT_ITEMS }: NavigationProps): JSX.Element {
  const { t } = useI18n();
  const { session, isLoggedIn, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  // Public links plus session-dependent shortcuts (profile / admin).
  const links = useMemo<readonly NavItem[]>(() => {
    const result: NavItem[] = [...items];
    if (isLoggedIn) result.push({ href: '/perfil', labelKey: 'nav.profile' });
    if (isAdmin) result.push({ href: '/admin', labelKey: 'nav.admin' });
    return result;
  }, [items, isLoggedIn, isAdmin]);

  const menuId = 'primary-navigation-menu';

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand} onClick={close}>
        {t('app.name')}
      </Link>

      <button
        type="button"
        className={styles.hamburger}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('nav.menu')}
        onClick={toggle}
      >
        <span className={styles.hamburgerBar} aria-hidden="true" />
        <span className={styles.hamburgerBar} aria-hidden="true" />
        <span className={styles.hamburgerBar} aria-hidden="true" />
      </button>

      <nav
        id={menuId}
        className={[styles.nav, open ? styles.navOpen : ''].join(' ').trim()}
        aria-label={t('nav.menu')}
      >
        <ul className={styles.list}>
          {links.map((item) => (
            <li key={item.href} className={styles.item}>
              <NavLink
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  [styles.link, isActive ? styles.linkActive : ''].join(' ').trim()
                }
                onClick={close}
              >
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className={styles.session}>
          {isLoggedIn && session ? (
            <span className={styles.greeting}>
              {t('auth.header.greeting', { username: session.username })}
            </span>
          ) : (
            <Link to="/login" className={styles.link} onClick={close}>
              {t('common.login')}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
