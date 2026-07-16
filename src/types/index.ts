/**
 * Types layer barrel.
 *
 * Holds framework-agnostic TypeScript interfaces and types for domain entities
 * (`Player`, `Fixture`, `GameScore`, ...) and raw Supabase row shapes.
 * Populated by tasks (2.x). Kept as the single entry point for the layered
 * architecture (Requirement 1.3).
 */
export * from './domain';
export * from './config';
