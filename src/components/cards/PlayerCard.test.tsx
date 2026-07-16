/**
 * Component tests for {@link PlayerCard} (Requirements 3.3, 3.4, 15).
 *
 * Verifies that the card renders inside an {@link I18nProvider}:
 *  - shows the 0-99 rating derived via `mapScoreToRating`,
 *  - resolves the position abbreviation and stat labels through i18n
 *    (pt-BR strings such as `ATA`, `Votos`, `Média da Temporada`),
 *  - renders the player name and vote count,
 *  - invokes `onClick` with the player id when activated,
 *  - invokes `onShare` from the share action WITHOUT bubbling to `onClick`
 *    (stopPropagation),
 *  - relies exclusively on Design_Token-driven CSS classes and never emits
 *    literal color values (hex/rgb/hsl) via inline styles (Requirement 3.4).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { mapScoreToRating } from '@domain/index';
import type { Player } from '@/types/domain';
import { I18nProvider } from '@i18n/index';
import { PlayerCard } from './PlayerCard';

/** Renders a UI tree wrapped in the pt-BR i18n provider. */
function renderWithI18n(ui: ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

/** Matches any literal color value (hex, rgb/rgba, hsl/hsla). */
const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;

const ATTACKER: Player = {
  id: 'p-1',
  name: 'Gabriel Veron',
  position: 'Attacker',
  number: 7,
  nationality: 'BR',
  photo: null,
};

describe('PlayerCard (Requirements 3.3, 3.4, 15)', () => {
  it('renders the 0-99 rating derived from the season average', () => {
    const seasonAvg = 8.0;
    renderWithI18n(<PlayerCard player={ATTACKER} seasonAvg={seasonAvg} votes={12} />);

    const expectedRating = String(mapScoreToRating(seasonAvg)); // 8.0 -> 79
    expect(expectedRating).toBe('79');
    expect(screen.getByText(expectedRating)).toBeInTheDocument();
  });

  it('resolves the position abbreviation and stat labels via i18n (pt-BR)', () => {
    renderWithI18n(<PlayerCard player={ATTACKER} seasonAvg={7.5} votes={4} />);

    // Attacker -> position.attacker.abbr -> 'ATA'
    expect(screen.getByText('ATA')).toBeInTheDocument();
    // Stat labels come from the pt-BR dictionary, not hardcoded text.
    expect(screen.getByText('Média da Temporada')).toBeInTheDocument();
    expect(screen.getByText('Votos')).toBeInTheDocument();
  });

  it('renders the player name, season score and vote count', () => {
    renderWithI18n(<PlayerCard player={ATTACKER} seasonAvg={7.3} votes={21} />);

    expect(screen.getByText('Gabriel Veron')).toBeInTheDocument();
    expect(screen.getByText('7.3')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('shows a neutral placeholder when the player has no ratings yet', () => {
    renderWithI18n(<PlayerCard player={ATTACKER} seasonAvg={null} votes={0} />);

    // Both the rating and the score fall back to the em-dash placeholder.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('invokes onClick with the player id when the card is activated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithI18n(<PlayerCard player={ATTACKER} seasonAvg={6.5} votes={3} onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: ATTACKER.name }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(ATTACKER.id);
  });

  it('invokes onShare and does NOT trigger onClick (stopPropagation)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onShare = vi.fn();
    renderWithI18n(
      <PlayerCard
        player={ATTACKER}
        seasonAvg={9.0}
        votes={30}
        onClick={onClick}
        onShare={onShare}
      />,
    );

    // Share button label resolves via i18n ('common.share' -> 'Compartilhar').
    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(ATTACKER.id);
    // Sharing must never bubble up to card navigation.
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses token-driven CSS classes and emits no literal colors inline (Requirement 3.4)', () => {
    const { container } = renderWithI18n(
      <PlayerCard player={ATTACKER} seasonAvg={8.4} votes={9} onShare={vi.fn()} />,
    );

    const elements = container.querySelectorAll<HTMLElement>('*');
    for (const el of elements) {
      const style = el.getAttribute('style');
      if (style !== null) {
        expect(style).not.toMatch(LITERAL_COLOR);
      }
    }
  });

  it('is non-interactive (no button role) when onClick is omitted', () => {
    const { container } = renderWithI18n(
      <PlayerCard player={ATTACKER} seasonAvg={5.0} votes={1} />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // The card still renders its content.
    expect(within(container).getByText('Gabriel Veron')).toBeInTheDocument();
  });
});
