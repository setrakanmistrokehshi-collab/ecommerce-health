import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react')) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('axios') || id.includes('zustand') || id.includes('date-fns')) {
            return 'utils';
          }

          return 'vendor';
        },
      },
    },
  },
});