/**
 * `TimeDoMesPage` — the Time da Comunidade do Mês view (`pages/TimeDoMesPage.tsx`,
 * Requirements 25, 27.2).
 *
 * Composes the reusable component library into the `/time-do-mes` route. It
 * loads the full squad, every community rating and the fixtures through
 * `useQuery` over the injected Services, then lets the user pick a **month** and
 * a **competition** (Requirement 25.1). For the selected period the ratings are
 * filtered client-side — by fixture month and, unless "Todas as competições" is
 * chosen, by the fixture's competition — and fed to the pure domain function
 * {@link buildTeamOfMonth}, which fills a fixed 4-3-3 {@link Formation} with the
 * best-rated eligible player per position (Requirements 25.2, 25.3).
 *
 * Changing the month or competition recomputes the team instantly with no extra
 * Supabase round-trip (Requirement 25.5). The selected eleven is laid out on a
 * tactical pitch — attackers on top down to the goalkeeper — with each slot
 * rendered as a {@link PlayerCard}; clicking a card navigates to that player's
 * profile via a plain anchor, keeping the page router-agnostic (Requirements
 * 25.2, 25.7). Team statistics (average rating, total votes, selected players)
 * are shown as {@link StatCard}s alongside the month and {@link CompetitionBadge}
 * (Requirement 25.4), and a "Compartilhar time" action surfaces the shareable
 * formation image (Requirement 27.2).
 *
 * When the period lacks enough eligible players to complete the formation, the
 * page shows the "Dados insuficientes para montar o time deste período" message
 * instead of a partial pitch (Requirement 25.6). Skeletons cover the initial
 * load (Requirement 25.8), and a failed/empty squad load shows a retry
 * {@link EmptyState}.
 *
 * Every visual value comes from Design_Tokens through the co-located CSS module
 * (Requirement 3.4) and every string is resolved via {@link useI18n}
 * (Requirements 2.4, 3.3).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerCard } from '@components/cards';
import { Button, CompetitionBadge, StatCard } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { buildTeamOfMonth } from '@domain/index';
import type { Formation, TeamOfMonthSlot } from '@domain/index';
import { useServices } from '@/context/ServicesContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import type { Fixture, GameScore, Player, Position } from '@/types/domain';
import styles from './TimeDoMesPage.module.css';

/** Sentinel selecting every competition in the competition filter. */
const ALL_COMPETITIONS = 'all' as const;

/** Competition filter value: a numeric competition id or the "all" sentinel. */
type CompetitionFilter = number | typeof ALL_COMPETITIONS;

/**
 * The tactical formation used for the Team of the Month: a classic 4-3-3
 * (1 Goalkeeper, 4 Defenders, 3 Midfielders, 3 Attackers). Data-driven, so a
 * different shape is a one-line change (Requirement 25.2).
 */
const FORMATION: Formation = {
  name: '4-3-3',
  counts: { Goalkeeper: 1, Defender: 4, Midfielder: 3, Attacker: 3 },
};

/**
 * Pitch row order, top (attack) to bottom (goal). The team is laid out as a
 * tactical formation with each position on its own row (Requirement 25.2).
 */
const ROW_ORDER: readonly Position[] = [
  'Attacker',
  'Midfielder',
  'Defender',
  'Goalkeeper',
];

/** Number of skeleton cards shown while the team loads (Requirement 25.8). */
const SKELETON_CARD_COUNT = 11;

/** Maps a competition id to its pt-BR name key (mirrors {@link CompetitionBadge}). */
const COMPETITION_LABEL_KEY: Readonly<Record<number, I18nKey>> = {
  71: 'competition.serieA',
  73: 'competition.copaDoBrasil',
  13: 'competition.libertadores',
  629: 'competition.mineiro',
  999: 'competition.friendly',
};

/**
 * Derives the `YYYY-MM` month key of an ISO date string (e.g. `2024-05-01` →
 * `2024-05`). Used to bucket ratings into calendar months for the selector.
 *
 * @param isoDate - An ISO date/datetime string.
 * @returns The `YYYY-MM` month key, or an empty string when the input is blank.
 */
function monthKey(isoDate: string): string {
  return isoDate.length >= 7 ? isoDate.slice(0, 7) : '';
}

/**
 * Formats a `YYYY-MM` month key into a pt-BR label (e.g. `maio de 2024`).
 *
 * @param key - A `YYYY-MM` month key.
 * @returns The localized month label, or the raw key when it cannot be parsed.
 */
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return key;
  }
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Builds the router-relative profile path for a player. It is consumed by a
 * React Router {@link Link}, so the router `basename` prepends the GitHub Pages
 * subpath automatically (Requirement 25.7).
 */
