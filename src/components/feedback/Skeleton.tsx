/**
 * Skeleton — shape-preserving loading placeholder (Requirements 3, 30.7).
 *
 * Rendered immediately while data loads so each section reserves its final
 * layout and swaps to real content without shifting (used per-section across
 * pages, e.g. Requirements 8.9, 11.12, 15.8, 16.12). Styled exclusively via
 * Design_Tokens (Requirement 3.4) and page-independent (Requirement 3.6): the
 * caller picks a `shape` and, for repeating layouts, a `count`.
 *
 * The shimmer is decorative and disabled under `prefers-reduced-motion`
 * (handled in CSS, Requirement 30.7). The element is marked `aria-hidden` since
 * it conveys no information to assistive technology; the surrounding region is
 * responsible for announcing the loading state.
 */
import styles from './Skeleton.module.css';

/** Visual archetype a {@link Skeleton} mimics while its data loads. */
export type SkeletonShape = 'card' | 'list' | 'chart' | 'text';

/** Props for {@link Skeleton}. */
export interface SkeletonProps {
  /**
   * Which content archetype to mimic:
   * - `card` — a Carta_FIFA-shaped block;
   * - `list` — a stack of `count` rows;
   * - `chart` — a graph panel;
   * - `text` — a stack of `count` text lines.
   */
  readonly shape: SkeletonShape;
  /**
   * Number of repeated placeholders for the `list` and `text` shapes.
   * Ignored by `card` and `chart` (which render a single block). Defaults to
   * `3`; values below `1` are treated as `1`.
   */
  readonly count?: number;
}

/** Maps a repeating shape to its per-item CSS class. */
const REPEAT_ITEM_CLASS: Record<'list' | 'text', string> = {
  list: styles.row,
  text: styles.text,
};

/**
 * Renders a token-styled loading placeholder shaped like the incoming content.
 *
 * @param props - See {@link SkeletonProps}.
 * @returns The placeholder element(s); repeating shapes render a group of
 *   `count` items, single shapes render one block.
 */
export function Skeleton({ shape, count }: SkeletonProps): JSX.Element {
  if (shape === 'card' || shape === 'chart') {
    const shapeClass = shape === 'card' ? styles.card : styles.chart;
    return <div aria-hidden="true" className={`${styles.item} ${shapeClass}`} />;
  }

  const total = Math.max(1, count ?? 3);
  const itemClass = REPEAT_ITEM_CLASS[shape];

  return (
    <div aria-hidden="true" className={styles.list}>
      {Array.from({ length: total }, (_, index) => (
        <div key={index} className={`${styles.item} ${itemClass}`} />
      ))}
    </div>
  );
}
