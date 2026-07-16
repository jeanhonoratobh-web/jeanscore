/// <reference types="vite/client" />

/**
 * Typed Vite environment variables (`import.meta.env`).
 *
 * The Supabase base URL and anonymous (publishable) key are injected at build
 * time by Vite from `.env` files prefixed with `VITE_`. Typing them here keeps
 * `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` strongly typed
 * across the codebase (Requirement 1.6).
 */
interface ImportMetaEnv {
  /** Supabase project REST base URL, e.g. `https://<project>.supabase.co`. */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anonymous/publishable API key sent as `apikey` and bearer token. */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
