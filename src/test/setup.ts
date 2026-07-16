/**
 * Global test setup for Vitest.
 *
 * Registers the `@testing-library/jest-dom` custom matchers (e.g.
 * `toBeInTheDocument`, `toHaveFocus`) and ensures the DOM is cleaned up
 * between tests so component tests stay isolated (Requirement 1.9).
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
