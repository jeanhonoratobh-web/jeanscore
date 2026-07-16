/**
 * `NotFoundPage` — the application's 404 page (Requirements 12.5, 16.14, 19.11).
 *
 * Rendered for unmapped routes (`*`) and for detail routes whose `id` does not
 * exist. A `variant` prop selects the message so a single component covers the
 * three "not found" situations:
 *
 * - `'page'`  → "Página não encontrada" (unmapped route, Requirement 12.5).
 * - `'player'` → "Jogador não encontrado" (missing squad `id`, Requirement 16.14).
 * - `'match'`  → "Partida não encontrada" (missing fixture `id`, Requirement 19.11).
 *
 * Every UI string is resolved from an {@link I18nKey} (Requirement 3.3) and all
 * visual values come from Design_Tokens via the co-located CSS module
 * (Requirement 3.4). A return link points to the homepage via a React Router
 * {@link Link}, so the return stays client-side and base-path correct.
 */
import { Link } from 'react-router-dom';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/index';
import styles from './NotFoundPage.module.css';

/** Which "not found" message the page displays. */
export type NotFoundVariant = 'page' | 'player' | 'match';

/** Props for {@link NotFoundPage}. */
export interface NotFoundPageProps {
  /**
   * Selects the title message. Defaults to `'page'`, the generic unmapped-route
   * case (Requirement 12.5).
   */
  readonly variant?: NotFoundVariant;
}

/** Maps each variant to its title {@link I18nKey}. */
const TITLE_KEY: Record<NotFoundVariant, I18nKey> = {
  page: 'notFound.page.title',
  player: 'notFound.player.title',
  match: 'notFound.match.title',
};

/**
 * Renders the 404 page for the given `variant`.
 *
 * Shows a large "404" code, the variant-specific title and a return link to the
 * homepage (`/`). The title is exposed as the page's `<h1>` for assistive tech.
 *
 * @param props - See {@link NotFoundPageProps}.
 * @returns The 404 page element.
 */
export function NotFoundPage({ variant = 'page' }: NotFoundPageProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className={styles.page}>
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1 className={styles.title}>{t(TITLE_KEY[variant])}</h1>
      <Link to="/" className={styles.link}>
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}
