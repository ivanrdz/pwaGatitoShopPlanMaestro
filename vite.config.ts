/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker propio (src/sw.ts) para conservar "Compartir a Gatito" desde WhatsApp.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false, // se usa public/manifest.webmanifest
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2,webmanifest}'],
        // El worker de pdf.js pesa ~1.2 MB y se necesita sin internet.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/sw.ts', 'src/vite-env.d.ts'],
      reporter: ['text', 'html'],
      // La lógica de negocio y los datos no deben perder pruebas.
      thresholds: {
        'src/domain/**': { lines: 80, branches: 75 },
        'src/data/**': { lines: 85, branches: 85 },
        'src/features/indicadores/*.ts': { lines: 90 },
      },
    },
  },
});
