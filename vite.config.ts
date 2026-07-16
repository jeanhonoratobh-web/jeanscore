/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Brand color tokens consumed by the PWA manifest.
 *
 * These mirror the Design_Tokens defined in `DESIGN_SYSTEM.md` /
 * `theme/tokens.ts` (Requirement 4). `theme_color` uses "Azul Cruzeiro"
 * (`--color-primary`) and `background_color` uses the application background
 * (`--color-bg`) so the installed app shell matches the default `cruzeiro`
 * theme (Requirement 34.1).
 */
const THEME_COLOR = '#0033A0';
const BACKGROUND_COLOR = '#F5F7FB';

/**
 * Vite configuration for JeanScore 2.0.
 *
 * - `base` is set to the GitHub Pages repository subpath so that static
 *   assets resolve correctly when served from `https://<user>.github.io/jeanscore/`
 *   (Requirement 1.1).
 * - Route-based code splitting is achieved at runtime through `React.lazy` +
 *   `Suspense` in the router layer; Vite automatically emits a separate chunk
 *   for every dynamically imported route module (Requirement 1.10).
 * - Path aliases mirror the layered architecture defined in `tsconfig.json`
 *   (Requirement 1.3).
 * - `vite-plugin-pwa` emits `manifest.webmanifest` and a Workbox service worker
 *   that precaches the app shell and runtime-caches Supabase REST responses so
 *   the app remains usable offline (Requirement 34.1, 34.2, 34.3).
 */
export default defineConfig({
  base: '/jeanscore/',
  plugins: [
    react(),
    VitePWA({
      // Register/update the service worker automatically; the app shell is
      // always served fresh once a new build is deployed (Requirement 34.1).
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Expose the manifest + icons as static PWA assets under `public/`.
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
      manifest: {
        name: 'JeanScore',
        short_name: 'JeanScore',
        description:
          'Avaliações e gamificação da torcida do Cruzeiro — notas, cartas, rankings e palpites.',
        lang: 'pt-BR',
        // Standalone launches the installed app without browser chrome
        // (Requirement 34.1, 34.2).
        display: 'standalone',
        orientation: 'portrait',
        // Scope/start honor the GitHub Pages subpath so the installed app
        // opens inside the correct base path (Requirement 1.1).
        scope: '/jeanscore/',
        start_url: '/jeanscore/',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell so the SPA boots offline
        // (Requirement 34.3).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        // SPA navigation fallback: any deep route resolves to the app shell.
        navigateFallback: '/jeanscore/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Supabase REST responses become the offline data source
            // (Requirement 34.3). NetworkFirst keeps data fresh online while
            // falling back to the last cached response when offline.
            urlPattern: ({ url }: { url: URL }) =>
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        // Keep the service worker disabled during `vite dev` to avoid stale
        // caches while developing; it is fully generated for production builds.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@router': fileURLToPath(new URL('./src/router', import.meta.url)),
      '@theme': fileURLToPath(new URL('./src/theme', import.meta.url)),
      '@i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@context': fileURLToPath(new URL('./src/context', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    // Route chunks are produced on demand via React.lazy dynamic imports.
    // Keep vendor code in its own stable chunk for better long-term caching.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    // jsdom provides a browser-like DOM for component tests
    // (@testing-library/react). Pure `domain` tests run in the same runner.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    // Route-level tests mount `React.lazy` pages whose dynamic-import chunks can
    // resolve slowly when the whole suite runs in parallel under load; a
    // generous per-test timeout keeps those async waits deterministic.
    testTimeout: 20000,
  },
});
