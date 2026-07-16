/**
 * `PerfilPage` — the authenticated user's personal profile (`pages/PerfilPage.tsx`,
 * Requirements 8, 9.6).
 *
 * Composes the reusable component library into the `/perfil` and
 * `/perfil/:username` routes. The target user comes from the optional
 * `:username` path parameter (via `useParams`) and falls back to the
 * logged-in user from {@link useAuth} — the route is wrapped in the
 * `requireAuth` guard so a session is always present (Requirement 8.10).
 *
 * Data is loaded through {@link useQuery} over the injected Services
 * ({@link UserProfileService}, {@link FixtureService}) while the achievement
 * catalog and Fan Score configuration come synchronously from the
 * {@link AchievementService} and {@link FanScoreService}. From top to bottom it
 * renders:
 *
 *  1. Identity + "Membro Desde" (Requirement 8.1)
 *  2. Personal statistics — total ratings, matches rated, favorite player
 *     (Requirement 8.2), the favorite player linking to their profile
 *     (Requirement 8.8)
 *  3. Fan Score + Supporter Level + progress to the next level via
 *     {@link progressToNext} (Requirements 8.3, 9.6)
 *  4. Achievements, visually distinguishing unlocked from pending through the
 *     reusable {@link AchievementCard} (Requirement 8.4)
 *  5. Community badges (Requirement 8.5)
 *  6. Recent activity — the latest submitted ratings, each player linking to
 *     their profile (Requirements 8.6, 8.8)
 *  7. Activity timeline — chronological milestones (Requirement 8.7)
 *
 * Every section shows a shape-preserving {@link Skeleton} while its data loads
 * (Requirement 8.9). Every visual value comes from Design_Tokens through the
 * co-located CSS module (Requirement 3.4) and every string is resolved via
 * {@link useI18n} (Requirements 2.4, 3.3).
 */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AchievementCard } from '@components/cards';
import { Badge, StatCard } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { progressToNext } from '@domain/index';
import { useAuth } from '@/context/AuthContext';
import { useServices } from '@/context/ServicesContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import type {
  ActivityItem,
  Fixture,
  Player,
  TimelineMilestone,
  UserProfile,
} from '@/types/domain';
import styles from './PerfilPage.module.css';

/** Number of most-recent activity entries requested for the profile. */
const RECENT_ACTIVITY_LIMIT = 10;

/**
 * Builds the router-relative player-profile path. It is consumed by a React
 * Router {@link Link}, so the router `basename` prepends the GitHub Pages subpath
 * automatically (Requirement 8.8).
 */
function playerHref(playerId: string): string {
  return `/jogador/${encodeURIComponent(playerId)}`;
}

/** Builds the router-relative match-detail path (basename applied by the router). */
function matchHref(fixtureId: string): string {
  return `/jogo/${encodeURIComponent(fixtureId)}`;
}

/**
 * Formats an ISO date string as a long pt-BR date (e.g. "5 de março de 2024"),
 * returning the raw input when it cannot be parsed.
 */
function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return iso;
  }
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Props for the internal {@link Section} wrapper. */
interface SectionProps {
  readonly titleKey: I18nKey;
  readonly children: React.ReactNode;
}

/**
 * The user profile page: a personal dashboard for the authenticated user.
 *
 * @returns The profile route composition.
 */
