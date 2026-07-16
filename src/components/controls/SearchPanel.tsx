/**
 * `SearchPanel` — global search overlay (Requirement 13).
 *
 * A controlled overlay that searches players, matches and competitions
 * simultaneously and entirely client-side, without extra Supabase requests
 * (Requirements 13.1, 13.2). Results are grouped by category (Jogadores,
 * Jogos, Competições) and each category shows at most five entries
 * (Requirement 13.3). Matching is delegated to the pure {@link search} domain
 * helper, so it ignores accents and letter case (Requirement 13.9) and never
 * throws on regex-like input.
 *
 * Keyboard behaviour:
 * - While open, pressing `Escape` closes the panel via `onClose`
 *   (Requirement 13.6).
 * - While open, pressing `/` (when focus is not already inside a form field)
 *   moves focus back to the search input for fast keyboard access
 *   (Requirement 13.7). Opening the panel is controlled by the parent through
 *   the `open` prop, which the layout toggles on the global `/` shortcut.
 *
 * When the debounced term yields nothing in any category, the panel shows the
 * localized empty state "Nenhum resultado para '{term}'" (Requirement 13.8).
 * Clicking a player or match result navigates to its detail route and closes
 * the panel (Requirements 13.4, 13.5).
 *
 * Text is resolved exclusively through {@link I18nKey}s (Requirements 2.4, 3.3)
 * and all styling comes from Design_Tokens (Requirement 3.4). The component is
 * page-independent and reusable (Requirement 3.6).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Fixture, Player } from '@/types/domain';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import { useServices } from '@context/ServicesContext';
import { useDebounce } from '@hooks/useDebounce';
import { search } from '@domain/search';
import styles from './SearchPanel.module.css';

/** Props for {@link SearchPanel}. */
export interface SearchPanelProps {
  /** Whether the search overlay is visible. When `false`, nothing is rendered. */
  readonly open: boolean;
  /** Invoked on Escape, backdrop click, close button, or after navigating. */
  readonly onClose: () => void;
}

/** Debounce applied to the live query before filtering (Requirement 13.1). */
const SEARCH_DEBOUNCE_MS = 300;

/** Maximum number of results rendered per category (Requirement 13.3). */
const MAX_RESULTS_PER_CATEGORY = 5;

/**
 * Known competition id → label {@link I18nKey} mappings.
 *
 * Competitions are stored on {@link Fixture} as numeric ids; this table maps the
 * monitored ids to their localized names so they can be searched by name
 * (Requirement 13.2). Unknown ids fall back to a `#id` display label.
 */
const COMPETITION_LABEL_KEYS: Readonly<Record<number, I18nKey>> = {
  71: 'competition.serieA',
  73: 'competition.copaDoBrasil',
  13: 'competition.libertadores',
  620: 'competition.mineiro',
};

/** A searchable competition candidate derived from the loaded fixtures. */
interface CompetitionEntry {
  /** Numeric competition id (unique key). */
  readonly id: number;
  /** Localized display name used for matching and rendering. */
  readonly name: string;
}

/** Detail route for a player profile (Requirement 26.1). */
function playerHref(id: string): string {
  return `/jogador/${id}`;
}

/** Detail route for a match (Requirement 26.1). */
function matchHref(id: string): string {
  return `/jogo/${id}`;
}

/** Human-readable label for a fixture in the results list. */
function fixtureLabel(fixture: Fixture): string {
  return `${fixture.homeTeam} × ${fixture.awayTeam}`;
}

/**
 * Returns `true` when `target` is an editable form field, so the global `/`
 * shortcut does not steal focus while the user is typing elsewhere
 * (Requirement 13.7).
 */
function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Renders the global search overlay.
 *
 * @param props - See {@link SearchPanelProps}.
 * @returns The portaled overlay when `open`, otherwise `null`.
 */
