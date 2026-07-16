/**
 * Component tests for {@link AchievementCard} (Requirements 3.3, 3.4, 10).
 *
 * Light rendering coverage: title and description resolved from i18n keys and
 * a status label that switches between the unlocked and pending pt-BR strings.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import type { AchievementDef } from '@/types/domain';
import { I18nProvider } from '@i18n/index';
import { AchievementCard } from './AchievementCard';

function renderWithI18n(ui: ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const DEF: AchievementDef = {
  id: 'first-rating',
  titleKey: 'achievement.firstRating.title',
  descriptionKey: 'achievement.firstRating.desc',
  condition: { type: 'total_ratings', threshold: 1 },
};

describe('AchievementCard (Requirements 3.3, 3.4, 10)', () => {
  it('resolves title and description from i18n keys and shows the unlocked label', () => {
    renderWithI18n(<AchievementCard achievement={DEF} unlocked />);

    expect(screen.getByText('Primeira Avaliação')).toBeInTheDocument();
    expect(screen.getByText('Você fez sua primeira avaliação.')).toBeInTheDocument();
    // unlocked -> 'achievements.unlocked' -> 'Desbloqueadas'
    expect(screen.getByText('Desbloqueadas')).toBeInTheDocument();
  });

  it('shows the pending label when locked', () => {
    renderWithI18n(<AchievementCard achievement={DEF} unlocked={false} />);

    // pending -> 'achievements.pending' -> 'Pendentes'
    expect(screen.getByText('Pendentes')).toBeInTheDocument();
  });
});
