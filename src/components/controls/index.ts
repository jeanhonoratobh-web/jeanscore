/**
 * Controls component group barrel.
 *
 * Reusable control components (Button, Badge, CompetitionBadge, StatCard, and
 * later SearchPanel/StatisticsPanel) styled exclusively via Design_Tokens and
 * internationalized via I18nKey (Requirement 3).
 */
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Badge } from './Badge';
export type { BadgeProps, BadgeKind } from './Badge';

export { CompetitionBadge } from './CompetitionBadge';
export type { CompetitionBadgeProps } from './CompetitionBadge';

export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

export { SearchPanel } from './SearchPanel';
export type { SearchPanelProps } from './SearchPanel';

export { StatisticsPanel } from './StatisticsPanel';
export type { StatisticsPanelProps, LabeledStat } from './StatisticsPanel';
