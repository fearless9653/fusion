/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Harmless Rollup noise from zod@4 PURE-annotation comments in node_modules. */
function isZodPureAnnotationWarning(warning: {
  code?: string
  message: string
  id?: string
}): boolean {
  const id = warning.id ?? ''
  const msg = warning.message
  const fromZod =
    (id.includes('node_modules') && id.includes('zod')) || /node_modules[/\\].*zod[/\\]/.test(msg)
  const uninterpretableAnnotation =
    warning.code === 'INVALID_ANNOTATION' ||
    msg.includes('contains an annotation that Rollup cannot interpret')
  return fromZod && uninterpretableAnnotation
}

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Fusion',
        short_name: 'Fusion',
        description:
          'Fusion is a browser photo collage maker that runs locally: upload photos, pick or customize layouts, style borders and watermarks, then export JPG/PNG. No server upload, no account.',
        theme_color: '#50c878',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only — user photos stay in memory / object URLs, not precached.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (isZodPureAnnotationWarning(warning)) return
        warn(warning)
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
  },
})
