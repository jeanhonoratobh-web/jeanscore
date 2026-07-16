/**
 * `MatchDetailPage` — the match detail route (`/jogo/:id`)
 * (Requirements 19.3, 19.11, 22.1, 22.2, 22.4, 23.1, 23.2).
 *
 * Composes the reusable component library into the full detail view of a single
 * fixture. It reads the fixture id from the `:id` path parameter (via
 * {@link useParams}, with an optional `fixtureId` prop override for testing) and
 * loads, through {@link useQuery} over the injected Services: the fixture, its
 * {@link Lineup}, the full squad (to resolve each called-up player), every
 * community rating, the approved-user list (for the participation percentage),
 * the "Craque da Partida" tally and — for the authenticated user — their prior
 * ratings and their pre-match prediction (Palpite).
 *
 * When the id does not exist in the fixtures table the page renders the 404
 * {@link NotFoundPage} with the "Partida não encontrada" message
 * (Requirement 19.11). For a resolved fixture it shows the score/teams,
 * competition, date, stadium and status (Requirement 19.3); the lineup ordered
 * by Nota_de_Jogo descending with players without votes at the end
 * (Requirement 19.5); the best/worst player and the squad average
 * (Requirement 19.6); the participant count and participation percentage
 * (Requirement 19.7); an "Avaliar/Editar" action when the fixture is released
 * (Requirements 19.8, 19.9); the "Craque da Partida" voting shown only for a
 * released fixture and distinct from the 0-10 ratings, with the current leader
 * and vote counts (Requirements 22.1, 22.2, 22.4); and a Palpite panel that lets
 * the authenticated user submit/edit a score prediction before kickoff and locks
 * once the kickoff timestamp is reached (Requirements 23.1, 23.2).
 *
 * All analytics are derived client-side with the pure `domain` layer, every
 * visual value comes from Design_Tokens through the co-located CSS module
 * (Requirement 3.4) and every string resolves via {@link useI18n}
 * (Requirements 2.4, 3.3).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompetitionBadge } from '@components/controls';
import { EmptyState, Skeleton } from '@components/feedback';
import { calcAverage } from '@domain/index';
import { useAuth } from '@/context/AuthContext';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/index';
import type { CraqueTally } from '@/types/service';
import type { Fixture, GameScore, Player, Prediction, User } from '@/types/domain';
import type { FixtureStatus } from '@/types/domain';
import { NotFoundPage } from './NotFoundPage';
import styles from './MatchDetailPage.module.css';

/** Placeholder shown for a not-yet-available score (Requirement 19.3). */
const EMPTY_SCORE = '—';

/** Lowest score selectable in the Palpite form. */
const PREDICTION_MIN = 0;
/** Highest score selectable in the Palpite form. */
const PREDICTION_MAX = 20;

/** Maps a {@link FixtureStatus} to its i18n label key. */
const STATUS_KEY: Record<FixtureStatus, I18nKey> = {
  notstarted: 'match.status.notstarted',
  inprogress: 'match.status.inprogress',
  finished: 'match.status.finished',
  postponed: 'match.status.postponed',
};

/** Props for {@link MatchDetailPage}. */
export interface MatchDetailPageProps {
  /**
   * The fixture id to display. When omitted it is read from the current route
   * `:id` parameter so the page works from the router table directly.
   */
  readonly fixtureId?: string;
}

/** A lineup player enriched with their community Nota_de_Jogo and vote count. */
interface LineupRow {
  /** The called-up player. */
  readonly player: Player;
  /** Nota_de_Jogo (mean of the player's ratings), or `null` when unrated. */
  readonly average: number | null;
  /** Number of ratings behind {@link LineupRow.average}. */
  readonly votes: number;
}

