import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のサブパス配信用。CI で VITE_BASE=/<repo>/ を渡す。ローカルは '/'
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: '過去問トレーナー（第二種電気工事士 学科）',
        short_name: '過去問',
        description: '第二種電気工事士 学科試験の過去問を毎日30問。オフライン対応。',
        lang: 'ja',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // アプリ本体 + 問題JSON は事前キャッシュ。図画像は初回表示時にキャッシュ（設定画面で一括DLも可能）
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}', 'data/**/*.json', 'icons/*.png'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/data\/.*\/figures\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'figures',
              expiration: { maxEntries: 5000, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
