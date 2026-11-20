import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Big libraries are their own chunks, loaded only when needed: the video
    // library (Mediabunny, ~730 kB) when a play is opened, Three.js (~610 kB)
    // when the 3D view is. The main bundle stays under this limit.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
