/**
 * Toast — user feedback notification (Requirement 31).
 *
 * This module provides two pieces:
 * - {@link Toast}: the visual presentation of a single notification. It maps a
 *   semantic `kind` to token-based styling (Requirement 31.2) and resolves its
 *   `messageKey` to pt-BR text at render time (Requirements 2.4, 3.3).
 * - {@link ToastViewport}: the container that subscribes to the global toast
 *   queue via {@link useToast} and renders every entry as a vertical,
 *   non-overlapping stack in the bottom-right corner (Requirements 31.1, 31.3),
 *   portaled to `document.body` so it floats above the app.
 *
 * The queue, auto-dismissal timers and imperative `showToast` API live in
 * {@link ToastProvider}; this component is purely the visual layer over that
 * state. Styling is exclusively Design_Tokens (Requirement 3.4) and the
 * component is page-independent (Requirement 3.6).
 */
import { createPortal } from 'react-dom';
import { useToast, type ToastKind, type ToastParams } from '@context/ToastContext';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import styles from './Toast.module.css';

/** Maps a toast kind to its CSS accent class. */
const KIND_CLASS: Record<ToastKind, string> = {
  success: styles.success,
  error: styles.error,
  info: styles.info,
};

/**
 * Maps a toast kind to its ARIA role: `error` announces assertively via
 * `alert`, informational/success toasts announce politely via `status`.
 */
const KIND_ROLE: Record<ToastKind, 'alert' | 'status'> = {
  success: 'status',
  error: 'alert',
  info: 'status',
};

/** Props for the single-toast {@link Toast} component. */
export interface ToastProps {
  /** Semantic kind controlling role and token-based styling (Requirement 31.2). */
  readonly kind: ToastKind;
  /** i18n key resolved to a pt-BR string at render time (Requirement 2.4). */
  readonly messageKey: I18nKey;
  /** Optional interpolation values for {@link messageKey}. */
  readonly params?: ToastParams;
  /** Optional handler for the dismiss button; the button is hidden when absent. */
  readonly onDismiss?: () => void;
}

/**
 * Renders a single notification card with a semantic accent and message.
 *
 * @param props - See {@link ToastProps}.
 * @returns The toast element; a dismiss button is included only when
 *   `onDismiss` is provided.
 */
export function Toast({ kind, messageKey, params, onDismiss }: ToastProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className={`${styles.toast} ${KIND_CLASS[kind]}`} role={KIND_ROLE[kind]}>
      <span className={styles.icon} aria-hidden="true" />
      <p className={styles.message}>{t(messageKey, params)}</p>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label={t('common.close')}
        >
          {'\u00D7'}
        </button>
      )}
    </div>
  );
}

/**
 * Subscribes to the global toast queue and renders it as a bottom-right stack.
 *
 * Mount this once near the app root (inside a {@link ToastProvider}). It
 * portals the stack to `document.body` and renders nothing when the queue is
 * empty.
 *
 * @returns The portaled stack of {@link Toast}s, or `null` when empty.
 */
export function ToastViewport(): JSX.Element | null {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className={styles.viewport} role="region" aria-live="polite" aria-label="notifications">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          kind={toast.kind}
          messageKey={toast.messageKey}
          {...(toast.params !== undefined ? { params: toast.params } : {})}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>,
    document.body,
  );
}
