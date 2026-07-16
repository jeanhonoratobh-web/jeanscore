/**
 * I18nProvider + useI18n hook — the runtime entry point of the i18n layer.
 *
 * The provider sets the document locale to `pt-BR` (Requirement 2.5) and
 * exposes a translator `t(key, params?)` through React context. Components
 * resolve every UI string via {@link useI18n} rather than hardcoding text
 * (Requirements 2.3, 2.4).
 *
 * Resolution rules (Requirement 2.6): a known {@link I18nKey} resolves to its
 * pt-BR text with `{placeholder}` tokens interpolated from `params`; an unknown
 * key logs a development warning and returns the key itself as fallback,
 * without throwing, so rendering never breaks.
 */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { I18nKey } from './keys';
import { ptBR } from './pt-BR';

/** The product locale. Fixed to Brazilian Portuguese (Requirement 2.5). */
export const LOCALE = 'pt-BR' as const;

/** Values accepted for `{placeholder}` interpolation in translated strings. */
export type TranslateParams = Record<string, string | number>;

/** Signature of the translator returned by {@link useI18n}. */
export type Translate = (key: I18nKey, params?: TranslateParams) => string;

/** Value exposed through the i18n context. */
export interface I18nContextValue {
  /** Active locale (always `pt-BR`). */
  readonly locale: typeof LOCALE;
  /** Resolves an {@link I18nKey} to its pt-BR text, interpolating `params`. */
  readonly t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Replaces `{placeholder}` tokens in `template` with values from `params`.
 *
 * Tokens without a matching param are left untouched, so a missing value is
 * visible in the UI rather than silently dropped.
 */
function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/**
 * Resolves an {@link I18nKey} against the pt-BR dictionary.
 *
 * On a missing key, logs a development warning and returns the key itself as
 * fallback without throwing (Requirement 2.6).
 */
function translate(key: I18nKey, params?: TranslateParams): string {
  const template = ptBR[key] as string | undefined;
  if (template === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing pt-BR translation for key: "${key}"`);
    }
    return key;
  }
  return interpolate(template, params);
}

/** Props for {@link I18nProvider}. */
export interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Provides the i18n context to the component tree and sets `lang="pt-BR"` on
 * the `<html>` element at mount (Requirement 2.5).
 */
export function I18nProvider({ children }: I18nProviderProps): JSX.Element {
  useEffect(() => {
    document.documentElement.lang = LOCALE;
  }, []);

  const t = useCallback<Translate>((key, params) => translate(key, params), []);

  const value = useMemo<I18nContextValue>(() => ({ locale: LOCALE, t }), [t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Returns the i18n context value, including the translator `t(key, params?)`.
 *
 * @throws Error if used outside an {@link I18nProvider}.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (context === null) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
