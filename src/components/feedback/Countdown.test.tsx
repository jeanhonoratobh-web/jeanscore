/**
 * Component tests for {@link Countdown} (Requirement 11.8).
 *
 * Verifies that while the target is in the future the counter renders its four
 * day/hour/minute/second segments, and that when the target is reached — either
 * immediately (past target) or after advancing time — the segments are replaced
 * by the localized live message "O jogo está acontecendo agora!"
 * (`home.nextMatch.live`) and the optional `onZero` callback fires exactly once.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@i18n/I18nProvider';
import { Countdown } from './Countdown';

/** Fixed "now" so timestamp math is deterministic across runs. */
const NOW_MS = 1_700_000_000_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

function renderCountdown(targetTs: number, onZero?: () => void): void {
  render(
    <I18nProvider>
      <Countdown targetTs={targetTs} {...(onZero ? { onZero } : {})} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('Countdown (Requirement 11.8)', () => {
  it('renders the four segments with labels while the target is in the future', () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds ahead.
    const target = NOW_SECONDS + 1 * 86_400 + 2 * 3_600 + 3 * 60 + 4;
    renderCountdown(target);

    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByText('dias')).toBeInTheDocument();
    expect(screen.getByText('horas')).toBeInTheDocument();
    expect(screen.getByText('min')).toBeInTheDocument();
    expect(screen.getByText('seg')).toBeInTheDocument();

    expect(screen.getByText('01')).toBeInTheDocument(); // days
    expect(screen.getByText('02')).toBeInTheDocument(); // hours
    expect(screen.getByText('03')).toBeInTheDocument(); // minutes
    expect(screen.getByText('04')).toBeInTheDocument(); // seconds

    expect(
      screen.queryByText('O jogo está acontecendo agora!'),
    ).not.toBeInTheDocument();
  });

  it('shows the live message when the target is already in the past', () => {
    renderCountdown(NOW_SECONDS - 10);

    expect(
      screen.getByText('O jogo está acontecendo agora!'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('swaps to the live message and fires onZero once when the target is reached', () => {
    const onZero = vi.fn();
    renderCountdown(NOW_SECONDS + 3, onZero);

    // Still counting down before zero.
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(onZero).not.toHaveBeenCalled();

    // Advance past the target; the 1s interval recomputes to isComplete.
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(
      screen.getByText('O jogo está acontecendo agora!'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(onZero).toHaveBeenCalledTimes(1);
  });
});
