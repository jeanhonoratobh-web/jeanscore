/**
 * Component tests for {@link RankingCard} (Requirements 3.3, 3.4, 26).
 *
 * Light rendering coverage: rank badge, player name, i18n-resolved position
 * label, average (one decimal) and the vote count with its i18n label, plus
 * interactive activation reporting the player id.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { RankingEntry } from '@/types/domain';
import { I18nProvider } from '@i18n/index';
import { RankingCard } from './RankingCard';

function renderWithI18n(ui: ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const ENTRY: RankingEntry = {
  playerId: 'p-9',
  playerName: 'Matheus Pereira',
  position: 'Midfielder',
  avg: 8.15,
  votes: 42,
  rank: 1,
};

describe('RankingCard (Requirements 3.3, 3.4, 26)', () => {
  it('renders rank, name, i18n position label, average and votes', () => {
    renderWithI18n(<RankingCard entry={ENTRY} rank={1} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Matheus Pereira')).toBeInTheDocument();
    // Midfielder -> 'position.midfielder' -> 'Meia'
    expect(screen.getByText('Meia')).toBeInTheDocument();
    expect(screen.getByText('8.2')).toBeInTheDocument();
    // Votes label resolved via i18n ('player.votes' -> 'Votos').
    expect(screen.getByText(/42\s+Votos/)).toBeInTheDocument();
  });

  it('invokes onClick with the player id when activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithI18n(<RankingCard entry={ENTRY} rank={1} onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: ENTRY.playerName }));

    expect(onClick).toHaveBeenCalledWith(ENTRY.playerId);
  });
});