export function SearchPanel({ open, onClose }: SearchPanelProps): JSX.Element | null {
  const { t } = useI18n();
  const services = useServices();
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState<string>('');
  const [players, setPlayers] = useState<readonly Player[]>([]);
  const [fixtures, setFixtures] = useState<readonly Fixture[]>([]);

  const debouncedTerm = useDebounce(term, SEARCH_DEBOUNCE_MS);

  // Load the searchable datasets once the panel opens. Both reads go through
  // the cached Services, so no extra Supabase request is issued per keystroke
  // (Requirements 13.1, 13.2).
  useEffect(() => {
    if (!open) return;

    let active = true;
    void (async () => {
      const [squad, fixtureList] = await Promise.all([
        services.squad.getSquad(),
        services.fixtures.getFixtures(),
      ]);
      if (!active) return;
      setPlayers(squad);
      setFixtures(fixtureList);
    })();

    return () => {
      active = false;
    };
  }, [open, services]);

  // Reset the query and focus the input each time the panel opens.
  useEffect(() => {
    if (!open) return;
    setTerm('');
    inputRef.current?.focus();
  }, [open]);

  // Escape closes the panel; `/` re-focuses the input for keyboard users
  // (Requirements 13.6, 13.7).
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === '/' && !isFormField(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Distinct competitions present in the loaded fixtures, resolved to names.
  const competitions = useMemo<CompetitionEntry[]>(() => {
    const seen = new Set<number>();
    const entries: CompetitionEntry[] = [];
    for (const fixture of fixtures) {
      if (seen.has(fixture.competition)) continue;
      seen.add(fixture.competition);
      const labelKey = COMPETITION_LABEL_KEYS[fixture.competition];
      entries.push({
        id: fixture.competition,
        name: labelKey ? t(labelKey) : `#${fixture.competition}`,
      });
    }
    return entries;
  }, [fixtures, t]);

  const playerResults = useMemo<Player[]>(
    () =>
      search(players, debouncedTerm, (p) => [p.name]).slice(0, MAX_RESULTS_PER_CATEGORY),
    [players, debouncedTerm],
  );

  const matchResults = useMemo<Fixture[]>(
    () =>
      search(fixtures, debouncedTerm, (f) => [f.homeTeam, f.awayTeam]).slice(
        0,
        MAX_RESULTS_PER_CATEGORY,
      ),
    [fixtures, debouncedTerm],
  );

  const competitionResults = useMemo<CompetitionEntry[]>(
    () =>
      search(competitions, debouncedTerm, (c) => [c.name]).slice(
        0,
        MAX_RESULTS_PER_CATEGORY,
      ),
    [competitions, debouncedTerm],
  );

  const trimmedTerm = debouncedTerm.trim();
  const hasResults =
    playerResults.length > 0 || matchResults.length > 0 || competitionResults.length > 0;
  const showEmpty = trimmedTerm !== '' && !hasResults;

  const handleNavigate = useCallback((): void => {
    onClose();
  }, [onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.search')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.searchBar}>
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            placeholder={t('search.placeholder')}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label={t('search.placeholder')}
          />
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            {'\u00D7'}
          </button>
        </div>

        <div className={styles.results}>
          {trimmedTerm === '' && <p className={styles.hint}>{t('search.hint')}</p>}

          {showEmpty && (
            <p className={styles.empty} role="status">
              {t('search.noResults', { term: trimmedTerm })}
            </p>
          )}

          {playerResults.length > 0 && (
            <section className={styles.category}>
              <h3 className={styles.categoryTitle}>{t('search.category.players')}</h3>
              <ul className={styles.list}>
                {playerResults.map((player) => (
                  <li key={player.id}>
                    <a
                      className={styles.item}
                      href={playerHref(player.id)}
                      onClick={handleNavigate}
                    >
                      {player.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {matchResults.length > 0 && (
            <section className={styles.category}>
              <h3 className={styles.categoryTitle}>{t('search.category.matches')}</h3>
              <ul className={styles.list}>
                {matchResults.map((fixture) => (
                  <li key={fixture.id}>
                    <a
                      className={styles.item}
                      href={matchHref(fixture.id)}
                      onClick={handleNavigate}
                    >
                      {fixtureLabel(fixture)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {competitionResults.length > 0 && (
            <section className={styles.category}>
              <h3 className={styles.categoryTitle}>{t('search.category.competitions')}</h3>
              <ul className={styles.list}>
                {competitionResults.map((competition) => (
                  <li key={competition.id}>
                    <a className={styles.item} href="/jogos" onClick={handleNavigate}>
                      {competition.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
