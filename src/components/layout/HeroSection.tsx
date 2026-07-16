/**
 * `HeroSection` — page hero banner (Requirements 3.2, 11.2).
 *
 * A reusable, page-independent layout block that renders a prominent display
 * title and an optional supporting subtitle. Both texts are resolved from
 * {@link I18nKey}s (never hardcoded pt-BR literals, Requirement 3.3) and every
 * visual value comes from Design_Tokens via a co-located CSS module
 * (Requirement 3.4). It anchors the top of the HomePage hierarchy but can be
 * reused by any page that needs a hero (Requirement 3.6).
 */
import type { I18nKey } from '@i18n/keys';
import { useI18n } from '@i18n/index';
import styles from './HeroSection.module.css';

/** Props for {@link HeroSection}. */
export interface HeroSectionProps {
  /** i18n key resolved to the hero's main display title (Requirement 11.2). */
  readonly titleKey: I18nKey;
  /** Optional i18n key resolved to a supporting subtitle beneath the title. */
  readonly subtitleKey?: I18nKey;
}

/**
 * Renders a themed, internationalized hero banner.
 *
 * The title is emitted as the section's `<h1>` so the hero doubles as the page
 * heading; the subtitle renders only when `subtitleKey` is supplied.
 *
 * @param props - See {@link HeroSectionProps}.
 * @returns The hero section element.
 */
export function HeroSection({ titleKey, subtitleKey }: HeroSectionProps): JSX.Element {
  const { t } = useI18n();

  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{t(titleKey)}</h1>
        {subtitleKey !== undefined && <p className={styles.subtitle}>{t(subtitleKey)}</p>}
      </div>
    </section>
  );
}
