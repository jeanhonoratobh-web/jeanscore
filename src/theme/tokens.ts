/**
 * Design_Tokens — typed source of truth for the JeanScore visual language.
 *
 * These tokens mirror `DESIGN_SYSTEM.md` (sections 2–8) and are the single
 * source of truth in TypeScript. They are consumed in two ways:
 *
 * 1. As **CSS Custom Properties** (see {@link tokens} → `var(--...)` references),
 *    so components and charts stay themeable: switching `data-theme` on the root
 *    element re-resolves every reference without touching any component
 *    (Requirement 4.1, 4.3).
 * 2. As **literal default values** (see {@link defaultTokens}), the resolved
 *    `cruzeiro` palette. Useful for non-CSS consumers, tests and documentation.
 *
 * No component should ever hardcode a visual value (color, spacing, radius,
 * shadow, duration); it must reference a token from this module or the matching
 * CSS Custom Property (Requirement 4.1, DESIGN_SYSTEM.md §1, §20).
 *
 * @see {@link file://./tokens.css} for the per-theme overrides.
 */

// ---------------------------------------------------------------------------
// Themes (Requirement 4.2)
// ---------------------------------------------------------------------------

/**
 * Identifier of a supported Theme, applied via the `data-theme` root attribute
 * (Requirement 4.2, 4.3). `cruzeiro` is the default and is expressed on
 * `:root` in `tokens.css`.
 */
export type ThemeName =
  | 'cruzeiro'
  | 'dark'
  | 'black-gold'
  | 'retro-2003'
  | 'libertadores';

/** All supported Themes, in presentation order (Requirement 4.2). */
export const THEMES: readonly ThemeName[] = [
  'cruzeiro',
  'dark',
  'black-gold',
  'retro-2003',
  'libertadores',
] as const;

/** Default Theme applied on `:root` when no preference is resolved. */
export const DEFAULT_THEME: ThemeName = 'cruzeiro';

// ---------------------------------------------------------------------------
// Token shape (typed contract shared by TS references and literal values)
// ---------------------------------------------------------------------------

/** Brand, surface, text, semantic and card-rarity colors (DESIGN_SYSTEM.md §2). */
export interface ColorTokens {
  /** Primary brand color — primary actions, links, brand emphasis. */
  primary: string;
  /** Hover/pressed state of the primary color. */
  primaryStrong: string;
  /** Soft primary background — selection, chips, subtle fills. */
  primarySoft: string;
  /** Accent (gold) — premium highlights, legendary cards, prizes. */
  accent: string;
  /** Hover state of the accent color. */
  accentStrong: string;

  /** Application background. */
  bg: string;
  /** Cards, panels, modals. */
  surface: string;
  /** Secondary surface, skeletons. */
  surface2: string;
  /** Borders and dividers. */
  border: string;
  /** Primary text. */
  text: string;
  /** Secondary text, captions. */
  textMuted: string;
  /** Text over dark/primary surfaces. */
  textInverse: string;

  /** Success, high scores. */
  success: string;
  /** Attention, partial success. */
  warning: string;
  /** Error, destructive actions. */
  danger: string;
  /** Neutral information. */
  info: string;

  /** Card rarity: score &lt; 6. */
  rarityBronze: string;
  /** Card rarity: 6 ≤ score &lt; 7. */
  raritySilver: string;
  /** Card rarity: 7 ≤ score &lt; 8. */
  rarityGold: string;
  /** Card rarity: score ≥ 8 (black &amp; gold with glow). */
  rarityLegendary: string;
}

/** A single entry of the typographic scale (DESIGN_SYSTEM.md §3). */
export interface FontScaleToken {
  /** Font size (e.g. `40px`). */
  size: string;
  /** Line height (unitless). */
  lineHeight: string;
  /** Font weight. */
  weight: string;
}

/** Font families and the typographic scale (DESIGN_SYSTEM.md §3). */
export interface FontTokens {
  /** UI font family stack. */
  familyBase: string;
  /** Display font family stack (rating numbers, hero). */
  familyDisplay: string;
  /** Hero / display headings. */
  display: FontScaleToken;
  /** Page title. */
  h1: FontScaleToken;
  /** Section title. */
  h2: FontScaleToken;
  /** Subsection / card title. */
  h3: FontScaleToken;
  /** Default body text. */
  body: FontScaleToken;
  /** Secondary body text. */
  bodySm: FontScaleToken;
  /** Captions, labels, tooltips. */
  caption: FontScaleToken;
}

