/**
 * Component tests for the presentational feedback placeholders {@link Skeleton}
 * and {@link EmptyState} (Requirement 3).
 *
 * Skeleton must render the requested shape and, for repeating shapes, the
 * requested item count (clamped to at least one). EmptyState must render its
 * localized message and, only when both `actionKey` and `onAction` are given, a
 * recovery button that invokes `onAction` when activated.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@i18n/I18nProvider';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

describe('Skeleton (Requirement 3 — shape-preserving placeholder)', () => {
  it('renders a single block for the "card" shape', () => {
    const { container } = render(<Skeleton shape="card" />);

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('aria-hidden', 'true');
    // A single block has no repeated children.
    expect(root?.children.length).toBe(0);
  });

  it('renders a single block for the "chart" shape', () => {
    const { container } = render(<Skeleton shape="chart" />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root?.children.length).toBe(0);
  });

  it('renders the requested number of rows for the "list" shape', () => {
    const { container } = render(<Skeleton shape="list" count={5} />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root?.children.length).toBe(5);
  });

  it('renders the requested number of lines for the "text" shape', () => {
    const { container } = render(<Skeleton shape="text" count={2} />);

    expect(container.firstElementChild?.children.length).toBe(2);
  });

  it('defaults to three items when count is omitted', () => {
    const { container } = render(<Skeleton shape="list" />);

    expect(container.firstElementChild?.children.length).toBe(3);
  });

  it('clamps a count below one to a single item', () => {
    const { container } = render(<Skeleton shape="text" count={0} />);

    expect(container.firstElementChild?.children.length).toBe(1);
  });
});

describe('EmptyState (Requirement 3 — empty/error placeholder)', () => {
  function renderEmptyState(props: Parameters<typeof EmptyState>[0]): void {
    render(
      <I18nProvider>
        <EmptyState {...props} />
      </I18nProvider>,
    );
  }

  it('renders the localized message', () => {
    renderEmptyState({ messageKey: 'state.error' });

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
  });

  it('does not render an action button when the action is not provided', () => {
    renderEmptyState({ messageKey: 'state.error' });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render an action button when only actionKey is provided', () => {
    renderEmptyState({ messageKey: 'state.error', actionKey: 'common.retry' });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the localized action button and calls onAction when activated', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderEmptyState({
      messageKey: 'state.error',
      actionKey: 'common.retry',
      onAction,
    });

    const button = screen.getByRole('button', { name: 'Tentar novamente' });
    await user.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
