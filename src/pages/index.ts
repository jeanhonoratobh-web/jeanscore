/**
 * Pages layer barrel.
 *
 * Route compositions built from the component library. Each page is loaded via
 * `React.lazy` for route-based code splitting (Requirement 1.10). Populated by
 * later tasks (16.x).
 */
export { HomePage } from './HomePage';

export { JogosPage } from './JogosPage';

export { MatchDetailPage } from './MatchDetailPage';
export type { MatchDetailPageProps } from './MatchDetailPage';

export { RankingsPage } from './RankingsPage';

export { NotFoundPage } from './NotFoundPage';
export type { NotFoundPageProps, NotFoundVariant } from './NotFoundPage';

export { ElencoPage } from './ElencoPage';

export { ColecoesPage } from './ColecoesPage';
export type { CollectionProgress } from './ColecoesPage';

export { PlayerProfilePage } from './PlayerProfilePage';
export type { PlayerProfilePageProps } from './PlayerProfilePage';

export { PerfilPage } from './PerfilPage';

export { CompararPage } from './CompararPage';

export { OnboardingPage, mostRecentReleasedFixture } from './OnboardingPage';

export { TimeDoMesPage } from './TimeDoMesPage';
export type { TimeDoMesPageProps } from './TimeDoMesPage';

export { AvaliarPage } from './AvaliarPage';
export type { AvaliarPageProps } from './AvaliarPage';

export { AdminPage } from './AdminPage';
