/**
 * `Badge` — compact status/label pill (Requirements 3.2, 3.3, 3.4).
 *
 * Renders a small labelled pill whose text comes from an {@link I18nKey}
 * (Requirement 3.3) and whose color scheme is chosen by `kind`, styled solely
 * through Design_Tokens (Requirement 3.4). Used for supporter levels,
 * achievements and trends across the product.
 */
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import styles from './Badge.module.css';

/** Category of badge, selecting its token-driven color scheme. */
export type BadgeKind = 'level' | 'achievement' | 'trend';

/** Props for {@link Badge}. */
export interface BadgeProps {
  /** Badge category (Requirement 3.2). */
  kind: BadgeKind;
  /** i18n key resolved to the badge text (Requirement 3.3). */
  labelKey: I18nKey;
}

/**
 * Renders a themed, internationalized badge pill.
 *
 * @param props - See {@link BadgeProps}.
 * @returns The badge element.
 */
export function Badge({ kind, labelKey }: BadgeProps): JSX.Element {
  const { t } = useI18n();
  const className = [styles.badge, styles[kind]].join(' ');
  return <span className={className}>{t(labelKey)}</span>;
}
