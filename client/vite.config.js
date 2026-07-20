import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // ── Build Optimizations ─────────────────────────────────────────────────
  build: {
    // Increase chunk size warning threshold slightly (default 500)
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Manual chunk splitting via function — required for Vite 8 / rolldown
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/axios')) {
            return 'io-vendor';
          }
        },
      },
    },
  },

  // ── Development Server ──────────────────────────────────────────────────
  server: {
    port: 5173,
    // Proxy API requests to the dev backend to avoid CORS issues during development
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  // ── Preview Server (for testing production builds locally) ──────────────
  preview: {
    port: 4173,
  },
})
