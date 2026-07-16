/**
 * `AvaliarPage` — the per-match rating route (`/avaliar/:fixtureId`)
 * (Requirements 20.1, 20.2, 20.4, 20.5, 20.7, 20.9, 20.10, 9.2).
 *
 * Composes the reusable component library into the rating form for a single
 * fixture. It resolves the target fixture from the `fixtureId` prop (or the
 * `/avaliar/:fixtureId` URL path so the page works before a router library is
 * wired in) and loads, through {@link useQuery} over the injected Services: the
 * fixture, its {@link Lineup}, the full squad (to resolve each called-up
 * player's name) and the authenticated user's existing ratings for the fixture.
 *
 * The user's previous ratings **pre-fill** the form so returning to an
 * already-rated match shows the earlier notes (Requirement 20.4). Each lineup
 * player gets an individual `[0, 10]` rating input with a `0.5` step
 * (Requirements 20.1, 20.2). Submitting disables the button and shows a loading
 * indicator to prevent a double send (Requirement 20.7); on success it shows a
 * confirmation toast, awards the corresponding Fan Score and surfaces the gain
 * (Requirements 20.6, 9.2); on failure it keeps the form open, re-enables the
 * button and shows an error toast (Requirement 20.5). Every score is persisted
 * with the fixture's teams and date for traceability (Requirement 20.10).
 *
 * When the fixture is not released for rating (`liberado = false`) the form is
 * hidden and an explanatory message is shown instead (Requirement 20.9). While
 * the reads are in flight a shape-preserving {@link Skeleton} reserves the
 * layout. Every visual value comes from Design_Tokens through the co-located CSS
 * module (Requirement 3.4) and every string resolves via {@link useI18n}
 * (Requirements 2.4, 3.3).
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { normalizeScore } from '@domain/index';
import { useAuth } from '@/context/AuthContext';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/index';
import type { ScoreEntry } from '@domain/index';
import type { Fixture, Player } from '@/types/domain';
import type { FixtureContext } from '@/types/service';
import styles from './AvaliarPage.module.css';

/** Lowest rating selectable in the form (Requirement 20.2). */
const SCORE_MIN = 0;
/** Highest rating selectable in the form (Requirement 20.2). */
const SCORE_MAX = 10;
/** Granularity of a rating (Requirement 20.2). */
const SCORE_STEP = 0.5;
/** Neutral default applied to players the user has not rated yet. */
const SCORE_DEFAULT = 6;

/** Props for {@link AvaliarPage}. */
export interface AvaliarPageProps {
  /**
   * The fixture id to rate. When omitted it is read from the current URL path
   * (`/avaliar/:fixtureId`) so the page works before a router library is wired
   * in.
   */
  readonly fixtureId?: string;
}

/** The data the page needs, loaded together through a single {@link useQuery}. */
interface AvaliarData {
  /** The fixture being rated, or `null` when it does not exist. */
  readonly fixture: Fixture | null;
  /** Lineup players resolved from the squad, in lineup order. */
  readonly players: Player[];
  /** The user's existing ratings for the fixture (`playerId -> score`). */
  readonly userScores: Map<string, number>;
}

/**
 * Reads the fixture id from the current URL path (`/avaliar/:fixtureId`),
 * tolerating the GitHub Pages base subpath, a trailing slash and any query/hash
 * suffix.
 *
 * @returns The decoded fixture id, or an empty string when the path has none.
 */
