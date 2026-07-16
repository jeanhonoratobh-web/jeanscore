/**
 * Smoke test verifying the Vitest + jsdom + jest-dom + fast-check toolchain
 * is configured correctly (Requirement 1.9). This file can be removed once the
 * real domain/component tests exist.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('test toolchain', () => {
  it('runs plain assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('provides a jsdom environment', () => {
    expect(typeof document).toBe('object');
    const el = document.createElement('div');
    el.textContent = 'jeanscore';
    document.body.appendChild(el);
    // jest-dom matcher registered via setup.ts
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('jeanscore');
  });

  it('runs fast-check property tests', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
  });
});
