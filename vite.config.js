import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Precache the whole app so it works fully offline after the first visit and
    // can be installed. The PDF worker is ~1.2 MB, so raise the cache size cap.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'InkVault — private PDF studio',
        short_name: 'InkVault',
        description: 'Merge, annotate, sign, redact, OCR, compress and protect PDFs entirely in your browser.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f1116',
        theme_color: '#574fd6',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,mjs,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
})
