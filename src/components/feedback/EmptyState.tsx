/**
 * EmptyState — explicit empty / error placeholder with optional recovery
 * action (Requirements 3, 6-degradation, 15.10).
 *
 * Renders a localized message and, optionally, a single call-to-action button.
 * The canonical use is the Elenco empty/error state (Requirement 15.10): the
 * message "Não foi possível carregar o elenco" with a "Tentar novamente"
 * action wired to a retry handler. It is page-independent (Requirement 3.6) and
 * reused wherever a section has no data.
 *
 * Text is always resolved through {@link I18nKey}s (Requirements 2.4, 3.3) and
 * styling comes exclusively from Design_Tokens (Requirement 3.4).
 */
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import styles from './EmptyState.module.css';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** i18n key for the empty/error message shown to the user. */
  readonly messageKey: I18nKey;
  /**
   * i18n key for the optional action button label (e.g. `common.retry`). The
   * button renders only when both `actionKey` and `onAction` are provided.
   */
  readonly actionKey?: I18nKey;
  /** Handler invoked when the action button is activated (e.g. retry fetch). */
  readonly onAction?: () => void;
}

/**
 * Renders a centered empty/error state with an optional recovery button.
 *
 * @param props - See {@link EmptyStateProps}.
 * @returns The empty-state element; the action button appears only when both
 *   `actionKey` and `onAction` are supplied.
 */
export function EmptyState({ messageKey, actionKey, onAction }: EmptyStateProps): JSX.Element {
  const { t } = useI18n();
  const showAction = actionKey !== undefined && onAction !== undefined;

  return (
    <div className={styles.root} role="status">
      <p className={styles.message}>{t(messageKey)}</p>
      {showAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {t(actionKey)}
        </button>
      )}
    </div>
  );
}
