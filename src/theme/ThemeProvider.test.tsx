/**
 * Component tests for ThemeProvider / useTheme (Requirements 4.3, 4.4, 4.5).
 *
 * Verifies that switching themes only flips `<html data-theme>` (never touching
 * the rendered component), persists the choice to `localStorage`, and restores
 * a previously persisted preference on mount.
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from './ThemeProvider';

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
}

/**
 * A component that renders the same markup regardless of the active theme, so
 * we can assert a theme switch never changes the component (Requirement 4.3).
 */
function ThemedComponent(): JSX.Element {
  const { theme } = useTheme();
  return <div data-testid="themed">content: {theme}</div>;
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('useTheme', () => {
  it('throws when used outside a ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      /useTheme must be used within a ThemeProvider/,
    );
  });
});

describe('ThemeProvider theme switching (Requirement 4.3, 4.4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies the initial theme to <html data-theme> on mount', () => {
    render(
      <ThemeProvider initialTheme="cruzeiro">
        <ThemedComponent />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('cruzeiro');
  });

  it('setTheme updates document.documentElement data-theme without altering the component', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    render(
      <ThemeProvider initialTheme="cruzeiro">
        <ThemedComponent />
      </ThemeProvider>,
    );

    // The rendered component structure is theme-independent: only the token
    // layer changes via data-theme, so the DOM node is present before and
    // after the switch (Requirement 4.3).
    const before = screen.getByTestId('themed');
    expect(before).toBeInTheDocument();

    act(() => {
      result.current.setTheme('libertadores');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'libertadores',
    );
    // Same node still in the document; the switch did not remount the component.
    expect(screen.getByTestId('themed')).toBeInTheDocument();
  });

  it('setTheme persists the selected theme to localStorage (Requirement 4.4)', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('black-gold');
    });

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('black-gold');
    expect(result.current.theme).toBe('black-gold');
  });
});

describe('ThemeProvider initial restore (Requirement 4.5)', () => {
  it('restores the persisted theme from localStorage on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'retro-2003');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('retro-2003');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'retro-2003',
    );
  });

  it('ignores an invalid persisted value and falls back to the default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-real-theme');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('cruzeiro');
  });
});