function playerHref(playerId: string): string {
  return `/jogador/${encodeURIComponent(playerId)}`;
}

/** Rounds a number to a single decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Props for {@link TimeDoMesPage}. */
export interface TimeDoMesPageProps {
  /**
   * Invoked when the user activates "Compartilhar time" to generate the
   * shareable formation image (Requirement 27.2). Optional; defaults to a stub
   * so the page is self-contained until the share pipeline is wired.
   */
  readonly onShareTeam?: (period: { month: string; competition: CompetitionFilter }) => void;
}

/**
 * The Time da Comunidade do Mês page: a tactical formation of the best-rated
 * players for a selected month and competition.
 *
 * @param props - See {@link TimeDoMesPageProps}.
 * @returns The `/time-do-mes` route composition.
 */
export function TimeDoMesPage({ onShareTeam }: TimeDoMesPageProps = {}): JSX.Element {
  const { t } = useI18n();
  const services = useServices();

  const squad = useQuery<Player[]>(() => services.squad.getSquad(), []);
  const scores = useQuery<GameScore[]>(() => services.scores.getAllGameScores(), []);
  const fixtures = useQuery<Fixture[]>(() => services.fixtures.getFixtures(), []);

  // Period selection (Requirement 25.1). `null` month follows the latest month.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [competition, setCompetition] = useState<CompetitionFilter>(ALL_COMPETITIONS);

  // fixtureId -> competition, so ratings (which lack a competition) can be
  // filtered by the selected competition (Requirement 25.1).
  const competitionByFixture = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const fixture of fixtures.data ?? []) {
      map.set(fixture.id, fixture.competition);
    }
    return map;
  }, [fixtures.data]);

  // Distinct months present in the ratings, newest first (Requirement 25.1).
  const months = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const score of scores.data ?? []) {
      const key = monthKey(score.fixtureDate);
      if (key !== '') set.add(key);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [scores.data]);

  // Distinct competitions present in the rated fixtures (Requirement 25.1).
  const competitions = useMemo<number[]>(() => {
    const set = new Set<number>();
    for (const score of scores.data ?? []) {
      const comp = competitionByFixture.get(score.fixtureId);
      if (comp !== undefined) set.add(comp);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [scores.data, competitionByFixture]);

  // Effective month falls back to the latest available month.
  const effectiveMonth =
    selectedMonth !== null && months.includes(selectedMonth) ? selectedMonth : months[0];

  // Ratings scoped to the selected period, filtered entirely client-side so
  // changing the selectors never hits Supabase (Requirement 25.5).
  const periodScores = useMemo<GameScore[]>(() => {
    if (effectiveMonth === undefined) return [];
    return (scores.data ?? []).filter((score) => {
      if (monthKey(score.fixtureDate) !== effectiveMonth) return false;
      if (competition === ALL_COMPETITIONS) return true;
      return competitionByFixture.get(score.fixtureId) === competition;
    });
  }, [scores.data, effectiveMonth, competition, competitionByFixture]);

  // Position-aware selection into the 4-3-3 formation (Requirements 25.2, 25.3).
  const team = useMemo<TeamOfMonthSlot[]>(
    () => buildTeamOfMonth(periodScores, squad.data ?? [], FORMATION),
    [periodScores, squad.data],
  );

  const filledSlots = useMemo(
    () => team.filter((slot) => slot.player !== null),
    [team],
  );

  // The formation is complete only when every slot found an eligible player.
  const isComplete = team.length > 0 && filledSlots.length === team.length;

  // Team statistics over the filled slots (Requirement 25.4).
  const teamAverage = useMemo<number>(() => {
    if (filledSlots.length === 0) return 0;
    const sum = filledSlots.reduce((acc, slot) => acc + (slot.avg ?? 0), 0);
    return round1(sum / filledSlots.length);
  }, [filledSlots]);

  const totalVotes = useMemo<number>(
    () => filledSlots.reduce((acc, slot) => acc + slot.votes, 0),
    [filledSlots],
  );

  // Slots grouped into pitch rows (attack → goal) for the tactical layout.
  const rows = useMemo(
    () =>
      ROW_ORDER.map((position) => ({
        position,
        slots: team.filter((slot) => slot.requiredPosition === position),
      })).filter((row) => row.slots.length > 0),
    [team],
  );

  const isInitialLoading =
    (squad.loading && squad.data === undefined) ||
    (scores.loading && scores.data === undefined) ||
    (fixtures.loading && fixtures.data === undefined);

  const squadLoadFailed = squad.error !== null && squad.data === undefined;

  const retry = (): void => {
    squad.refetch();
    scores.refetch();
    fixtures.refetch();
  };

  const handleShare = (): void => {
    if (effectiveMonth === undefined) return;
    // Callback stub — the shareable image pipeline is wired by a later task
    // (Requirement 27.2). Falls back to a no-op when no handler is provided.
    onShareTeam?.({ month: effectiveMonth, competition });
  };

  return (
    <section className={styles.page} aria-busy={isInitialLoading}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('teamOfMonth.title')}</h1>
        <p className={styles.subtitle}>{t('teamOfMonth.subtitle')}</p>
      </header>

      {/* Period selectors (Requirement 25.1). Hidden until the first load has data. */}
      {!isInitialLoading && !squadLoadFailed && months.length > 0 && (
        <div className={styles.controls}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="tdm-month">
              {t('teamOfMonth.selectMonth')}
            </label>
            <select
              id="tdm-month"
              className={styles.select}
              value={effectiveMonth ?? ''}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {months.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="tdm-competition">
              {t('teamOfMonth.selectCompetition')}
            </label>
            <select
              id="tdm-competition"
              className={styles.select}
              value={competition}
              onChange={(event) => {
                const { value } = event.target;
                setCompetition(value === ALL_COMPETITIONS ? ALL_COMPETITIONS : Number(value));
              }}
            >
              <option value={ALL_COMPETITIONS}>{t('teamOfMonth.allCompetitions')}</option>
              {competitions.map((comp) => (
                <option key={comp} value={comp}>
                  {COMPETITION_LABEL_KEY[comp] ? t(COMPETITION_LABEL_KEY[comp]) : String(comp)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.spacer} />

          {isComplete && (
            <Button
              variant="secondary"
              size="md"
              labelKey="teamOfMonth.share"
              onClick={handleShare}
            />
          )}
        </div>
      )}

      {/* Loading: card-shaped skeletons (Requirement 25.8). */}
      {isInitialLoading && (
        <div className={styles.skeletonPitch}>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <Skeleton key={index} shape="card" />
          ))}
        </div>
      )}

      {/* Squad failed to load: explicit error with retry. */}
      {!isInitialLoading && squadLoadFailed && (
        <EmptyState messageKey="teamOfMonth.loadError" actionKey="common.retry" onAction={retry} />
      )}

      {/* Insufficient data to complete the formation (Requirement 25.6). */}
      {!isInitialLoading && !squadLoadFailed && !isComplete && (
        <EmptyState messageKey="teamOfMonth.insufficient" />
      )}

      {/* Complete team: period summary, tactical pitch and statistics. */}
      {!isInitialLoading && !squadLoadFailed && isComplete && effectiveMonth !== undefined && (
        <>
          <div className={styles.periodSummary}>
            <span className={styles.periodMonth}>{formatMonthLabel(effectiveMonth)}</span>
            {competition !== ALL_COMPETITIONS ? (
              <CompetitionBadge competition={competition} />
            ) : (
              <span className={styles.periodAll}>{t('teamOfMonth.allCompetitions')}</span>
            )}
            <span className={styles.formationName}>{FORMATION.name}</span>
          </div>

          <div className={styles.pitch}>
            {rows.map((row) => (
              <div key={row.position} className={styles.pitchRow}>
                {row.slots.map((slot, index) =>
                  slot.player !== null ? (
                    <Link
                      key={slot.player.id}
                      className={styles.cardLink}
                      to={playerHref(slot.player.id)}
                    >
                      <PlayerCard
                        player={slot.player}
                        seasonAvg={slot.avg}
                        votes={slot.votes}
                        variant="compact"
                      />
                    </Link>
                  ) : (
                    <div key={`${row.position}-${index}`} className={styles.emptySlot} />
                  ),
                )}
              </div>
            ))}
          </div>

          <section className={styles.stats} aria-label={t('teamOfMonth.stats.title')}>
            <h2 className={styles.statsTitle}>{t('teamOfMonth.stats.title')}</h2>
            <div className={styles.statsGrid}>
              <StatCard labelKey="teamOfMonth.stats.teamAverage" value={teamAverage} countUp />
              <StatCard labelKey="teamOfMonth.stats.totalVotes" value={totalVotes} countUp />
              <StatCard
                labelKey="teamOfMonth.stats.selectedPlayers"
                value={filledSlots.length}
                countUp
              />
            </div>
          </section>
        </>
      )}
    </section>
  );
}