export function PerfilPage(): JSX.Element {
  const { t } = useI18n();
  const services = useServices();
  const { session } = useAuth();
  const params = useParams<{ username?: string }>();

  // Optional `:username` path param, defaulting to the logged-in user.
  const username = params.username ?? session?.username ?? '';

  const profileQuery = useQuery<UserProfile>(
    () => services.userProfiles.getProfile(username),
    [services, username],
  );
  const favoriteQuery = useQuery<Player | null>(
    () => services.userProfiles.getFavoritePlayer(username),
    [services, username],
  );
  const activityQuery = useQuery<ActivityItem[]>(
    () => services.userProfiles.getRecentActivity(username, RECENT_ACTIVITY_LIMIT),
    [services, username],
  );
  const timelineQuery = useQuery<TimelineMilestone[]>(
    () => services.userProfiles.getTimeline(username),
    [services, username],
  );
  const fixturesQuery = useQuery<Fixture[]>(() => services.fixtures.getFixtures(), [services]);

  // The achievement catalog and Fan Score rules are static, data-driven config.
  const catalog = useMemo(() => services.achievements.getDefinitions(), [services]);
  const fanScoreConfig = useMemo(() => services.fanScore.getConfig(), [services]);

  const profile = profileQuery.data;
  const profileLoading = profileQuery.loading && profile === undefined;

  // Fast fixture lookup so recent activity can show the match's teams.
  const fixtureById = useMemo(() => {
    const map = new Map<string, Fixture>();
    for (const fixture of fixturesQuery.data ?? []) {
      map.set(fixture.id, fixture);
    }
    return map;
  }, [fixturesQuery.data]);

  // Progress toward the next Supporter Level (Requirements 8.3, 9.6).
  const progress = useMemo(
    () => (profile ? progressToNext(profile.fanScore, fanScoreConfig) : null),
    [profile, fanScoreConfig],
  );

  // The set of achievement ids the user has unlocked (Requirement 8.4).
  const unlockedIds = useMemo(
    () =>
      new Set(
        (profile?.achievements ?? [])
          .filter((achievement) => achievement.unlockedAt !== null)
          .map((achievement) => achievement.id),
      ),
    [profile?.achievements],
  );

  /** Local section shell so headings and spacing stay consistent. */
  const Section = ({ titleKey, children }: SectionProps): JSX.Element => (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t(titleKey)}</h2>
      {children}
    </section>
  );

  return (
    <div className={styles.page} aria-busy={profileLoading}>
      {/* 1. Identity + "Membro Desde" (Requirement 8.1) */}
      <header className={styles.identity}>
        {profileLoading || profile === undefined ? (
          <Skeleton shape="text" count={2} />
        ) : (
          <>
            <h1 className={styles.username}>{profile.username}</h1>
            <p className={styles.memberSince}>
              {t('profile.memberSince')} {formatDate(profile.memberSince)}
            </p>
            <Badge kind="level" labelKey={`level.${profile.fanLevel}`} />
          </>
        )}
      </header>

      {/* 2. Estatísticas Pessoais (Requirement 8.2) */}
      <Section titleKey="profile.stats.title">
        {profileLoading || profile === undefined ? (
          <Skeleton shape="card" count={3} />
        ) : (
          <div className={styles.statsGrid}>
            <StatCard labelKey="profile.stats.totalRatings" value={profile.totalRatings} countUp />
            <StatCard labelKey="profile.stats.matchesRated" value={profile.matchesRated} countUp />
            <div className={styles.favoriteCard}>
              <span className={styles.favoriteLabel}>{t('profile.stats.favoritePlayer')}</span>
              {favoriteQuery.loading && favoriteQuery.data === undefined ? (
                <Skeleton shape="text" count={1} />
              ) : favoriteQuery.data !== null && favoriteQuery.data !== undefined ? (
                <Link className={styles.favoriteLink} to={playerHref(favoriteQuery.data.id)}>
                  {favoriteQuery.data.name}
                </Link>
              ) : (
                <span className={styles.favoriteNone}>{t('profile.favoritePlayer.none')}</span>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* 3. Fan Score + Nível + progresso (Requirements 8.3, 9.6) */}
      <Section titleKey="fanScore.label">
        {profileLoading || profile === undefined || progress === null ? (
          <Skeleton shape="text" count={2} />
        ) : (
          <div className={styles.fanScore}>
            <div className={styles.fanScoreHeader}>
              <span className={styles.fanScoreValue}>{profile.fanScore}</span>
              <Badge kind="level" labelKey={`level.${progress.currentLevel}`} />
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <div
                className={styles.progressFill}
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </div>
            <p className={styles.progressLabel}>
              {progress.nextLevel === null
                ? t('profile.fanScore.maxLevel')
                : t('profile.fanScore.pointsToNext', {
                    points: progress.pointsToNext,
                    level: t(`level.${progress.nextLevel}`),
                  })}
            </p>
          </div>
        )}
      </Section>

      {/* 4. Conquistas — desbloqueadas vs pendentes (Requirement 8.4) */}
      <Section titleKey="profile.achievements.title">
        {profileLoading ? (
          <Skeleton shape="card" count={3} />
        ) : catalog.length === 0 ? (
          <EmptyState messageKey="profile.achievements.empty" />
        ) : (
          <div className={styles.achievementsGrid}>
            {catalog.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                unlocked={unlockedIds.has(achievement.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* 5. Badges da Comunidade (Requirement 8.5) */}
      <Section titleKey="profile.badges.title">
        {profileLoading || profile === undefined ? (
          <Skeleton shape="text" count={1} />
        ) : profile.badges.length === 0 ? (
          <EmptyState messageKey="profile.badges.empty" />
        ) : (
          <div className={styles.badgesRow}>
            {profile.badges.map((badge) => (
              <Badge key={badge.id} kind={badge.kind} labelKey={badge.labelKey} />
            ))}
          </div>
        )}
      </Section>

      {/* 6. Atividade Recente (Requirements 8.6, 8.8) */}
      <Section titleKey="profile.recentActivity.title">
        {activityQuery.loading && activityQuery.data === undefined ? (
          <Skeleton shape="list" count={RECENT_ACTIVITY_LIMIT} />
        ) : (activityQuery.data ?? []).length === 0 ? (
          <EmptyState messageKey="profile.empty.noActivity" />
        ) : (
          <ul className={styles.activityList}>
            {(activityQuery.data ?? []).map((item, index) => {
              const fixture = fixtureById.get(item.fixtureId);
              return (
                <li
                  key={`${item.fixtureId}:${item.playerId}:${index}`}
                  className={styles.activityItem}
                >
                  <Link className={styles.activityPlayer} to={playerHref(item.playerId)}>
                    {item.playerName}
                  </Link>
                  <Link className={styles.activityMatch} to={matchHref(item.fixtureId)}>
                    {fixture ? `${fixture.homeTeam} × ${fixture.awayTeam}` : item.fixtureId}
                  </Link>
                  <span className={styles.activityScore}>{item.score.toFixed(1)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 7. Linha do Tempo de Atividade (Requirement 8.7) */}
      <Section titleKey="profile.timeline.title">
        {timelineQuery.loading && timelineQuery.data === undefined ? (
          <Skeleton shape="list" count={3} />
        ) : (timelineQuery.data ?? []).length === 0 ? (
          <EmptyState messageKey="profile.timeline.empty" />
        ) : (
          <ol className={styles.timeline}>
            {(timelineQuery.data ?? []).map((milestone, index) => (
              <li key={`${milestone.kind}:${milestone.at}:${index}`} className={styles.timelineItem}>
                <span className={styles.timelineLabel}>{t(milestone.label)}</span>
                <span className={styles.timelineDate}>{formatDate(milestone.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
