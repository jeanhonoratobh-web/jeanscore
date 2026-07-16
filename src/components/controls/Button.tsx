/**
 * `Button` — reusable action control (Requirements 3.2, 3.3, 3.4).
 *
 * A page-independent control whose label is resolved from an {@link I18nKey}
 * (never a hardcoded string, Requirement 3.3) and whose appearance is driven
 * exclusively by Design_Tokens via a CSS-module that references `var(--token)`
 * values (Requirement 3.4). Supports semantic variants, three sizes and a
 * loading state that disables interaction while a spinner is shown.
 */
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import styles from './Button.module.css';

/** Visual intent of the button. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

/** Size scale of the button. */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Props for {@link Button}. */
export interface ButtonProps {
  /** Semantic visual intent (Requirement 3.2). */
  variant: ButtonVariant;
  /** Size scale; defaults to `'md'`. */
  size?: ButtonSize;
  /** When `true`, shows a spinner and disables interaction. */
  loading?: boolean;
  /** i18n key resolved to the button label / accessible name (Requirement 3.3). */
  labelKey: I18nKey;
  /** Click handler; not invoked while `loading`. */
  onClick?: () => void;
  /** Native button type; defaults to `'button'` to avoid accidental submits. */
  type?: 'button' | 'submit' | 'reset';
  /** When `true`, disables the button independently of `loading`. */
  disabled?: boolean;
}

/**
 * Renders a themed, internationalized button.
 *
 * The resolved label doubles as the accessible name — essential for the
 * `icon` variant, which renders no visible text. While `loading`, the button
 * is disabled, exposes `aria-busy`, and swaps its label for a spinner.
 *
 * @param props - See {@link ButtonProps}.
 * @returns The button element.
 */
export function Button({
  variant,
  size = 'md',
  loading = false,
  labelKey,
  onClick,
  type = 'button',
  disabled = false,
}: ButtonProps): JSX.Element {
  const { t } = useI18n();
  const label = t(labelKey);
  const isDisabled = disabled || loading;
  const showLabel = variant !== 'icon';

  const className = [styles.button, styles[variant], styles[size]].join(' ');

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        showLabel && <span className={styles.label}>{label}</span>
      )}
    </button>
  );
}
