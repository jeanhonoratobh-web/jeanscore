/**
 * ThemeProvider + ThemeContext — theme selection, persistence and application
 * (Requirement 4.4, 4.5, 4.6).
 *
 * The provider owns the single source of truth for the active {@link Theme} and
 * exposes it, together with a setter, via {@link useTheme}. A {@link Theme} is
 * applied by writing the `data-theme` attribute on the document root
 * (`<html>`); the corresponding `[data-theme="..."]` block in `tokens.css`
 * (task 13.1) then overrides only Design_Token values, so switching themes
 * never touches a component (Requirement 4.3).
 *
 * Selection lifecycle:
 * - On mount, the initial theme is resolved once by {@link resolveInitialTheme}:
 *   a previously persisted preference in `localStorage` wins (Requirement 4.5);
 *   otherwise, when the operating system reports `prefers-color-scheme: dark`
 *   and no preference is stored, the night mode (`'dark'`) theme is adopted as
 *   the initial theme (Requirement 4.6); otherwise the Cruzeiro default applies.
 * - Calling {@link ThemeContextValue.setTheme | setTheme} applies the theme
 *   immediately and persists the choice to `localStorage` (Requirement 4.4).
 *
 * The provider is defensive about non-browser / restricted environments
 * (SSR, tests without `matchMedia`, `localStorage` access denied): every access
 * to `window`, `localStorage` and `matchMedia` is guarded so rendering never
 * throws (mirrors {@link useMediaQuery}'s approach).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * The set of supported visual themes (Requirement 4.2). `'cruzeiro'` is the
 * product default; `'dark'` is the night mode used as the OS-based initial
 * fallback (Requirement 4.6).
 *
 * Ordered as a readonly tuple so the {@link Theme} union and the runtime
 * {@link isTheme} guard stay in lock-step — adding a theme here extends both.
 */
export const THEMES = [
  'cruzeiro',
  'dark',
  'black-gold',
  'retro-2003',
  'libertadores',
] as const;

/**
 * A supported theme identifier, written verbatim to `<html data-theme>` and
 * matched by the `[data-theme="..."]` blocks in `tokens.css`.
 */
export type Theme = (typeof THEMES)[number];

/** The product default theme when no preference and no OS hint apply. */
export const DEFAULT_THEME: Theme = 'cruzeiro';

/** Night-mode theme adopted as the initial fallback under `prefers-color-scheme: dark` (Requirement 4.6). */
export const DARK_THEME: Theme = 'dark';

/** `localStorage` key under which the user's theme preference is persisted (Requirement 4.4). */
export const THEME_STORAGE_KEY = 'jeanscore.theme';

/**
 * Runtime type guard narrowing an arbitrary value to a {@link Theme}. Used to
 * validate untrusted input read from `localStorage`, so a stale or tampered
 * value can never put the app into an unknown theme.
 *
 * @param value - Any value, typically a raw `localStorage` string.
 * @returns `true` when `value` is one of the supported {@link THEMES}.
 */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Reads the persisted theme preference, tolerating environments without
 * `localStorage` or where access throws (e.g. privacy modes).
 *
 * @returns The stored {@link Theme}, or `null` when absent/invalid/unavailable.
 */
function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persists the theme preference, silently ignoring failures (e.g. quota
 * exceeded or `localStorage` disabled) so a persistence error never breaks the
 * in-memory theme switch.
 *
 * @param theme - The theme to persist.
 */
function writeStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for the current session.
  }
}

/**
 * Reports whether the OS currently prefers a dark color scheme, guarded for
 * environments without `matchMedia` (returns `false`).
 *
 * @returns `true` when `prefers-color-scheme: dark` matches.
 */
function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves the theme to use on first render (Requirements 4.5, 4.6):
 * 1. a persisted preference, when present and valid;
 * 2. otherwise night mode (`'dark'`) when the OS prefers a dark scheme;
 * 3. otherwise the Cruzeiro default.
 *
 * @returns The initial {@link Theme}.
 */
export function resolveInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored !== null) {
    return stored;
  }
  return prefersDarkScheme() ? DARK_THEME : DEFAULT_THEME;
}

/**
 * Applies a theme to the document root by setting `<html data-theme>`. Guarded
 * for non-DOM environments.
 *
 * @param theme - The theme to apply.
 */
function applyThemeAttribute(theme: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Public shape of the theme context consumed via {@link useTheme}.
 */
export interface ThemeContextValue {
  /** The currently active theme, reflected on `<html data-theme>`. */
  readonly theme: Theme;
  /**
   * Switches the active theme: applies it immediately and persists the choice
   * to `localStorage` (Requirement 4.4).
   *
   * @param theme - The theme to activate.
   */
  setTheme(theme: Theme): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Props for {@link ThemeProvider}. */
export interface ThemeProviderProps {
  /** Application subtree that gains access to the theme API. */
  readonly children: ReactNode;
  /**
   * Optional explicit initial theme, primarily for tests and Storybook. When
   * omitted, the initial theme is resolved from persistence and the OS hint
   * via {@link resolveInitialTheme}.
   */
  readonly initialTheme?: Theme;
}

/**
 * Provides the active {@link Theme} and setter to its subtree, keeps
 * `<html data-theme>` in sync, and persists user selections.
 *
 * The initial theme is resolved once (lazy state initializer) so persistence
 * and the OS `prefers-color-scheme` hint are read a single time on mount
 * (Requirements 4.5, 4.6). Every subsequent change flows through
 * {@link ThemeContextValue.setTheme}.
 */
export function ThemeProvider({ children, initialTheme }: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme ?? resolveInitialTheme());

  // Keep the document root attribute in sync with the active theme, including
  // the initial value on mount (Requirement 4.3).
  useEffect(() => {
    applyThemeAttribute(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme): void => {
    // Persist first so a refresh mid-transition still restores the new choice
    // (Requirement 4.4); the effect above then applies `data-theme`.
    writeStoredTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Access the theme API from within a {@link ThemeProvider}.
 *
 * @throws {Error} If called outside a {@link ThemeProvider}, surfacing the
 * wiring mistake immediately instead of silently returning a default.
 * @returns The {@link ThemeContextValue} for the nearest provider.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
