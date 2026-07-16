/**
 * Component tests for {@link MatchCard} (Requirements 3.3, 3.4, 19).
 *
 * Light rendering coverage: teams, score (with placeholder before kickoff),
 * competition and status labels resolved via i18n, the optional squad average,
 * and interactive activation reporting the fixture id.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { Fixture } from '@/types/domain';
import { I18nProvider } from '@i18n/index';
import { MatchCard } from './MatchCard';

function renderWithI18n(ui: ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const FIXTURE: Fixture = {
  id: 'f-1',
  homeTeam: 'Cruzeiro',
  awayTeam: 'Atlético',
  homeScore: 2,
  awayScore: 1,
  fixtureDate: '2024-05-01',
  ts: 1_714_521_600,
  competition: 71,
  stadium: 'Mineirão',
  status: 'finished',
  liberado: true,
};

describe('MatchCard (Requirements 3.3, 3.4, 19)', () => {
  it('renders teams, score, stadium and i18n-resolved competition/status labels', () => {
    renderWithI18n(<MatchCard fixture={FIXTURE} />);

    expect(screen.getByText('Cruzeiro')).toBeInTheDocument();
    expect(screen.getByText('Atlético')).toBeInTheDocument();
    // The score is split across text nodes (home, separator, away); match the whole.
    expect(screen.getByText((_, el) => el?.textContent === '2×1')).toBeInTheDocument();
    expect(screen.getByText('Mineirão')).toBeInTheDocument();
    // competition 71 -> 'competition.serieA' -> 'Série A'
    expect(screen.getByText('Série A')).toBeInTheDocument();
    // status 'finished' -> 'match.status.finished' -> 'Encerrado'
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
  });

  it('shows a placeholder score before kickoff', () => {
    renderWithI18n(
      <MatchCard
        fixture={{ ...FIXTURE, homeScore: null, awayScore: null, status: 'notstarted' }}
      />,
    );

    // Both goal counts fall back to the em-dash placeholder before kickoff.
    expect(screen.getByText((_, el) => el?.textContent === '—×—')).toBeInTheDocument();
    expect(screen.getByText('Não iniciado')).toBeInTheDocument();
  });

  it('renders the squad average with its i18n label when provided', () => {
    renderWithI18n(<MatchCard fixture={FIXTURE} squadAverage={7.25} />);

    expect(screen.getByText('Nota Média')).toBeInTheDocument();
    expect(screen.getByText('7.3')).toBeInTheDocument();
  });

  it('invokes onClick with the fixture id when activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithI18n(<MatchCard fixture={FIXTURE} onClick={onClick} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledWith(FIXTURE.id);
  });
});
