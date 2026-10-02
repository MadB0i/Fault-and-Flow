import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
  // Production serves as a GitHub Pages project site under a sub-path
  // (https://madb0i.github.io/Fault-and-Flow/), so every URL Vite emits must
  // carry that prefix. Dev stays at '/' so `npm run dev` is unchanged.
  // Runtime assets (DEM PNGs, sidecars, fonts) all arrive via `?url` imports
  // and CSS, which Vite prefixes with this base automatically — nothing in
  // src/ may hardcode a root-absolute asset path for the same reason.
  base: command === 'build' ? '/Fault-and-Flow/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // Budget from docs/ARCHITECTURE.md section 6: <300 KB gzipped initial.
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        // Three.js is by far the largest dependency. Splitting it keeps the
        // initial JS budget honest and lets the HUD paint before the engine
        // arrives - which is what makes the loading state meaningful.
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
}));
