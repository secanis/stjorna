import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    timeout: 30000,
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    }
  },
  plugins: [],
});