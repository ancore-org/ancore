import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../ensure-webcrypto.ts', './src/test/setup.ts'],
    testTimeout: 30000,
    css: true,
    // See apps/web-dashboard/vitest.config.ts for why: turbo's outer
    // concurrency cap doesn't stop each package's own runner from spawning
    // CPU-count-sized worker threads, which compounds into real
    // oversubscription and spurious timeouts under `turbo run test`.
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
