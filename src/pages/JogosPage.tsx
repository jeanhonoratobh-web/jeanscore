/**
 * `JogosPage` — the matches route (`/jogos`) (Requirements 14.6, 19.1, 19.2).
 *
 * Loads every fixture through the injected {@link FixtureService} via
 * {@link useQuery} (a single Supabase read, served from cache with a stale
 * fallback) and presents them under two tabs — "Próximos" and "Anteriores"
 * (Requirement 19.1). A competition filter narrows the list **instantly**,
 * entirely client-side with no further network request (Requirement 19.2), and
 * the active competition selection is **preserved when switching tabs**
 * (Requirement 14.6) because both the selected competition and the active tab
 * are held as sibling page state.
 *
 * Each fixture renders as a page-independent {@link MatchCard}; the card is
 * wrapped in a React Router {@link Link} pointing at `/jogo/:id`, so navigation
 * stays client-side (no reload) and base-path correct. While the read
 * is in flight a {@link Skeleton} reserves the layout, and an
 * {@link EmptyState} covers both the "no matches" and the load-error cases (the
 * latter offering a retry). All text resolves through {@link useI18n}
 * (Requirement 3.3) and every visual value comes from Design_Tokens via the
 * co-located CSS module (Requirement 3.4).
 *
 * The "Próximos" tab also surfaces the opt-in PWA pre-game reminders control via
 * {@link useReminders}: when notifications are supported it offers "Ativar
 * lembretes de jogo", requests permission on click, and — once granted —
 * schedules a reminder for the next upcoming fixture, degrading silently when
 * unsupported or denied (Requirement 34.4–34.6).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatchCard } from '@components/cards';
import { EmptyState, Skeleton } from '@components/feedback';
import { CompetitionBadge } from '@components/controls';
import { useServices } from '@context/index';
import { useQuery } from '@hooks/useQuery';
import { useReminders } from '@hooks/useReminders';
import { useI18n } from '@i18n/index';
import type { Fixture } from '@/types/domain';
import styles from './JogosPage.module.css';

/** Identifies which tab of the matches page is active. */
type MatchesTab = 'upcoming' | 'past';

/** Sentinel selection meaning "all competitions" (no competition filter). */
const ALL_COMPETITIONS = 'all' as const;

/** The active competition filter: a competition id, or "all". */
type CompetitionFilter = number | typeof ALL_COMPETITIONS;

/**
 * Decides whether a fixture belongs to the "Próximos" (upcoming) tab.
 *
 * A fixture is upcoming when it has not been played yet: finished or in-progress
 * matches are always "Anteriores", and any other fixture counts as upcoming when
 * it is `notstarted` or its kickoff timestamp is still in the future
 * (Requirement 19.1).
 *
 * @param fixture - The fixture to classify.
 * @param nowSeconds - Current time in Unix seconds (matches {@link Fixture.ts}).
 * @returns `true` when the fixture should appear under "Próximos".
 */
function isUpcoming(fixture: Fixture, nowSeconds: number): boolean {
  if (fixture.status === 'finished' || fixture.status === 'inprogress') {
    return false;
  }
  return fixture.status === 'notstarted' || fixture.ts > nowSeconds;
}

/**
 * Returns the distinct competition ids present in a list of fixtures, preserving
 * first-seen order so the filter chips render deterministically.
 *
 * @param fixtures - Fixtures to scan.
 * @returns Ordered, de-duplicated competition ids.
 */
function distinctCompetitions(fixtures: readonly Fixture[]): number[] {
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const fixture of fixtures) {
    if (!seen.has(fixture.competition)) {
      seen.add(fixture.competition);
      ordered.push(fixture.competition);
    }
  }
  return ordered;
}

/**
 * Renders the matches page: competition filter, two tabs and the match list.
 *
 * @returns The page element.
 */
