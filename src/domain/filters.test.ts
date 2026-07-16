/**
 * Property-based tests for the pure filtering/sorting domain module
 * (`domain/filters.ts`).
 *
 * Coverage (per the design's Correctness Properties table): P6, P7, P9.
 * This file is additive — each property is contributed by its own task.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import type { Position } from '../types/domain';
import type { PositionFilter } from './filters';
import { filterByPosition, sortPlayers, filterCombined } from './filters';

/** The four concrete field positions used across the squad. */
const POSITIONS: readonly Position[] = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Attacker',
];

/** Arbitrary for a single concrete {@link Position}. */
const positionArb: fc.Arbitrary<Position> = fc.constantFrom(...POSITIONS);

/**
 * Smart generator constrained to the input space of {@link filterByPosition}:
 * the function only reads `position`, so a minimal shape with a valid position
 * (plus a stable id to keep items distinguishable) is sufficient.
 */
const playerArb = fc.record({
  id: fc.string(),
  position: positionArb,
});

const playersArb = fc.array(playerArb, { maxLength: 50 });

describe('filterByPosition', () => {
  // Property 6: Filtro por posição preserva o total (particionamento).
  // Validates: Requirements 15.5
  it('partitions the input across the four positions (Property 6)', () => {
    fc.assert(
      fc.property(playersArb, (players) => {
        // 'all' returns every player.
        expect(filterByPosition(players, 'all')).toHaveLength(players.length);

        // The four concrete positions partition the input: their sizes sum
        // back to the total.
        const partitionSizes = POSITIONS.map(
          (pos) => filterByPosition(players, pos).length,
        );
        const total = partitionSizes.reduce((sum, size) => sum + size, 0);
        expect(total).toBe(players.length);

        // Every returned item matches the requested position.
        for (const pos of POSITIONS) {
          for (const player of filterByPosition(players, pos)) {
            expect(player.position).toBe(pos);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Smart generator constrained to the input space of {@link sortPlayers}: the
 * function reads `name`, `position` and `avg`. Names are drawn from a small
 * pool so alphabetical ties (and position-group ordering) are exercised, and
 * `avg` is either `null` (unrated) or a value on the `[0, 10]` scale.
 */
const sortablePlayerArb = fc.record({
  name: fc.constantFrom('Ana', 'Bruno', 'Carlos', 'Ana', 'Diego', 'Bruno'),
  position: positionArb,
  avg: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
});

const sortablePlayersArb = fc.array(sortablePlayerArb, { maxLength: 50 });

/** Canonical key that identifies a player instance for multiset comparison. */
function sortableKey(p: { name: string; position: Position; avg: number | null }): string {
  return `${p.name}|${p.position}|${p.avg === null ? 'null' : p.avg}`;
}

/** Builds a sorted frequency map so two arrays can be compared as multisets. */
function multiset(players: readonly { name: string; position: Position; avg: number | null }[]): string[] {
  return players.map(sortableKey).sort();
}

describe('sortPlayers', () => {
  // Property 7: Ordenação é permutação da entrada com ordem correta.
  // Validates: Requirements 15.6, 15.7
  it('is a permutation of the input in the correct order (Property 7)', () => {
    fc.assert(
      fc.property(sortablePlayersArb, fc.constantFrom<'nota' | 'posicao'>('nota', 'posicao'), (players, by) => {
        const result = sortPlayers(players, by);

        // Permutation: same multiset of players, never mutating the input.
        expect(result).toHaveLength(players.length);
        expect(multiset(result)).toEqual(multiset(players));

        if (by === 'nota') {
          // Rated players are descending by avg; unrated (null) go last.
          let seenNull = false;
          for (const player of result) {
            if (player.avg === null) {
              seenNull = true;
            } else {
              // Once an unrated player has appeared, no rated player may follow.
              expect(seenNull).toBe(false);
            }
          }
          // Adjacent rated pairs are non-increasing by avg.
          for (let i = 0; i + 1 < result.length; i++) {
            const a = result[i];
            const b = result[i + 1];
            if (a.avg !== null && b.avg !== null) {
              expect(a.avg).toBeGreaterThanOrEqual(b.avg);
            }
          }
        } else {
          const order: Record<Position, number> = {
            Goalkeeper: 0,
            Defender: 1,
            Midfielder: 2,
            Attacker: 3,
          };
          for (let i = 0; i + 1 < result.length; i++) {
            const a = result[i];
            const b = result[i + 1];
            // Position groups are ordered GK -> DEF -> MID -> ATT.
            expect(order[a.position]).toBeLessThanOrEqual(order[b.position]);
            // Alphabetical by name within the same position group.
            if (a.position === b.position) {
              expect(a.name.localeCompare(b.name, 'pt-BR')).toBeLessThanOrEqual(0);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Smart generator constrained to the input space of {@link filterCombined}:
 * the function reads `position`, `avg` and `votes`.
 */
const filterablePlayerArb = fc.record({
  position: positionArb,
  avg: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
  votes: fc.nat({ max: 20 }),
});

const filterablePlayersArb = fc.array(filterablePlayerArb, { maxLength: 50 });

/** Arbitrary for a single, possibly-empty combined filter. */
const filtersArb = fc.record(
  {
    position: fc.constantFrom<PositionFilter>('all', ...POSITIONS),
    minRating: fc.double({ min: 0, max: 10, noNaN: true }),
    maxRating: fc.double({ min: 0, max: 10, noNaN: true }),
    minVotes: fc.nat({ max: 20 }),
  },
  { requiredKeys: [] },
);

describe('filterCombined', () => {
  // Property 9: Filtros combinados são AND (monotonicidade restritiva).
  // Validates: Requirements 14.1
  it('is a restrictive, subset-preserving AND of its constraints (Property 9)', () => {
    fc.assert(
      fc.property(filterablePlayersArb, filtersArb, filtersArb, (players, base, extra) => {
        const result = filterCombined(players, base);

        // Subset in the original order: the result is `players` with some
        // items removed (indices strictly increasing within `players`).
        let cursor = 0;
        for (const item of result) {
          let found = -1;
          for (let i = cursor; i < players.length; i++) {
            if (players[i] === item) {
              found = i;
              break;
            }
          }
          expect(found).toBeGreaterThanOrEqual(0);
          cursor = found + 1;
        }

        // Restrictive monotonicity: adding constraints (applying `extra` as an
        // additional AND filter on top of `base`) never grows the result and
        // yields a subset of the looser result.
        const tighter = filterCombined(result, extra);
        expect(tighter.length).toBeLessThanOrEqual(result.length);
        for (const item of tighter) {
          expect(result).toContain(item);
        }
      }),
      { numRuns: 100 },
    );
  });
});