function readFixtureIdFromPath(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const marker = '/avaliar/';
  const { pathname } = window.location;
  const index = pathname.indexOf(marker);
  if (index === -1) {
    return '';
  }
  const rest = pathname.slice(index + marker.length);
  const segment = rest.split('/')[0]?.split('?')[0]?.split('#')[0] ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Renders the per-match rating form: one `[0, 10]` step-`0.5` input per lineup
 * player, pre-filled with the user's previous ratings, and a submit action.
 *
 * @param props - See {@link AvaliarPageProps}.
 * @returns The page element.
 */
export function AvaliarPage({ fixtureId }: AvaliarPageProps = {}): JSX.Element {
  const { t } = useI18n();
  const { session } = useAuth();
  const { showToast } = useToast();
  const { fixtures: fixtureService, squad: squadService, scores: scoreService, fanScore } =
    useServices();

  // The prop wins; otherwise fall back to the URL path so deep links work.
  const resolvedId = useMemo(
    () => fixtureId ?? readFixtureIdFromPath(),
    [fixtureId],
  );
  const username = session?.username ?? null;

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<AvaliarData>(async () => {
    const fixture = await fixtureService.getFixture(resolvedId);
    if (fixture === null) {
      return { fixture: null, players: [], userScores: new Map<string, number>() };
    }
    // The lineup, the squad (for names) and the user's prior ratings are
    // independent reads, so fetch them together.
    const [lineup, squad, userScores] = await Promise.all([
      fixtureService.getLineup(resolvedId),
      squadService.getSquad(),
      username === null
        ? Promise.resolve(new Map<string, number>())
        : scoreService.getUserScores(resolvedId, username),
    ]);
    const byId = new Map(squad.map((player) => [player.id, player]));
    const players = lineup.playerIds
      .map((id) => byId.get(id))
      .filter((player): player is Player => player !== undefined);
    return { fixture, players, userScores };
  }, [resolvedId, username]);

  // Per-player rating form state, keyed by player id. Rebuilt whenever the
  // loaded data changes so returning to an already-rated match pre-fills the
  // user's previous notes (Requirement 20.4).
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (data === undefined) {
      return;
    }
    const next: Record<string, number> = {};
    for (const player of data.players) {
      next[player.id] = data.userScores.get(player.id) ?? SCORE_DEFAULT;
    }
    setRatings(next);
  }, [data]);

  const fixture = data?.fixture ?? null;
  const players = data?.players ?? [];

  /** Updates a single player's rating in the form state. */
  const setRating = (playerId: string, value: number): void => {
    setRatings((current) => ({ ...current, [playerId]: value }));
  };

  /**
   * Submits every lineup rating for the fixture (Requirements 20.3, 20.10) and,
   * on success, awards the participation Fan Score (Requirements 20.6, 9.2).
   *
   * Failures keep the form open and re-enable the button so the user can retry
   * (Requirement 20.5); the in-flight state disables the button and shows a
   * spinner to prevent a double send (Requirement 20.7).
   */
  const handleSubmit = async (): Promise<void> => {
    if (fixture === null || username === null || submitting) {
      return;
    }

    const entries: ScoreEntry[] = players.map((player) => ({
      playerId: player.id,
      playerName: player.name,
      score: normalizeScore(ratings[player.id] ?? SCORE_DEFAULT),
    }));

    const ctx: FixtureContext = {
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      fixtureDate: fixture.fixtureDate,
    };

    setSubmitting(true);
    const result = await scoreService.submitScores(resolvedId, entries, username, ctx);

    if (!result.ok) {
      // Keep the form open and re-enable the button (Requirement 20.5).
      showToast('error', 'rate.error');
      setSubmitting(false);
      return;
    }

    // Confirm success and refresh the aggregates/pre-fill (Requirement 20.6).
    showToast('success', 'rate.success');
    refetch();

    // Award the corresponding Fan Score and surface the gain (Requirements
    // 20.6, 9.2). A failed award never blocks the successful rating.
    const award = await fanScore.awardAction(username, 'rate_match');
    if (award.ok) {
      const points = fanScore.getConfig().actionPoints.rate_match;
      showToast('info', 'fanScore.gain', { points });
      if (award.data.leveledUp) {
        const levelKey = `level.${award.data.fanLevel}` as I18nKey;
        showToast('success', 'fanScore.levelUp', { level: t(levelKey) });
      }
    }

    setSubmitting(false);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('rate.title')}</h1>

      {loading && data === undefined ? (
        <Skeleton shape="list" count={6} />
      ) : error !== null && data === undefined ? (
        <EmptyState messageKey="state.error" actionKey="common.retry" onAction={refetch} />
      ) : fixture === null ? (
        <EmptyState messageKey="state.error" actionKey="common.retry" onAction={refetch} />
      ) : !fixture.liberado ? (
        // Match not released for rating: hide the form (Requirement 20.9).
        <EmptyState messageKey="rate.notReleased" />
      ) : players.length === 0 ? (
        <EmptyState messageKey="state.empty" />
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <p className={styles.instructions}>{t('rate.instructions')}</p>

          <ul className={styles.list}>
            {players.map((player) => {
              const value = ratings[player.id] ?? SCORE_DEFAULT;
              const inputId = `rating-${player.id}`;
              return (
                <li key={player.id} className={styles.item}>
                  <label className={styles.playerName} htmlFor={inputId}>
                    {player.name}
                  </label>
                  <div className={styles.control}>
                    <input
                      id={inputId}
                      className={styles.slider}
                      type="range"
                      min={SCORE_MIN}
                      max={SCORE_MAX}
                      step={SCORE_STEP}
                      value={value}
                      disabled={submitting}
                      aria-label={`${t('rate.scoreLabel')} ${player.name}`}
                      aria-valuetext={value.toFixed(1)}
                      onChange={(event) =>
                        setRating(player.id, Number.parseFloat(event.target.value))
                      }
                    />
                    <output className={styles.value} htmlFor={inputId}>
                      {value.toFixed(1)}
                    </output>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              loading={submitting}
              labelKey={submitting ? 'rate.submitting' : 'rate.submit'}
            />
          </div>
        </form>
      )}
    </div>
  );
}
