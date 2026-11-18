import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web app lives in /web. In development Vite serves it and proxies /api to the
// Node server; in production the Node server serves the built files from dist/web.
const apiTarget = `http://127.0.0.1:${process.env.FIREFLY_PORT ?? '8787'}`;

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
  },
});
