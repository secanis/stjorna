import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'path';

const pbUrl = (process.env.VITE_PB_URL || 'http://localhost:8090').replace(/\/+$/, '');

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/': {
        target: pbUrl,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api/': {
        target: pbUrl,
        changeOrigin: true,
      },
    },
  },
});