export function JogosPage(): JSX.Element {
  const { t } = useI18n();
  const { fixtures: fixtureService } = useServices();

  const {
    data: fixtures,
    loading,
    error,
    refetch,
  } = useQuery<Fixture[]>(() => fixtureService.getFixtures(), []);

  // Active tab and competition filter live side by side, so switching tabs
  // never resets the competition selection (Requirement 14.6).
  const [tab, setTab] = useState<MatchesTab>('upcoming');
  const [competition, setCompetition] = useState<CompetitionFilter>(ALL_COMPETITIONS);

  const allFixtures = useMemo<Fixture[]>(() => fixtures ?? [], [fixtures]);

  // PWA pre-game reminders: opt-in permission + schedule for the next fixture
  // once the fixtures are known (Requirement 34.4–34.6). Degrades silently when
  // notifications are unsupported or denied.
  const reminders = useReminders(allFixtures);

  // Competition chips are derived from the loaded fixtures only.
  const competitions = useMemo(
    () => distinctCompetitions(allFixtures),
    [allFixtures],
  );

  // Split into tabs and apply the competition filter client-side. The whole
  // pipeline is memoized so filtering/tab changes are instant, with no refetch
  // (Requirement 19.2).
  const { upcoming, past } = useMemo(() => {
    const nowSeconds = Date.now() / 1000;
    const matchesCompetition = (fixture: Fixture): boolean =>
      competition === ALL_COMPETITIONS || fixture.competition === competition;

    const filtered = allFixtures.filter(matchesCompetition);
    return {
      // Soonest first for upcoming; most recent first for past.
      upcoming: filtered
        .filter((fixture) => isUpcoming(fixture, nowSeconds))
        .sort((a, b) => a.ts - b.ts),
      past: filtered
        .filter((fixture) => !isUpcoming(fixture, nowSeconds))
        .sort((a, b) => b.ts - a.ts),
    };
  }, [allFixtures, competition]);

  const visible = tab === 'upcoming' ? upcoming : past;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('matches.title')}</h1>

      <div className={styles.filters} role="group" aria-label={t('filter.competition')}>
        <span className={styles.filterLabel}>{t('filter.competition')}</span>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={competition === ALL_COMPETITIONS}
          onClick={() => setCompetition(ALL_COMPETITIONS)}
        >
          {t('filter.all')}
        </button>
        {competitions.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.chip}
            aria-pressed={competition === id}
            onClick={() => setCompetition(id)}
          >
            <CompetitionBadge competition={id} />
          </button>
        ))}
      </div>

      <div className={styles.tablist} role="tablist" aria-label={t('matches.title')}>
        <button
          type="button"
          role="tab"
          id="tab-upcoming"
          aria-selected={tab === 'upcoming'}
          aria-controls="panel-matches"
          className={styles.tab}
          onClick={() => setTab('upcoming')}
        >
          {t('matches.tab.upcoming')}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-past"
          aria-selected={tab === 'past'}
          aria-controls="panel-matches"
          className={styles.tab}
          onClick={() => setTab('past')}
        >
          {t('matches.tab.past')}
        </button>
      </div>

      {reminders.supported && tab === 'upcoming' && upcoming.length > 0 ? (
        <div className={styles.reminders}>
          {reminders.enabled ? (
            <span className={styles.reminderStatus}>{t('pwa.reminder.enabled')}</span>
          ) : (
            <button
              type="button"
              className={styles.chip}
              onClick={() => {
                void reminders.enable();
              }}
            >
              {t('pwa.reminder.enable')}
            </button>
          )}
        </div>
      ) : null}

      <div
        id="panel-matches"
        role="tabpanel"
        aria-labelledby={tab === 'upcoming' ? 'tab-upcoming' : 'tab-past'}
      >
        {loading && allFixtures.length === 0 ? (
          <Skeleton shape="list" count={4} />
        ) : error !== null && allFixtures.length === 0 ? (
          <EmptyState messageKey="state.error" actionKey="common.retry" onAction={refetch} />
        ) : visible.length === 0 ? (
          <EmptyState messageKey="state.empty" />
        ) : (
          <ul className={styles.list}>
            {visible.map((fixture) => (
              <li key={fixture.id} className={styles.item}>
                <Link className={styles.cardLink} to={`/jogo/${fixture.id}`}>
                  <MatchCard fixture={fixture} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
