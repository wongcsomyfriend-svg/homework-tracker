import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /<repo>/, so every asset URL must be
// base-relative. Override with BASE_PATH=/ when hosting at a domain root.
const base = process.env.BASE_PATH ?? '/homework-tracker/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '欠交功課掃描系統',
        short_name: '功課掃描',
        description: '用 ArUco 標籤一次過掃描已交功課，即時列出欠交名單',
        theme_color: '#0f3d2e',
        background_color: '#f4f7f5',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: `${base}favicon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: `${base}favicon.svg`,
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        additionalManifestEntries: [
          { url: `${base}detect.worker.js`, revision: '2' },
          { url: `${base}vendor/cv.js`, revision: '2' },
          { url: `${base}vendor/aruco.js`, revision: '2' },
          { url: `${base}vendor/aruco_4x4_1000.js`, revision: '2' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
