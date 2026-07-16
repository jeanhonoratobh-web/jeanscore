/**
 * `CollectionCard` — a data-driven collectible collection (Requirement 18).
 *
 * A page-independent, reusable card that renders a {@link Collection}: its
 * title and the number of cards the user has explored so far, highlighting
 * collections that are still empty as incomplete. The title and every label
 * resolve via {@link useI18n} (Requirement 3.3) and all visual values come from
 * Design_Tokens through the co-located CSS module (Requirement 3.4). When
 * `onCardClick` is provided the card becomes an activatable control reporting
 * the collection id.
 *
 * The prop interface intentionally carries only `explored` (not a total), so
 * progress is presented as an explored-card count rather than a fraction.
 */
import type { KeyboardEvent } from 'react';
import { useI18n } from '@i18n/index';
import type { Collection } from '@/types/domain';
import styles from './CollectionCard.module.css';

/** Props for {@link CollectionCard}. */
export interface CollectionCardProps {
  /** The collection definition to render. */
  collection: Collection;
  /** Number of cards the user has explored in this collection. */
  explored: number;
  /** Invoked with the collection id when the card is activated. */
  onCardClick?: (id: string) => void;
}

/**
 * Renders a themed, internationalized collection card.
 *
 * A collection with nothing explored yet is flagged as incomplete via the
 * `collections.incomplete` label. When `onCardClick` is provided the card is
 * keyboard- and mouse-activatable.
 *
 * @param props - See {@link CollectionCardProps}.
 * @returns The collection card element.
 */
export function CollectionCard({
  collection,
  explored,
  onCardClick,
}: CollectionCardProps): JSX.Element {
  const { t } = useI18n();

  const title = t(collection.titleKey);
  const isIncomplete = explored <= 0;
  const isInteractive = onCardClick !== undefined;

  const handleActivate = (): void => {
    onCardClick?.(collection.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isInteractive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  const className = [styles.card, isIncomplete ? styles.incomplete : ''].join(' ').trim();

  return (
    <div
      className={className}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? title : undefined}
    >
      <p className={styles.title} title={title}>
        {title}
      </p>

      <div className={styles.footer}>
        <span className={styles.explored}>{explored}</span>
        {isIncomplete && (
          <span className={styles.badge}>{t('collections.incomplete')}</span>
        )}
      </div>
    </div>
  );
}
