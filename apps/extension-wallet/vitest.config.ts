import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/*.e2e.test.{ts,tsx}',
      '**/tests/e2e/**',
      '**/Onboarding/__tests__/**',
      '**/messaging/__tests__/messaging.test.ts',
      '**/SessionKeys/__tests__/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
});
