/**
 * ToastContext — global, cross-cutting user feedback (Requirement 31).
 *
 * Exposes an imperative {@link ToastContextValue.showToast | showToast} API so
 * any component, hook or page can surface success / error / information
 * notifications without prop-drilling. The provider owns the toast queue and
 * auto-dismissal timers; the actual visual {@link
 * https://react.dev/reference/react-dom/createPortal | Toast} component (task
 * 14.2) subscribes to the queue via {@link useToast} and renders each entry.
 *
 * Per the two-language rule (Requirement 2), a toast never carries a hardcoded
 * pt-BR string: it carries an {@link I18nKey} (`messageKey`) plus optional
 * interpolation `params`, and the text is resolved at render time. This keeps
 * feedback messages internationalizable and free of technical detail leaking
 * to the user (Requirement 31.4).
 *
 * Design notes:
 * - Toasts auto-dismiss after {@link DEFAULT_TOAST_DURATION_MS} (Requirement
 *   31.1). Passing `durationMs: 0` (or negative) keeps a toast until it is
 *   dismissed explicitly.
 * - Multiple toasts are kept in an ordered queue and rendered as a vertical
 *   stack, so they never overlap (Requirement 31.3).
 * - The three semantic kinds (`success` | `error` | `info`) map to semantic
 *   Design_Tokens in the visual component (Requirement 31.2). Batch operations
 *   with partial success use an `info` toast (Requirement 31.5).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { I18nKey } from '@i18n/keys';

/**
 * Semantic classification of a toast, driving both its accessible role and its
 * token-based styling in the visual component (Requirement 31.2).
 *
 * - `success` — an action completed as expected.
 * - `error` — an action failed; message is descriptive and non-technical
 *   (Requirement 31.4).
 * - `info` — neutral information, e.g. a batch with partial success
 *   (Requirement 31.5).
 */
export type ToastKind = 'success' | 'error' | 'info';

/**
 * Interpolation values for an {@link I18nKey}. Keys map to the `{placeholder}`
 * tokens inside a translated string (e.g. `{successes}`/`{failures}` for a
 * partial batch result). Kept to primitive types so messages stay simple and
 * serializable.
 */
export type ToastParams = Record<string, string | number>;

/**
 * A single notification in the toast queue.
 */
export interface Toast {
  /** Stable, unique identifier used as the React list key and dismissal handle. */
  readonly id: string;
  /** Semantic kind controlling role and token-based styling (Requirement 31.2). */
  readonly kind: ToastKind;
  /** i18n key resolved to a pt-BR string at render time (Requirement 2.4). */
  readonly messageKey: I18nKey;
  /** Optional interpolation values for {@link messageKey}. */
  readonly params?: ToastParams;
}

/**
 * Optional per-toast behaviour overrides.
 */
export interface ShowToastOptions {
  /**
   * Milliseconds before the toast auto-dismisses. Defaults to
   * {@link DEFAULT_TOAST_DURATION_MS} (Requirement 31.1). A value `<= 0`
   * disables auto-dismissal so the toast persists until dismissed explicitly.
   */
  readonly durationMs?: number;
}

/**
 * Public shape of the toast context consumed via {@link useToast}.
 */
export interface ToastContextValue {
  /** Current queue, ordered oldest → newest, rendered as a vertical stack. */
  readonly toasts: readonly Toast[];
  /**
   * Enqueue a notification.
   *
   * @param kind - Semantic kind (Requirement 31.2).
   * @param messageKey - i18n key resolved to pt-BR at render time.
   * @param params - Optional interpolation values for the message.
   * @param options - Optional behaviour overrides (e.g. custom duration).
   * @returns The generated toast `id`, useful for programmatic dismissal.
   */
  showToast(
    kind: ToastKind,
    messageKey: I18nKey,
    params?: ToastParams,
    options?: ShowToastOptions,
  ): string;
  /**
   * Dismiss a toast by id. Safe to call for an already-removed toast.
   *
   * @param id - The `id` returned by {@link showToast}.
   */
  dismissToast(id: string): void;
}

/**
 * Default lifetime of a toast before it auto-dismisses (Requirement 31.1):
 * 3 seconds.
 */
export const DEFAULT_TOAST_DURATION_MS = 3000;

const ToastContext = createContext<ToastContextValue | null>(null);

/** Props for {@link ToastProvider}. */
export interface ToastProviderProps {
  /** Application subtree that gains access to the toast API. */
  readonly children: ReactNode;
}

/**
 * Provides the toast queue and imperative API to its subtree, and renders the
 * live stack region.
 *
 * The rendered region is intentionally minimal here: it exposes an accessible
 * live region and one keyed node per toast so entries stack vertically without
 * overlap (Requirement 31.3). The rich visual presentation (icons, semantic
 * token colors, animations, i18n text resolution) is supplied by the `Toast`
 * component in task 14.2, which will replace the placeholder nodes below while
 * consuming the same queue through {@link useToast}.
 */
export function ToastProvider({ children }: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const idCounter = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: string): void => {
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string): void => {
      clearTimer(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const showToast = useCallback(
    (
      kind: ToastKind,
      messageKey: I18nKey,
      params?: ToastParams,
      options?: ShowToastOptions,
    ): string => {
      idCounter.current += 1;
      const id = `toast-${idCounter.current}`;
      const toast: Toast = params === undefined
        ? { id, kind, messageKey }
        : { id, kind, messageKey, params };

      // Append so the queue stays ordered oldest → newest for the vertical
      // stack (Requirement 31.3).
      setToasts((current) => [...current, toast]);

      const durationMs = options?.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      if (durationMs > 0) {
        const handle = setTimeout(() => dismissToast(id), durationMs);
        timers.current.set(id, handle);
      }

      return id;
    },
    [dismissToast],
  );

  // Clear any pending timers on unmount to avoid leaks / setState-after-unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((handle) => clearTimeout(handle));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        Minimal live region — placeholder until the visual Toast (task 14.2).
        Block-level children stack vertically without overlap (Requirement
        31.3); positioning to the bottom-right corner (Requirement 31.1) is a
        token-based styling concern owned by the visual component.
      */}
      <div role="region" aria-live="polite" aria-label="notifications">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" data-toast-kind={toast.kind}>
            {toast.messageKey}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Access the toast API from within a {@link ToastProvider}.
 *
 * @throws {Error} If called outside a {@link ToastProvider}, since there would
 * be no queue to enqueue into — this surfaces the wiring mistake immediately
 * instead of failing silently.
 * @returns The {@link ToastContextValue} for the nearest provider.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