/** 4px-based spacing scale (DESIGN_SYSTEM.md §4). */
export interface SpaceTokens {
  s0: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  s6: string;
  s7: string;
  s8: string;
}

/** Corner radii (DESIGN_SYSTEM.md §7). */
export interface RadiusTokens {
  sm: string;
  md: string;
  lg: string;
  full: string;
}

/** Elevation shadows (DESIGN_SYSTEM.md §6). */
export interface ShadowTokens {
  s0: string;
  s1: string;
  s2: string;
  s3: string;
  /** Golden glow for legendary cards and premium highlights. */
  glow: string;
}

/** Z-index layers (DESIGN_SYSTEM.md §6). */
export interface ZTokens {
  base: string;
  dropdown: string;
  stickyHeader: string;
  overlay: string;
  modal: string;
  toast: string;
}

/** Motion durations (DESIGN_SYSTEM.md §8). */
export interface DurationTokens {
  /** 150ms. */
  fast: string;
  /** 200ms — route transitions. */
  base: string;
  /** 300ms. */
  slow: string;
  /** 800ms — count-up. */
  count: string;
}

/** Motion easings (DESIGN_SYSTEM.md §8). */
export interface EaseTokens {
  standard: string;
  emphasized: string;
}

/** The complete typed Design_Tokens contract. */
export interface DesignTokens {
  color: ColorTokens;
  font: FontTokens;
  space: SpaceTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  z: ZTokens;
  duration: DurationTokens;
  ease: EaseTokens;
}

// ---------------------------------------------------------------------------
// Themeable references — `var(--token)` strings (Requirement 4.1, 4.3)
// ---------------------------------------------------------------------------

/**
 * Design_Tokens as CSS Custom Property **references**. Prefer these in
 * TypeScript (inline styles, Recharts palettes) so values re-resolve when the
 * active Theme changes via `data-theme` — no component reads a literal color
 * (Requirement 4.3, 29.5).
 *
 * @example
 * ```tsx
 * <Line stroke={tokens.color.primary} /> // -> "var(--color-primary)"
 * ```
 */
export const tokens: DesignTokens = {
  color: {
    primary: 'var(--color-primary)',
    primaryStrong: 'var(--color-primary-strong)',
    primarySoft: 'var(--color-primary-soft)',
    accent: 'var(--color-accent)',
    accentStrong: 'var(--color-accent-strong)',
    bg: 'var(--color-bg)',
    surface: 'var(--color-surface)',
    surface2: 'var(--color-surface-2)',
    border: 'var(--color-border)',
    text: 'var(--color-text)',
    textMuted: 'var(--color-text-muted)',
    textInverse: 'var(--color-text-inverse)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
    rarityBronze: 'var(--rarity-bronze)',
    raritySilver: 'var(--rarity-silver)',
    rarityGold: 'var(--rarity-gold)',
    rarityLegendary: 'var(--rarity-legendary)',
  },
  font: {
    familyBase: 'var(--font-family-base)',
    familyDisplay: 'var(--font-family-display)',
    display: { size: 'var(--font-display-size)', lineHeight: 'var(--font-display-line)', weight: 'var(--font-display-weight)' },
    h1: { size: 'var(--font-h1-size)', lineHeight: 'var(--font-h1-line)', weight: 'var(--font-h1-weight)' },
    h2: { size: 'var(--font-h2-size)', lineHeight: 'var(--font-h2-line)', weight: 'var(--font-h2-weight)' },
    h3: { size: 'var(--font-h3-size)', lineHeight: 'var(--font-h3-line)', weight: 'var(--font-h3-weight)' },
    body: { size: 'var(--font-body-size)', lineHeight: 'var(--font-body-line)', weight: 'var(--font-body-weight)' },
    bodySm: { size: 'var(--font-body-sm-size)', lineHeight: 'var(--font-body-sm-line)', weight: 'var(--font-body-sm-weight)' },
    caption: { size: 'var(--font-caption-size)', lineHeight: 'var(--font-caption-line)', weight: 'var(--font-caption-weight)' },
  },
  space: {
    s0: 'var(--space-0)',
    s1: 'var(--space-1)',
    s2: 'var(--space-2)',
    s3: 'var(--space-3)',
    s4: 'var(--space-4)',
    s5: 'var(--space-5)',
    s6: 'var(--space-6)',
    s7: 'var(--space-7)',
    s8: 'var(--space-8)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    full: 'var(--radius-full)',
  },
  shadow: {
    s0: 'var(--shadow-0)',
    s1: 'var(--shadow-1)',
    s2: 'var(--shadow-2)',
    s3: 'var(--shadow-3)',
    glow: 'var(--shadow-glow)',
  },
  z: {
    base: 'var(--z-base)',
    dropdown: 'var(--z-dropdown)',
    stickyHeader: 'var(--z-sticky-header)',
    overlay: 'var(--z-overlay)',
    modal: 'var(--z-modal)',
    toast: 'var(--z-toast)',
  },
  duration: {
    fast: 'var(--duration-fast)',
    base: 'var(--duration-base)',
    slow: 'var(--duration-slow)',
    count: 'var(--duration-count)',
  },
  ease: {
    standard: 'var(--ease-standard)',
    emphasized: 'var(--ease-emphasized)',
  },
};

