/**
 * Modal — accessible dialog with a trapped focus cycle (Requirements 33.7,
 * 33.8).
 *
 * When opened, the modal moves keyboard focus to the first interactive element
 * inside it and traps the Tab / Shift+Tab cycle so focus never escapes while it
 * is open (Requirement 33.7). When closed, focus returns to the element that
 * triggered the open (Requirement 33.8). Pressing `Escape` — or activating the
 * close button / clicking the backdrop — invokes `onClose`.
 *
 * The dialog is portaled to `document.body`, uses `role="dialog"` with
 * `aria-modal="true"`, and is labelled by its localized title (`titleKey`,
 * Requirements 2.4, 3.3). Styling is exclusively Design_Tokens
 * (Requirement 3.4) and the component is page-independent (Requirement 3.6).
 */
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import styles from './Modal.module.css';

/** Props for {@link Modal}. */
export interface ModalProps {
  /** Whether the modal is visible. When `false`, nothing is rendered. */
  readonly open: boolean;
  /** Invoked on Escape, backdrop click, or close-button activation. */
  readonly onClose: () => void;
  /** i18n key for the dialog title; also labels the dialog for screen readers. */
  readonly titleKey: I18nKey;
  /** Dialog body content. */
  readonly children: ReactNode;
}

/** CSS selector matching the elements considered keyboard-focusable. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Collects the focusable descendants of `container` in DOM order. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Renders a modal dialog that traps focus while open and restores it on close.
 *
 * @param props - See {@link ModalProps}.
 * @returns The portaled dialog when `open`, otherwise `null`.
 */
export function Modal({ open, onClose, titleKey, children }: ModalProps): JSX.Element | null {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // On open: remember the trigger and move focus into the dialog
  // (Requirement 33.7). On close/unmount: restore focus to the trigger
  // (Requirement 33.8).
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = getFocusable(dialog);
      const first = focusable[0] ?? dialog;
      first.focus();
    }

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Trap the Tab cycle and handle Escape while open (Requirements 33.7).
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        // Nothing focusable but the dialog itself — keep focus contained.
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        // Keep clicks inside the dialog from bubbling to the backdrop handler.
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {t(titleKey)}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            {'\u00D7'}
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