/** The data the page needs, loaded together through a single {@link useQuery}. */
interface MatchDetailData {
  /** The fixture being shown, or `null` when it does not exist. */
  readonly fixture: Fixture | null;
  /** Lineup rows ordered by average (desc), unrated players last. */
  readonly lineup: LineupRow[];
  /** Highest-rated lineup player, or `null` when nobody has votes. */
  readonly best: LineupRow | null;
  /** Lowest-rated lineup player, or `null` when nobody has votes. */
  readonly worst: LineupRow | null;
  /** Mean of the rated players' Notas_de_Jogo, or `null` when none exist. */
  readonly squadAverage: number | null;
  /** Distinct authenticated users who rated the fixture. */
  readonly participants: number;
  /** Number of approved users (denominator of the participation percentage). */
  readonly approvedUsers: number;
  /** Whether the current user already rated the fixture (Avaliar vs Editar). */
  readonly hasRated: boolean;
  /** "Craque da Partida" vote tally for the fixture (Requirement 22.4). */
  readonly craque: CraqueTally;
  /** Player display name lookup, for the craque results. */
  readonly playerNameById: Map<string, string>;
  /** The current user's existing prediction, or `null`. */
  readonly prediction: Prediction | null;
}

/** Formats a numeric score to one decimal place, or a dash when `null`. */
function formatScore(value: number | null): string {
  return value === null ? EMPTY_SCORE : value.toFixed(1);
}

/**
 * Builds the router-relative `/avaliar/:fixtureId` path. It is consumed by a
 * React Router {@link Link}, so the router `basename` prepends the GitHub Pages
 * subpath automatically (no manual base handling needed).
 */
function rateHref(fixtureId: string): string {
  return `/avaliar/${encodeURIComponent(fixtureId)}`;
}

/**
 * Aggregates every rating for a fixture into per-player rows and counts the
 * distinct voters (pure).
 *
 * @param scores - All ratings submitted for the fixture.
 * @param players - The lineup players, in lineup order.
 * @returns Ordered lineup rows, the best/worst rows, the squad average and the
 *   number of distinct participants.
 */
