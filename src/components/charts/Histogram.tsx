/**
 * `Histogram` — score-distribution bar chart (Requirements 16.11, 29.2).
 *
 * Renders the frequency distribution of Nota_de_Jogo values as vertical bars
 * across 10 one-point bands (0–1, 1–2, …, 9–10). The X axis labels each band
 * and the Y axis shows the absolute vote frequency (Requirement 29.2). Bar
 * color comes exclusively from Design_Tokens via {@link chartPalette}; no
 * literal color is used (Requirement 29.5).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@i18n/I18nProvider';
import { chartPalette, tokens } from '@theme/tokens';
import styles from './charts.module.css';

/** Number of one-point bands in the distribution (Requirement 29.2). */
export const BAND_COUNT = 10;

/** Props for {@link Histogram}. */
export interface HistogramProps {
  /**
   * Absolute vote frequency per band, ordered from the `0–1` band to the
   * `9–10` band. Expected length is {@link BAND_COUNT}; extra entries beyond
   * the tenth band are ignored.
   */
  readonly bins: number[];
}

/** Builds the `"0–1" … "9–10"` band label for the band starting at `index`. */
function bandLabel(index: number): string {
  return `${index}\u2013${index + 1}`;
}

/**
 * Renders the score-distribution histogram.
 *
 * @param props - See {@link HistogramProps}.
 * @returns The histogram element.
 */
export function Histogram({ bins }: HistogramProps): JSX.Element {
  const { t } = useI18n();

  const data = Array.from({ length: BAND_COUNT }, (_, index) => ({
    band: bandLabel(index),
    frequency: bins[index] ?? 0,
  }));

  const fill = chartPalette[0];

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={tokens.color.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="band"
            stroke={tokens.color.border}
            tick={{ fill: tokens.color.textMuted }}
          />
          <YAxis
            allowDecimals={false}
            stroke={tokens.color.border}
            tick={{ fill: tokens.color.textMuted }}
          />
          <Tooltip
            cursor={{ fill: tokens.color.primarySoft }}
            contentStyle={{
              background: tokens.color.surface,
              border: `1px solid ${tokens.color.border}`,
              color: tokens.color.text,
            }}
            labelStyle={{ color: tokens.color.textMuted }}
            formatter={(value) => [`${value}`, t('player.votes')]}
          />
          <Bar dataKey="frequency" fill={fill} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
