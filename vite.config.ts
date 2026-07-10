import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isRootPagesRepository = repositoryName?.toLowerCase().endsWith('.github.io');
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName && !isRootPagesRepository ? `/${repositoryName}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'data/vocabulary.json'],
      manifest: {
        name: 'WordMaster 영어 단어 학습',
        short_name: 'WordMaster',
        description: 'Apple Pencil로 하루 125개 영어 단어를 집중 학습합니다.',
        theme_color: '#284b63',
        background_color: '#eef3f6',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        lang: 'ko',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'wordmaster-pages', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ request }) => ['script', 'style', 'image', 'font', 'worker'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wordmaster-static',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: true, type: 'classic', navigateFallback: 'index.html', suppressWarnings: true },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/dist/**'],
  },
});
