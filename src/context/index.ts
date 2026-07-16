/**
 * Context layer barrel.
 *
 * Global React contexts (Auth, Theme, Toast, Services) providing cross-cutting
 * state without a heavy store (Requirement 5.4). Populated by later tasks (11.x).
 */
export { ServicesProvider, useServices, createServices } from './ServicesContext';
export type { Services, ServicesProviderProps } from './ServicesContext';
export { AuthProvider, useAuth } from './AuthContext';
export type { AuthContextValue, AuthProviderProps } from './AuthContext';
