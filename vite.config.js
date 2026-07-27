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
        globPatterns: ['**/*.{js,css,html,svg,mjs,wasm,ttf}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Cache the OCR engine (worker, core wasm, language data) the first time it
        // loads from its CDN, so OCR keeps working offline afterwards.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /(?:unpkg\.com|cdn\.jsdelivr\.net|tessdata\.projectnaptha\.com)/.test(url.href),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
