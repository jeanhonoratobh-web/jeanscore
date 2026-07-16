/**
 * `RadarChart` — player attribute radar with overlay support (Requirements
 * 16.3, 17.3, 29.3).
 *
 * Plots one or two players' attribute profiles on a shared set of radial axes.
 * A single {@link RadarSeries} renders one profile; two series render both
 * overlaid for the Comparação_de_Jogadores (Requirement 29.3). Series colors
 * come exclusively from Design_Tokens via {@link chartPalette}; no literal
 * color is used (Requirement 29.5).
 */
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { chartPalette, tokens } from '@theme/tokens';
import styles from './charts.module.css';

/** Radial axis lower bound: minimum attribute value. */
const AXIS_MIN = 0;
/** Radial axis upper bound: maximum attribute value. */
const AXIS_MAX = 10;

/** A single attribute reading on the radar's radial axes. */
export interface RadarAttribute {
  /** Human-facing attribute label rendered on a radial axis. */
  readonly axis: string;
  /** Attribute value, expected within `[0, 10]`. */
  readonly value: number;
}

/** One player's attribute profile plotted on the radar (Requirement 29.3). */
export interface RadarSeries {
  /** Player name used for the legend and tooltip. */
  readonly name: string;
  /** Attribute readings; every series should share the same `axis` set. */
  readonly attributes: RadarAttribute[];
}

/** Shape of a merged datum passed to Recharts, keyed by axis then series name. */
type RadarDatum = Record<string, string | number>;

/**
 * Merges every series into the row-per-axis shape Recharts expects, using the
 * axis order of the first series as the canonical order.
 *
 * @param series - The one or two player profiles to plot.
 * @returns One datum per axis, with a numeric key per series name.
 */
function toChartData(series: RadarSeries[]): RadarDatum[] {
  const [first] = series;
  if (first === undefined) return [];

  return first.attributes.map((attribute) => {
    const datum: RadarDatum = { axis: attribute.axis };
    for (const entry of series) {
      const match = entry.attributes.find((a) => a.axis === attribute.axis);
      datum[entry.name] = match ? match.value : 0;
    }
    return datum;
  });
}

/** Props for {@link RadarChart}. */
export interface RadarChartProps {
  /** One or two player profiles to plot; two are overlaid (Requirement 29.3). */
  readonly series: RadarSeries[];
}

/**
 * Renders the attribute radar for one or two overlaid players.
 *
 * @param props - See {@link RadarChartProps}.
 * @returns The radar chart element.
 */
export function RadarChart({ series }: RadarChartProps): JSX.Element {
  const data = toChartData(series);

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid stroke={tokens.color.border} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: tokens.color.textMuted }} />
          <PolarRadiusAxis
            domain={[AXIS_MIN, AXIS_MAX]}
            stroke={tokens.color.border}
            tick={{ fill: tokens.color.textMuted }}
          />
          {series.map((entry, index) => {
            const color = chartPalette[index % chartPalette.length];
            return (
              <Radar
                key={entry.name}
                name={entry.name}
                dataKey={entry.name}
                stroke={color}
                fill={color}
                fillOpacity={0.3}
                isAnimationActive={false}
              />
            );
          })}
          <Tooltip
            contentStyle={{
              background: tokens.color.surface,
              border: `1px solid ${tokens.color.border}`,
              color: tokens.color.text,
            }}
            labelStyle={{ color: tokens.color.textMuted }}
          />
          {series.length > 1 && <Legend />}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