// ---------------------------------------------------------------------------
// Literal default values — the resolved `cruzeiro` palette (DESIGN_SYSTEM.md §2)
// ---------------------------------------------------------------------------

/**
 * Resolved literal values of the default `cruzeiro` Theme. Mirrors the `:root`
 * block in `tokens.css` and documents the source palette. Prefer {@link tokens}
 * (CSS references) for anything rendered, so Theme switching keeps working;
 * use these literals only where a resolved value is genuinely required (e.g.
 * generating a static share image or a non-DOM export).
 *
 * All text/background combinations here meet WCAG 2.1 AA (Requirement 4.7).
 */
export const defaultTokens: DesignTokens = {
  color: {
    primary: '#0033A0',
    primaryStrong: '#00257A',
    primarySoft: '#E6ECF7',
    accent: '#D4AF37',
    accentStrong: '#B8942B',
    bg: '#F5F7FB',
    surface: '#FFFFFF',
    surface2: '#EEF1F7',
    border: '#D9DEE8',
    text: '#0E1524',
    textMuted: '#5B6577',
    textInverse: '#FFFFFF',
    success: '#1E9E5A',
    warning: '#E8A317',
    danger: '#D64545',
    info: '#2B7FD6',
    rarityBronze: '#A97142',
    raritySilver: '#9AA3AF',
    rarityGold: '#D4AF37',
    rarityLegendary: '#111111',
  },
  font: {
    familyBase: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    familyDisplay: "'Montserrat', 'Inter', system-ui, sans-serif",
    display: { size: '40px', lineHeight: '1.1', weight: '800' },
    h1: { size: '32px', lineHeight: '1.2', weight: '700' },
    h2: { size: '24px', lineHeight: '1.25', weight: '700' },
    h3: { size: '20px', lineHeight: '1.3', weight: '600' },
    body: { size: '16px', lineHeight: '1.5', weight: '400' },
    bodySm: { size: '14px', lineHeight: '1.5', weight: '400' },
    caption: { size: '12px', lineHeight: '1.4', weight: '500' },
  },
  space: {
    s0: '0',
    s1: '4px',
    s2: '8px',
    s3: '12px',
    s4: '16px',
    s5: '24px',
    s6: '32px',
    s7: '48px',
    s8: '64px',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    full: '9999px',
  },
  shadow: {
    s0: 'none',
    s1: '0 1px 2px rgba(14,21,36,.08)',
    s2: '0 4px 12px rgba(14,21,36,.12)',
    s3: '0 12px 32px rgba(14,21,36,.18)',
    glow: '0 0 24px rgba(212,175,55,.55)',
  },
  z: {
    base: '0',
    dropdown: '100',
    stickyHeader: '200',
    overlay: '300',
    modal: '400',
    toast: '500',
  },
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    count: '800ms',
  },
  ease: {
    standard: 'cubic-bezier(.2,0,0,1)',
    emphasized: 'cubic-bezier(.2,0,0,1.2)',
  },
};

/**
 * Ordered chart series palette, expressed as themeable token references
 * (Requirement 29.5). Charts (LineChart, Histogram, RadarChart) consume these
 * so their colors follow the active Theme.
 */
export const chartPalette: readonly string[] = [
  tokens.color.primary,
  tokens.color.accent,
  tokens.color.info,
  tokens.color.success,
  tokens.color.warning,
  tokens.color.danger,
] as const;
