/**
 * Property-based tests for the in-memory {@link MemoryCache} (`services/cache.ts`).
 *
 * Covers Property 11 from the design document: Cache set/get is idempotent for
 * a repeated key. Setting the same key twice and reading it back returns the
 * stored value, and within the TTL a `get` returns the last value written.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MemoryCache } from './cache';

describe('MemoryCache', () => {
  /**
   * Property 11: Cache set/get é idempotente para chave repetida.
   *
   * Para toda chave `key` e valor `data`, definir o mesmo valor duas vezes e
   * ler de volta (dentro do TTL) retorna o mesmo valor:
   * `set(key,data); set(key,data); get(key) ≡ data`.
   *
   * **Validates: Requirements 1.7, 32.3**
   */
  it('set/get is idempotent for a repeated key (Property 11)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.jsonValue(),
        // TTL strictly positive so the entry is fresh at read time.
        fc.integer({ min: 1, max: 1_000_000 }),
        (key, data, ttl) => {
          // Frozen clock keeps the entry within its TTL for the read.
          const cache = new MemoryCache(ttl, () => 1_000);

          cache.set(key, data, ttl);
          cache.set(key, data, ttl);

          expect(cache.get(key)).toStrictEqual(data);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Idempotence must also hold when the second write changes the value: a
   * repeated key returns the *last* value written, within the TTL.
   *
   * **Validates: Requirements 1.7, 32.3**
   */
  it('get returns the last value written for a repeated key (Property 11)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.jsonValue(),
        fc.jsonValue(),
        fc.integer({ min: 1, max: 1_000_000 }),
        (key, first, last, ttl) => {
          const cache = new MemoryCache(ttl, () => 1_000);

          cache.set(key, first, ttl);
          cache.set(key, last, ttl);

          expect(cache.get(key)).toStrictEqual(last);
        },
      ),
      { numRuns: 100 },
    );
  });
});
