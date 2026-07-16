/**
 * `StatisticsPanel` — side-by-side comparison of labelled metrics
 * (Requirements 3.2, 17.5).
 *
 * Renders one row per metric, showing each of the two subjects' values under a
 * shared, localized label. When `highlightWinner` is enabled (the default), the
 * side holding the superior value for a metric is visually highlighted so the
 * user can immediately see who leads on each metric (Requirement 17.5). A
 * metric whose direction is inverted (lower value wins, e.g. a ranking
 * position) is flagged via {@link LabeledStat.lowerIsBetter}.
 *
 * When either side lacks data for a metric (`null` value), that side shows the
 * localized "Dados insuficientes" text and the metric is not scored, so the
 * remaining metrics still compare normally (Requirement 17.6).
 *
 * Text is resolved exclusively through {@link I18nKey}s (Requirements 2.4, 3.3)
 * and styling comes from Design_Tokens only (Requirement 3.4). The component is
 * page-independent and reusable across comparison contexts (Requirement 3.6).
 */
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import styles from './StatisticsPanel.module.css';

/**
 * A single labelled metric comparing two subjects.
 *
 * The panel compares {@link left} and {@link right}; a `null` value means the
 * subject has insufficient data for the metric (Requirement 17.6). By default a
 * higher value wins the metric; set {@link lowerIsBetter} to invert the
 * comparison for metrics where a smaller value is better.
 */
export interface LabeledStat {
  /** i18n key resolved to the metric label (Requirement 3.3). */
  readonly labelKey: I18nKey;
  /** Left subject's value, or `null` when data is insufficient. */
  readonly left: number | null;
  /** Right subject's value, or `null` when data is insufficient. */
  readonly right: number | null;
  /** When `true`, the lower value is considered superior. Defaults to `false`. */
  readonly lowerIsBetter?: boolean;
}

/** Props for {@link StatisticsPanel}. */
export interface StatisticsPanelProps {
  /** Metrics to compare, rendered one row each. */
  readonly stats: readonly LabeledStat[];
  /**
   * When `true` (default), highlight the superior side per metric
   * (Requirement 17.5).
   */
  readonly highlightWinner?: boolean;
}

/** Which side of a metric holds the superior value. */
type Winner = 'left' | 'right' | 'none';

/**
 * Determines the winning side of a metric.
 *
 * Returns `'none'` when either value is missing (insufficient data,
 * Requirement 17.6) or when the values tie; otherwise the side with the
 * superior value given the metric's direction ({@link LabeledStat.lowerIsBetter}).
 */
function resolveWinner(stat: LabeledStat): Winner {
  const { left, right, lowerIsBetter = false } = stat;
  if (left === null || right === null || left === right) {
    return 'none';
  }
  const leftWins = lowerIsBetter ? left < right : left > right;
  return leftWins ? 'left' : 'right';
}

/** Formats a metric value, or the localized insufficient-data text for `null`. */
function formatValue(value: number | null, insufficient: string): string {
  if (value === null) {
    return insufficient;
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/**
 * Renders a comparative statistics panel with an optional per-metric winner
 * highlight.
 *
 * @param props - See {@link StatisticsPanelProps}.
 * @returns The comparison panel element.
 */
export function StatisticsPanel({
  stats,
  highlightWinner = true,
}: StatisticsPanelProps): JSX.Element {
  const { t } = useI18n();
  const insufficient = t('compare.metric.insufficient');
  const winnerLabel = t('compare.winner');

  return (
    <div className={styles.panel}>
      {stats.map((stat) => {
        const winner = highlightWinner ? resolveWinner(stat) : 'none';
        const leftWon = winner === 'left';
        const rightWon = winner === 'right';

        return (
          <div key={stat.labelKey} className={styles.row}>
            <span
              className={`${styles.value} ${leftWon ? styles.winner : ''}`}
              aria-label={leftWon ? winnerLabel : undefined}
            >
              {formatValue(stat.left, insufficient)}
            </span>
            <span className={styles.label}>{t(stat.labelKey)}</span>
            <span
              className={`${styles.value} ${rightWon ? styles.winner : ''}`}
              aria-label={rightWon ? winnerLabel : undefined}
            >
              {formatValue(stat.right, insufficient)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
