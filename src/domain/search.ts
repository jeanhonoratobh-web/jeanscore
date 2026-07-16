/**
 * Global search text matching (pure, framework-agnostic).
 *
 * Implements the accent- and case-insensitive matching used by the global
 * search (Requirement 13). Matching is performed with plain substring
 * comparison over normalized text — never a `RegExp` built from user input —
 * so arbitrary query strings, including regex metacharacters, are treated as
 * literal text and can never throw (Requirement 13.8). Accents and letter case
 * are ignored on both sides of the comparison (Requirement 13.9).
 *
 * This module lives in the pure `domain` layer and imports nothing beyond the
 * standard library — no React, DOM, services or network (Requirement 1.2).
 *
 * @see Requirements 13.8 (robust, never throws) and 13.9 (accent/case-insensitive).
 */

/**
 * Normalizes text for accent- and case-insensitive comparison
 * (Requirement 13.9).
 *
 * Lowercases the input and strips diacritics by decomposing characters via
 * Unicode NFD normalization and removing the resulting combining marks (e.g.
 * `"Cássio"` and `"CASSIO"` both normalize to `"cassio"`). The transform is
 * idempotent: normalizing an already-normalized string returns the same value.
 *
 * @param text - The raw text to normalize.
 * @returns The lowercased, diacritic-free form of `text`.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    // Remove combining diacritical marks left behind by NFD decomposition.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Filters `items` to those whose text, ignoring accents and case, contains the
 * given `query` (Requirement 13).
 *
 * For each item, `keys` selects one or more text fields to match against; an
 * item is included when any selected field, once normalized, contains the
 * normalized query as a substring. Matching uses {@link String.prototype.includes},
 * not a `RegExp` on user input, so metacharacters (`.`, `*`, `(`, `[`, `\`, ...)
 * are matched literally and the function never throws (Requirement 13.8).
 *
 * Guarantees:
 * - The result is always a subset of `items`, preserving their original order.
 * - The result is identical for queries that differ only in accents and/or
 *   case (Requirement 13.9).
 * - An empty (or whitespace-only) query matches every item, yielding the full
 *   input as a subset.
 *
 * @typeParam T - The item type.
 * @param items - The list to search over.
 * @param query - The raw, user-provided search term.
 * @param keys - Selector returning the searchable text fields of an item.
 * @returns The subset of `items` matching `query`, in original order.
 */
export function search<T>(
  items: readonly T[],
  query: string,
  keys: (item: T) => readonly string[],
): T[] {
  const normalizedQuery = normalizeText(query).trim();
  if (normalizedQuery === '') {
    return [...items];
  }
  return items.filter((item) =>
    keys(item).some((field) => normalizeText(field).includes(normalizedQuery)),
  );
}
