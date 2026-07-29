import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Clean, self-contained Vite config for building/deploying the JeanScore
// (Figma Make) design as a static site. The Figma-internal plugins and the
// `.figma/make/site.json` import were removed so the project builds outside
// the Figma Make environment.
//
// `base` is '/' for local dev/preview and set to '/jeanscore/' for the
// GitHub Pages build via the DEPLOY_BASE env var (see the deploy workflow).
export default defineConfig({
  base: process.env.DEPLOY_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
