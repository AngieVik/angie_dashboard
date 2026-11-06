import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        // Keep updates waiting until all clients of the active worker close.
        skipWaiting: false,
        // Control the first installation too; claiming does not bypass waiting.
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html}', 'assets/*.{png,jpg,jpeg,svg,webp,avif,wasm}'],
        // The offline geographic time-zone database is a separate 4.3 MB WASM asset.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Public resources receive their revisions through includeAssets.
        // Do not include the public font stylesheet a second time.
        globIgnores: ['assets/fonts/**'],
      },
      includeAssets: ['assets/pwa/*.png', 'assets/fonts/roboto-condensed/*', 'assets/fonts/rajdhani/*', 'assets/pins/**/*.svg', 'assets/elements/icon_chincheta.png', 'assets/audio/alarm.mp3', 'assets/licenses/*'],
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
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'ui', test: /node_modules[\\/](@radix-ui[\\/]|@floating-ui[\\/]|sonner[\\/])/ },
            { name: 'windows', test: /node_modules[\\/](react-grid-layout|react-draggable|react-resizable)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'canvas', test: /node_modules[\\/](konva|react-konva|react-reconciler)[\\/]/ },
            { name: 'coordinates', test: /node_modules[\\/](proj4|mgrs|wkt-parser)[\\/]/ },
            { name: 'validation', test: /node_modules[\\/](ajv|ajv-formats|fast-uri|fast-deep-equal|json-schema-traverse|require-from-string)[\\/]/ },
            { name: 'storage', test: /node_modules[\\/]dexie[\\/]/ },
          ],
        },
      },
    },
  },
})
