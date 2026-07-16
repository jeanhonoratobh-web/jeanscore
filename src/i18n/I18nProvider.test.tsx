/**
 * Component tests for I18nProvider / useI18n (Requirements 2.5, 2.6).
 *
 * Verifies that a known key resolves to its pt-BR text with param
 * interpolation, that an unknown key falls back to the key itself WITHOUT
 * throwing (so rendering never breaks), and that the document locale is set to
 * pt-BR on mount.
 */
import { render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { I18nKey } from './keys';
import { I18nProvider, LOCALE, useI18n } from './I18nProvider';

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <I18nProvider>{children}</I18nProvider>;
}

afterEach(() => {
  document.documentElement.removeAttribute('lang');
});

describe('useI18n', () => {
  it('throws when used outside an I18nProvider', () => {
    expect(() => renderHook(() => useI18n())).toThrow(
      /useI18n must be used within an I18nProvider/,
    );
  });
});

describe('I18nProvider translation (Requirement 2.6)', () => {
  it('resolves a known key to its pt-BR text', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.t('nav.home')).toBe('Início');
    expect(result.current.t('common.save')).toBe('Salvar');
  });

  it('interpolates {placeholder} params into the resolved string', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.t('auth.header.greeting', { username: 'Jean' })).toBe(
      'Olá, Jean',
    );
    expect(result.current.t('fanScore.gain', { points: 25 })).toBe(
      '+25 pontos',
    );
  });

  it('returns the key itself as fallback for a missing/unknown key without throwing', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useI18n(), { wrapper });

    // Cast an invalid key to I18nKey to exercise the runtime fallback branch.
    const unknownKey = 'this.key.does.not.exist' as I18nKey;

    let output = '';
    expect(() => {
      output = result.current.t(unknownKey);
    }).not.toThrow();
    expect(output).toBe('this.key.does.not.exist');

    spy.mockRestore();
  });

  it('renders a component using t() without crashing on a missing key', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function Consumer(): JSX.Element {
      const { t } = useI18n();
      return <span data-testid="label">{t('unknown.render.key' as I18nKey)}</span>;
    }

    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>,
    );

    expect(screen.getByTestId('label')).toHaveTextContent('unknown.render.key');
    spy.mockRestore();
  });
});

describe('I18nProvider locale (Requirement 2.5)', () => {
  it('sets document.documentElement.lang to pt-BR on mount', () => {
    render(
      <I18nProvider>
        <div>content</div>
      </I18nProvider>,
    );

    expect(document.documentElement.lang).toBe(LOCALE);
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('exposes pt-BR as the active locale', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.locale).toBe('pt-BR');
  });
});
