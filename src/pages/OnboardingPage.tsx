/**
 * `OnboardingPage` — new supporter welcome flow (`/onboarding`, Requirement 7).
 *
 * Shown to an authenticated user on their first access (Requirement 7.1). It
 * presents a short welcome sequence that introduces the three product pillars —
 * rating matches, earning Fan_Score and completing collections — using the
 * `onboarding.step.*` keys, then offers two ways out:
 *
 * - **Primary action** "Fazer minha primeira avaliação"
 *   ({@link 'onboarding.action.firstRating'}): sends the user to the most recent
 *   **released** fixture available for rating (`/avaliar/:fixtureId`,
 *   Requirement 7.3). When no released fixture exists, the flow instead points
 *   to the squad (`/elenco`) and surfaces the {@link 'onboarding.noFixture'}
 *   message (Requirement 7.4).
 * - **Skip** "Pular" ({@link 'onboarding.action.skip'}): lets the user leave the
 *   flow at any time (Requirement 7.5), returning to the homepage.
 *
 * Either exit **persists onboarding completion** via
 * {@link UserProfileService.completeOnboarding} so the flow is never shown again
 * to the same user (Requirement 7.2).
 *
 * Navigation is router-agnostic on purpose: after persisting completion the page
 * uses `window.location` so it works even when opened directly, without
 * depending on a client router. Every visible string is resolved through
 * {@link useI18n} (Requirement 2.4) and all visual values come from
 * Design_Tokens via the co-located CSS module (Requirement 3.4).
 */
import { useState } from 'react';
import { Button } from '@/components/controls';
import { useAuth } from '@/context/AuthContext';
import { useServices } from '@/context/ServicesContext';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import type { Fixture } from '@/types/domain';
import styles from './OnboardingPage.module.css';

/** Homepage route used when the user skips the flow (Requirement 7.5). */
const HOME_ROUTE = '/';

/** Squad route used when no released fixture is available (Requirement 7.4). */
const ELENCO_ROUTE = '/elenco';

/** A single welcome step describing one product pillar. */
interface OnboardingStep {
  /** Stable key for React lists. */
  readonly id: string;
  /** i18n key for the step heading. */
  readonly titleKey: I18nKey;
  /** i18n key for the step description. */
  readonly bodyKey: I18nKey;
}

/**
 * The welcome sequence (Requirement 7.1): rating matches, earning Fan_Score and
 * completing collections, in the order presented to the user.
 */
const STEPS: readonly OnboardingStep[] = [
  { id: 'rating', titleKey: 'onboarding.step.rating.title', bodyKey: 'onboarding.step.rating.body' },
  { id: 'fanScore', titleKey: 'onboarding.step.fanScore.title', bodyKey: 'onboarding.step.fanScore.body' },
  {
    id: 'collections',
    titleKey: 'onboarding.step.collections.title',
    bodyKey: 'onboarding.step.collections.body',
  },
];

/**
 * Selects the most recent **released** fixture available for rating
 * (Requirement 7.3).
 *
 * Only fixtures with `liberado === true` qualify; among those the one with the
 * greatest `ts` (kickoff timestamp) is the most recent.
 *
 * @param fixtures - All known fixtures.
 * @returns The most recent released {@link Fixture}, or `null` when none is
 *   released (Requirement 7.4).
 */
export function mostRecentReleasedFixture(fixtures: readonly Fixture[]): Fixture | null {
  let best: Fixture | null = null;
  for (const fixture of fixtures) {
    if (!fixture.liberado) {
      continue;
    }
    if (best === null || fixture.ts > best.ts) {
      best = fixture;
    }
  }
  return best;
}

/**
 * Renders the onboarding welcome flow.
 *
 * Loads fixtures to resolve the primary action's destination: the most recent
 * released fixture's rating page, or the squad when none is released
 * (Requirements 7.3, 7.4). Both the primary action and "Pular" persist
 * onboarding completion before navigating (Requirements 7.2, 7.5).
 *
 * @returns The onboarding page element.
 */
export function OnboardingPage(): JSX.Element {
  const { t } = useI18n();
  const services = useServices();
  const { session } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { data: fixtures } = useQuery<Fixture[]>(
    () => services.fixtures.getFixtures(),
    [services],
  );

  const releasedFixture =
    fixtures !== undefined ? mostRecentReleasedFixture(fixtures) : null;
  const hasReleasedFixture = releasedFixture !== null;
  const primaryTarget = hasReleasedFixture
    ? `/avaliar/${releasedFixture.id}`
    : ELENCO_ROUTE;

  /**
   * Persists onboarding completion for the current user (Requirement 7.2) and
   * then navigates to `path`. Persistence failures do not block navigation, so
   * the user is never trapped in the flow.
   *
   * @param path - Destination route to navigate to after completion.
   */
  async function completeAndNavigate(path: string): Promise<void> {
    setSubmitting(true);
    const username = session?.username;
    if (username !== undefined) {
      await services.userProfiles.completeOnboarding(username);
    }
    window.location.assign(path);
  }

  return (
    <div className={styles.page} aria-labelledby="onboarding-title">
      <header className={styles.header}>
        <h1 id="onboarding-title" className={styles.title}>
          {t('onboarding.welcome.title')}
        </h1>
        <p className={styles.subtitle}>{t('onboarding.welcome.subtitle')}</p>
      </header>

      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step.id} className={styles.step}>
            <h2 className={styles.stepTitle}>{t(step.titleKey)}</h2>
            <p className={styles.stepBody}>{t(step.bodyKey)}</p>
          </li>
        ))}
      </ol>

      {!hasReleasedFixture && (
        <p className={styles.noFixture} role="status">
          {t('onboarding.noFixture')}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          labelKey="onboarding.action.firstRating"
          loading={submitting}
          onClick={() => void completeAndNavigate(primaryTarget)}
        />
        <Button
          variant="ghost"
          labelKey="onboarding.action.skip"
          disabled={submitting}
          onClick={() => void completeAndNavigate(HOME_ROUTE)}
        />
      </div>
    </div>
  );
}
