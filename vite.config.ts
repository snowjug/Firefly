import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web app lives in /web. In development Vite serves it and proxies /api to the
// Node server; in production the Node server serves the built files from dist/web.
const apiTarget = `http://127.0.0.1:${process.env.FIREFLY_PORT ?? '8787'}`;

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    // FIREFLY_OUT_DIR lets several builds exist side by side (paired with FIREFLY_WEB_DIR).
    outDir: process.env.FIREFLY_OUT_DIR ?? '../dist/web',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    // The port can be overridden so that several copies of the app can run side by side.
    port: Number(process.env.FIREFLY_WEB_PORT ?? 5173),
    fs: { allow: ['..'] },
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
  },
});
