import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'הספרייה של חנית',
        short_name: 'הספרייה של חנית',
        description: 'הספרייה האישית של חנית — כל הספרים שקראתי, במקום אחד יפה',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#faf8f4',
        theme_color: '#faf8f4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + bundled data are precached for instant/offline loads.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Local book covers: cache on first view so they show offline afterward.
            urlPattern: ({ url }) => url.pathname.startsWith('/covers/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-covers',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            // Remote covers (Simania CDN). statuses:[0,200] allows caching the
            // opaque cross-origin responses so they work offline too.
            urlPattern: ({ url }) => url.origin === 'https://cdn.simania.co.il',
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-covers-remote',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            // Google Fonts stylesheets + files.
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
})
