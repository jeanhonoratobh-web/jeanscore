/**
 * `CompetitionBadge` — labels a fixture's competition (Requirements 3.2, 3.4).
 *
 * Maps a numeric competition id (Série A 71, Copa do Brasil 73, Libertadores
 * 13, Campeonato Mineiro 629, Amistoso 999) to its pt-BR name via an
 * {@link I18nKey} plus a small decorative glyph. Styling is driven exclusively
 * by Design_Tokens (Requirement 3.4). Unknown ids degrade gracefully to the
 * raw number without an icon, so rendering never breaks.
 */
import type { I18nKey } from '@i18n/index';
import { useI18n } from '@i18n/index';
import styles from './CompetitionBadge.module.css';

/** Props for {@link CompetitionBadge}. */
export interface CompetitionBadgeProps {
  /** Numeric competition id as tracked by the domain. */
  competition: number;
}

/** Descriptor resolved from a competition id: its i18n name and glyph. */
interface CompetitionDescriptor {
  readonly labelKey: I18nKey;
  readonly icon: string;
}

/**
 * Static map of the monitored competitions to their i18n name and glyph.
 * The glyphs are decorative content (not styling), so they are exempt from the
 * Design_Tokens rule.
 */
const COMPETITIONS: Readonly<Record<number, CompetitionDescriptor>> = {
  71: { labelKey: 'competition.serieA', icon: '🏆' },
  73: { labelKey: 'competition.copaDoBrasil', icon: '🇧🇷' },
  13: { labelKey: 'competition.libertadores', icon: '🌎' },
  629: { labelKey: 'competition.mineiro', icon: '⛰️' },
  999: { labelKey: 'competition.friendly', icon: '🤝' },
};

/**
 * Renders a themed, internationalized competition badge.
 *
 * @param props - See {@link CompetitionBadgeProps}.
 * @returns The badge element.
 */
export function CompetitionBadge({ competition }: CompetitionBadgeProps): JSX.Element {
  const { t } = useI18n();
  const descriptor = COMPETITIONS[competition];

  if (descriptor === undefined) {
    return <span className={styles.badge}>{String(competition)}</span>;
  }

  return (
    <span className={styles.badge}>
      <span className={styles.icon} aria-hidden="true">
        {descriptor.icon}
      </span>
      {t(descriptor.labelKey)}
    </span>
  );
}
