import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// El navegador solo habla con este origen: el proxy reenvía /api a la API. Así la cookie del
// refresh token es de mismo origen (SameSite=Strict) y no hace falta CORS en desarrollo.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: apiTarget } },
    // Los bind mounts de Docker en Windows/macOS no emiten eventos del sistema de ficheros.
    watch:
      process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
  build: {
    rollupOptions: {
      output: {
        // Vendors en chunks propios: cambian poco y el navegador los mantiene en caché entre despliegues.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]react-router[\\/]/.test(id)) return 'vendor-router';
          if (/[\\/](zod|react-hook-form|@hookform)[\\/]/.test(id)) return 'vendor-forms';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