function aggregateLineup(
  scores: readonly GameScore[],
  players: readonly Player[],
): {
  lineup: LineupRow[];
  best: LineupRow | null;
  worst: LineupRow | null;
  squadAverage: number | null;
  participants: number;
} {
  const byPlayer = new Map<string, number[]>();
  const voters = new Set<string>();
  for (const score of scores) {
    voters.add(score.username);
    const list = byPlayer.get(score.playerId);
    if (list === undefined) {
      byPlayer.set(score.playerId, [score.score]);
    } else {
      list.push(score.score);
    }
  }

  const rows: LineupRow[] = players.map((player) => {
    const values = byPlayer.get(player.id) ?? [];
    return {
      player,
      average: values.length > 0 ? calcAverage(values) : null,
      votes: values.length,
    };
  });

  // Rated players first (by average desc), unrated players kept at the end in
  // lineup order (Requirement 19.5).
  const rated = rows
    .filter((row) => row.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  const unrated = rows.filter((row) => row.average === null);
  const lineup = [...rated, ...unrated];

  const best = rated[0] ?? null;
  const worst = rated.length > 0 ? (rated[rated.length - 1] ?? null) : null;
  const squadAverage =
    rated.length > 0 ? calcAverage(rated.map((row) => row.average ?? 0)) : null;

  return { lineup, best, worst, squadAverage, participants: voters.size };
}

/**
 * The match detail page: score, lineup, community stats, Craque da Partida
 * voting and the Palpite panel.
 *
 * @param props - See {@link MatchDetailPageProps}.
 * @returns The match detail composition, or the 404 page when the id is unknown.
 */
export function MatchDetailPage({ fixtureId }: MatchDetailPageProps = {}): JSX.Element {
  const { t } = useI18n();
  const { session } = useAuth();
  const { showToast } = useToast();
  const {
    fixtures: fixtureService,
    squad: squadService,
    scores: scoreService,
    users: userService,
    craque: craqueService,
    predictions: predictionService,
    fanScore,
  } = useServices();

  const params = useParams<{ id: string }>();
  // The prop wins; otherwise use the route `:id` parameter.
  const resolvedId = fixtureId ?? params.id ?? '';
  const username = session?.username ?? null;

  const { data, loading, error, refetch } = useQuery<MatchDetailData>(async () => {
    const fixture = await fixtureService.getFixture(resolvedId);
    if (fixture === null) {
      return {
        fixture: null,
        lineup: [],
        best: null,
        worst: null,
        squadAverage: null,
        participants: 0,
        approvedUsers: 0,
        hasRated: false,
        craque: { fixtureId: resolvedId, results: [], totalVotes: 0 },
        playerNameById: new Map<string, string>(),
        prediction: null,
      };
    }

    const [lineupData, squad, allScores, users, craque, userScores, prediction] =
      await Promise.all([
        fixtureService.getLineup(resolvedId),
        squadService.getSquad(),
        scoreService.getAllGameScores(),
        userService.getUsers(),
        craqueService.getVotes(resolvedId),
        username === null
          ? Promise.resolve(new Map<string, number>())
          : scoreService.getUserScores(resolvedId, username),
        username === null
          ? Promise.resolve<Prediction | null>(null)
          : predictionService.getPrediction(resolvedId, username),
      ]);

    const byId = new Map<string, Player>(squad.map((player) => [player.id, player]));
    const players = lineupData.playerIds
      .map((id) => byId.get(id))
      .filter((player): player is Player => player !== undefined);

    const fixtureScores = allScores.filter((score) => score.fixtureId === resolvedId);
    const { lineup, best, worst, squadAverage, participants } = aggregateLineup(
      fixtureScores,
      players,
    );

    const playerNameById = new Map<string, string>(
      squad.map((player) => [player.id, player.name]),
    );

    return {
      fixture,
      lineup,
      best,
      worst,
      squadAverage,
      participants,
      approvedUsers: users.filter((user: User) => user.status === 'approved').length,
      hasRated: userScores.size > 0,
      craque,
      playerNameById,
      prediction,
    };
  }, [resolvedId, username]);

  // ---- Craque da Partida voting state -------------------------------------
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState<boolean>(false);

  // ---- Palpite (prediction) form state ------------------------------------
  const [predHome, setPredHome] = useState<string>('');
  const [predAway, setPredAway] = useState<string>('');
  const [predSubmitting, setPredSubmitting] = useState<boolean>(false);

  // Pre-fill the prediction form with the user's existing prediction so
  // returning before kickoff shows the previous guess (Requirement 23.3).
  useEffect(() => {
    const prediction = data?.prediction ?? null;
    setPredHome(prediction?.homeScore != null ? String(prediction.homeScore) : '');
    setPredAway(prediction?.awayScore != null ? String(prediction.awayScore) : '');
  }, [data]);

  const fixture = data?.fixture ?? null;

  const predictionsLocked = useMemo(
    () => (fixture === null ? true : Date.now() >= fixture.ts * 1000),
    [fixture],
  );

  const participationPct = useMemo(() => {
    if (data === undefined || data.approvedUsers === 0) {
      return 0;
    }
    return Math.round((data.participants / data.approvedUsers) * 100);
  }, [data]);

  /**
   * Registers the current user's Craque da Partida vote for a player, keeping a
   * single active vote per user (Requirements 22.2, 22.3), then awards the
   * corresponding Fan Score (Requirement 22.6) and refreshes the tally.
   */
  const handleVote = async (playerId: string): Promise<void> => {
    if (username === null || voting) {
      return;
    }
    setVoting(true);
    const result = await craqueService.vote(resolvedId, playerId, username);
    if (!result.ok) {
      showToast('error', 'state.error');
      setVoting(false);
      return;
    }
    setMyVote(playerId);
    // Award the corresponding Fan Score (Requirement 22.6); a failed award never
    // blocks the successful vote.
    const award = await fanScore.awardAction(username, 'vote_craque');
    if (award.ok) {
      const points = fanScore.getConfig().actionPoints.vote_craque;
      showToast('info', 'fanScore.gain', { points });
    }
    refetch();
    setVoting(false);
  };

  /**
   * Submits (or edits) the current user's score prediction for the fixture. The
   * Service blocks the write once kickoff is reached (Requirement 23.2); a
   * blocked attempt surfaces the locked message.
   */
  const handlePredict = async (): Promise<void> => {
    if (username === null || predSubmitting) {
      return;
    }
    setPredSubmitting(true);
    const homeScore = predHome === '' ? null : Number.parseInt(predHome, 10);
    const awayScore = predAway === '' ? null : Number.parseInt(predAway, 10);
    const result = await predictionService.submit({
      fixtureId: resolvedId,
      username,
      homeScore,
      awayScore,
    });
    if (result.ok) {
      showToast('success', 'prediction.title');
      refetch();
    } else {
      showToast('error', 'prediction.locked');
    }
    setPredSubmitting(false);
  };

  // ---- Render -------------------------------------------------------------

  if (loading && data === undefined) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton shape="card" />
        <Skeleton shape="list" count={6} />
      </div>
    );
  }

  if ((error !== null && data === undefined) || fixture === null) {
    // Unknown id (or an unrecoverable load) → 404 "Partida não encontrada"
    // (Requirement 19.11).
    return <NotFoundPage variant="match" />;
  }

  const { lineup, best, worst, squadAverage, participants, hasRated, craque, playerNameById } =
    data as MatchDetailData;
  const leader = craque.results[0] ?? null;

  return (
    <div className={styles.page}>
      {/* Scoreboard (Requirement 19.3). */}
      <header className={styles.scoreboard}>
        <div className={styles.meta}>
          <CompetitionBadge competition={fixture.competition} />
          <span className={styles.status}>{t(STATUS_KEY[fixture.status])}</span>
        </div>
        <div className={styles.teams}>
          <span className={styles.team}>{fixture.homeTeam}</span>
          <span className={styles.score}>
            {fixture.homeScore ?? EMPTY_SCORE}
            <span className={styles.scoreSep} aria-hidden="true">
              ×
            </span>
            {fixture.awayScore ?? EMPTY_SCORE}
          </span>
          <span className={styles.team}>{fixture.awayTeam}</span>
        </div>
        <div className={styles.info}>
          <span className={styles.date}>{fixture.fixtureDate}</span>
          {fixture.stadium !== null && (
            <span className={styles.stadium}>
              {t('match.stadium')}: {fixture.stadium}
            </span>
          )}
        </div>

        {/* Avaliar / Editar action (Requirements 19.8, 19.9). */}
        {fixture.liberado && (
          <Link className={styles.rateAction} to={rateHref(fixture.id)}>
            {hasRated ? t('match.action.editRating') : t('match.action.rate')}
          </Link>
        )}
      </header>

      {/* Community summary: best, worst, average, participation
          (Requirements 19.6, 19.7). */}
      <section className={styles.summary} aria-label={t('match.lineup.title')}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('match.bestPlayer')}</span>
          <span className={styles.statValue}>
            {best !== null ? `${best.player.name} (${formatScore(best.average)})` : t('state.noData')}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('match.worstPlayer')}</span>
          <span className={styles.statValue}>
            {worst !== null
              ? `${worst.player.name} (${formatScore(worst.average)})`
              : t('state.noData')}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('match.averageScore')}</span>
          <span className={styles.statValue}>{formatScore(squadAverage)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('match.participation')}</span>
          <span className={styles.statValue}>
            {participants} ({participationPct}%)
          </span>
        </div>
      </section>

      {/* Lineup ordered by Nota_de_Jogo (Requirements 19.4, 19.5). */}
      <section className={styles.section} aria-label={t('match.lineup.title')}>
        <h2 className={styles.sectionTitle}>{t('match.lineup.title')}</h2>
        {lineup.length === 0 ? (
          <EmptyState messageKey="state.empty" />
        ) : (
          <ul className={styles.lineup}>
            {lineup.map((row) => (
              <li key={row.player.id} className={styles.lineupItem}>
                <span className={styles.playerName}>{row.player.name}</span>
                <span className={styles.playerScore}>{formatScore(row.average)}</span>
                <span className={styles.playerVotes}>
                  {row.votes} {t('player.votes')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Craque da Partida voting — only for a released fixture, distinct from
          the 0-10 ratings (Requirements 22.1, 22.2, 22.4). */}
      {fixture.liberado && (
        <section className={styles.section} aria-label={t('craque.title')}>
          <h2 className={styles.sectionTitle}>{t('craque.title')}</h2>

          {leader !== null && (
            <p className={styles.craqueLeader}>
              {t('craque.result')}:{' '}
              <strong>{playerNameById.get(leader.playerId) ?? leader.playerId}</strong>{' '}
              ({leader.votes} {t('craque.votes')})
            </p>
          )}

          {username === null ? (
            <EmptyState messageKey="guard.authRequired" />
          ) : (
            <ul className={styles.craqueList}>
              {lineup.map((row) => {
                const tally = craque.results.find((r) => r.playerId === row.player.id);
                const voted = myVote === row.player.id;
                return (
                  <li key={row.player.id} className={styles.craqueItem}>
                    <span className={styles.playerName}>{row.player.name}</span>
                    <span className={styles.craqueCount}>
                      {tally?.votes ?? 0} {t('craque.votes')}
                    </span>
                    <button
                      type="button"
                      className={styles.voteButton}
                      disabled={voting}
                      aria-pressed={voted}
                      onClick={() => void handleVote(row.player.id)}
                    >
                      {voted ? t('craque.voted') : t('craque.vote')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Palpite panel: submit/edit a score prediction before kickoff, locked
          once the kickoff timestamp is reached (Requirements 23.1, 23.2). */}
      <section className={styles.section} aria-label={t('prediction.title')}>
        <h2 className={styles.sectionTitle}>{t('prediction.title')}</h2>

        {username === null ? (
          <EmptyState messageKey="guard.authRequired" />
        ) : predictionsLocked ? (
          <EmptyState messageKey="prediction.locked" />
        ) : (
          <form
            className={styles.predictionForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handlePredict();
            }}
          >
            <span className={styles.predictionLabel}>{t('prediction.scoreLabel')}</span>
            <div className={styles.predictionInputs}>
              <label className={styles.predictionTeam} htmlFor="predict-home">
                {fixture.homeTeam}
              </label>
              <input
                id="predict-home"
                className={styles.predictionInput}
                type="number"
                min={PREDICTION_MIN}
                max={PREDICTION_MAX}
                value={predHome}
                disabled={predSubmitting}
                aria-label={`${t('prediction.scoreLabel')} ${fixture.homeTeam}`}
                onChange={(event) => setPredHome(event.target.value)}
              />
              <span className={styles.predictionSep} aria-hidden="true">
                ×
              </span>
              <input
                id="predict-away"
                className={styles.predictionInput}
                type="number"
                min={PREDICTION_MIN}
                max={PREDICTION_MAX}
                value={predAway}
                disabled={predSubmitting}
                aria-label={`${t('prediction.scoreLabel')} ${fixture.awayTeam}`}
                onChange={(event) => setPredAway(event.target.value)}
              />
              <label className={styles.predictionTeam} htmlFor="predict-away">
                {fixture.awayTeam}
              </label>
            </div>
            <button
              type="submit"
              className={styles.predictionSubmit}
              disabled={predSubmitting}
            >
              {t('prediction.submit')}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
