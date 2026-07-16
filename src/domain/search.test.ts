/**
 * Property-based tests for the pure global-search domain module
 * (`domain/search.ts`).
 *
 * Coverage (per the design's Correctness Properties table): P8, P13.
 * This file is additive — each property is contributed by its own task.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { search, normalizeText } from './search';

/**
 * Maps a base ASCII letter to accented variants that normalize back to it.
 * Used to build query pairs that differ ONLY by accentuation/case.
 */
const ACCENT_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  a: ['a', 'á', 'à', 'â', 'ã', 'ä'],
  e: ['e', 'é', 'è', 'ê', 'ë'],
  i: ['i', 'í', 'ì', 'î', 'ï'],
  o: ['o', 'ó', 'ò', 'ô', 'õ', 'ö'],
  u: ['u', 'ú', 'ù', 'û', 'ü'],
  c: ['c', 'ç'],
  n: ['n', 'ñ'],
};

/** The base alphabet used to build canonical (accent-free, lowercase) text. */
const BASE_LETTERS = 'aeioucn'.split('');

/**
 * Given a canonical lowercase string, produces an arbitrary "skin" that differs
 * only by accentuation and/or letter case (both of which {@link normalizeText}
 * erases). By construction, `normalizeText(skin) === base`.
 */
function skinArb(base: string): fc.Arbitrary<string> {
  const perChar = base.split('').map((ch) => {
    const variants = ACCENT_VARIANTS[ch] ?? [ch];
    return fc
      .constantFrom(...variants)
      .chain((v) => fc.boolean().map((upper) => (upper ? v.toUpperCase() : v)));
  });
  return perChar.length === 0
    ? fc.constant('')
    : fc.tuple(...perChar).map((chars) => chars.join(''));
}

/** A canonical query drawn from the accent-free base alphabet. */
const baseTextArb = fc.stringOf(fc.constantFrom(...BASE_LETTERS), {
  minLength: 1,
  maxLength: 6,
});

/** Arbitrary player-like item exposing accented/mixed-case text fields. */
const itemArb = fc
  .tuple(
    baseTextArb.chain((base) => skinArb(base)),
    baseTextArb.chain((base) => skinArb(base)),
  )
  .map(([name, nickname]) => ({ name, nickname }));

const itemsArb = fc.array(itemArb, { maxLength: 30 });

/** Selector for the searchable text fields of an item. */
const keys = (item: { name: string; nickname: string }): readonly string[] => [
  item.name,
  item.nickname,
];

/**
 * A query paired with a second query that differs from it ONLY by accentuation
 * and/or letter case: `{ q, qPrime }` with `normalizeText(q) === normalizeText(qPrime)`.
 */
const queryPairArb = baseTextArb.chain((base) =>
  fc.record({ q: skinArb(base), qPrime: skinArb(base) }),
);

describe('search', () => {
  // Property 8: Busca é subconjunto e insensível a acento/caixa.
  // Validates: Requirements 13.8, 13.9
  it('returns a subset (original order) invariant to accents/case (Property 8)', () => {
    fc.assert(
      fc.property(itemsArb, queryPairArb, (items, { q, qPrime }) => {
        // Both queries normalize to the same canonical form by construction.
        expect(normalizeText(q)).toBe(normalizeText(qPrime));

        const result = search(items, q, keys);

        // Subset: every result element is one of the inputs, and the original
        // order is preserved (source indices are strictly increasing).
        let lastIndex = -1;
        for (const r of result) {
          const idx = items.indexOf(r);
          expect(idx).toBeGreaterThan(lastIndex);
          lastIndex = idx;
        }

        // Accent/case insensitivity: queries differing only by accentuation
        // and/or case yield identical results.
        const resultPrime = search(items, qPrime, keys);
        expect(resultPrime).toEqual(result);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Regex metacharacters that would be meaningful if the query were ever compiled
 * into a `RegExp`. `search` must treat them as literal text (Requirement 13.8).
 */
const REGEX_METACHARS = ['.', '*', '(', ')', '[', ']', '{', '}', '\\', '^', '$', '|', '?', '+'];

/** A generator biased toward regex metacharacters (mixed with arbitrary text). */
const specialCharQueryArb = fc.stringOf(
  fc.oneof(fc.constantFrom(...REGEX_METACHARS), fc.char()),
  { maxLength: 40 },
);

describe('search — robustness (Property 13)', () => {
  // Property 13: Busca com caracteres especiais não lança exceção.
  // Validates: Requirements 13.8
  it('never throws for arbitrary query strings, including regex metacharacters (Property 13)', () => {
    fc.assert(
      fc.property(
        itemsArb,
        fc.oneof(fc.string(), specialCharQueryArb),
        (items, query) => {
          // The function must never throw regardless of the query contents;
          // in the worst case it returns an empty array, never a RegExp error.
          const result = search(items, query, keys);
          expect(Array.isArray(result)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('treats each regex metacharacter as literal text without throwing (Property 13)', () => {
    fc.assert(
      fc.property(
        itemsArb,
        fc.constantFrom(...REGEX_METACHARS),
        (items, metachar) => {
          const result = search(items, metachar, keys);
          expect(Array.isArray(result)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
