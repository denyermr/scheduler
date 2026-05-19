import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
//
// `/b/<slug>` is BOTH the user-facing URL (the SPA route) and the backend
// API endpoint (per the Phase 7 decision doc). The proxy must therefore
// distinguish:
//   - Browser navigations (Accept: text/html) → serve index.html so the SPA
//     loads and the client-side router takes over.
//   - XHR/fetch calls from the SPA (Accept: application/json or */*) →
//     forward to the Node backend on :8787.
//
// `bypass` returning `req.url` skips proxying; returning undefined forwards.
const PROXY_CONFIG = {
  '/b': {
    target: 'http://localhost:8787',
    changeOrigin: true,
    bypass(req: { headers: Record<string, string | string[] | undefined>; url?: string }) {
      const accept = req.headers.accept;
      const acceptStr = Array.isArray(accept) ? accept.join(',') : (accept ?? '');
      if (acceptStr.includes('text/html')) {
        return req.url; // let Vite's SPA fallback serve index.html
      }
      return undefined; // forward to backend
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: PROXY_CONFIG },
  preview: { proxy: PROXY_CONFIG },
});
