import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html}', 'assets/*.woff2'],
        // Public resources receive their revisions through includeAssets.
        // Do not include the public font stylesheet a second time.
        globIgnores: ['assets/fonts/**'],
      },
      includeAssets: ['assets/pwa/*.png', 'assets/fonts/roboto-condensed/*', 'assets/fonts/rajdhani/*', 'assets/elements/*.png', 'assets/audio/alarm.mp3'],
      manifest: {
        id: '/',
        name: 'Angie Dashboard',
        short_name: 'Angie',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0C0D0E',
        background_color: '#0C0D0E',
        icons: [
          { src: '/assets/pwa/favicon-16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
          { src: '/assets/pwa/favicon-32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
          { src: '/assets/pwa/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/assets/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/assets/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/assets/pwa/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/assets/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
})
