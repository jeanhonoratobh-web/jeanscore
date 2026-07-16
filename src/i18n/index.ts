/**
 * i18n layer barrel.
 *
 * I18nKey type (technical keys in English) and pt-BR dictionaries that resolve
 * every UI string (Requirement 2). The `I18nKey` literal union (task 2.4) is
 * the single technical source of the UI strings; the pt-BR dictionary and the
 * `useI18n` hook are added by task 13.3.
 */
export type { I18nKey } from './keys';

/** pt-BR dictionary: exhaustive `Record<I18nKey, string>` (task 13.3). */
export { ptBR } from './pt-BR';

/** Provider, hook and translator types for resolving UI strings (task 13.3). */
export {
  I18nProvider,
  useI18n,
  LOCALE,
} from './I18nProvider';
export type {
  I18nContextValue,
  I18nProviderProps,
  Translate,
  TranslateParams,
} from './I18nProvider';
