/**
 * `LineChart` — chronological score-evolution line (Requirements 16.8, 29.1,
 * 29.8).
 *
 * Plots a player's {@link EvolutionPoint} series with matches on the X axis in
 * chronological order and the Nota_de_Jogo (0–10) on the Y axis (Requirement
 * 29.1). Colors come exclusively from Design_Tokens via {@link chartPalette}
 * and {@link tokens}; no literal color is used (Requirement 29.5).
 *
 * When fewer than {@link MIN_POINTS} matches are available the chart is replaced
 * by a localized "insufficient data" message; with exactly two points the full
 * line renders (Requirement 29.8).
 */
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EvolutionPoint } from '@domain/index';
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/I18nProvider';
import { chartPalette, tokens } from '@theme/tokens';
import { EmptyState } from '@components/feedback';
import styles from './charts.module.css';

/** Minimum number of evaluated matches required to render the line (Requirement 29.8). */
export const MIN_POINTS = 2;

/** Y-axis lower bound: minimum possible Nota_de_Jogo (Requirement 29.1). */
const SCORE_MIN = 0;
/** Y-axis upper bound: maximum possible Nota_de_Jogo (Requirement 29.1). */
const SCORE_MAX = 10;

/** Props for {@link LineChart}. */
export interface LineChartProps {
  /** Chronologically ordered evolution points (oldest → newest). */
  readonly points: EvolutionPoint[];
  /**
   * i18n key for the message shown when there are fewer than {@link MIN_POINTS}
   * points. Defaults to `player.evolution.insufficient` (Requirement 29.8).
   */
  readonly minPointsMessageKey?: I18nKey;
}

/**
 * Renders the evolution line, or a localized insufficient-data message when
 * fewer than {@link MIN_POINTS} points are supplied.
 *
 * @param props - See {@link LineChartProps}.
 * @returns The line chart element, or the insufficient-data placeholder.
 */
export function LineChart({
  points,
  minPointsMessageKey = 'player.evolution.insufficient',
}: LineChartProps): JSX.Element {
  const { t } = useI18n();

  if (points.length < MIN_POINTS) {
    return <EmptyState messageKey={minPointsMessageKey} />;
  }

  const stroke = chartPalette[0];

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={tokens.color.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke={tokens.color.border}
            tick={{ fill: tokens.color.textMuted }}
          />
          <YAxis
            domain={[SCORE_MIN, SCORE_MAX]}
            stroke={tokens.color.border}
            tick={{ fill: tokens.color.textMuted }}
            allowDecimals
          />
          <Tooltip
            contentStyle={{
              background: tokens.color.surface,
              border: `1px solid ${tokens.color.border}`,
              color: tokens.color.text,
            }}
            labelStyle={{ color: tokens.color.textMuted }}
            formatter={(value) => [`${value}`, t('player.rating')]}
          />
          <Line
            type="monotone"
            dataKey="average"
            stroke={stroke}
            strokeWidth={2}
            dot={{ fill: stroke }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
