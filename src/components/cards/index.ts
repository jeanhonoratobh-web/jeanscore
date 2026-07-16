/**
 * Cards component group barrel.
 *
 * Reusable, page-independent card components (PlayerCard/FifaCard, MatchCard,
 * RankingCard, CollectionCard, AchievementCard, StatCard) styled exclusively via
 * Design_Tokens and internationalized via I18nKey (Requirement 3). Populated by
 * later tasks (14.x).
 */

export { PlayerCard } from './PlayerCard';
export type { PlayerCardProps, PlayerCardVariant } from './PlayerCard';

export { MatchCard } from './MatchCard';
export type { MatchCardProps } from './MatchCard';

export { RankingCard } from './RankingCard';
export type { RankingCardProps } from './RankingCard';

export { CollectionCard } from './CollectionCard';
export type { CollectionCardProps } from './CollectionCard';

export { AchievementCard } from './AchievementCard';
export type { AchievementCardProps } from './AchievementCard';
