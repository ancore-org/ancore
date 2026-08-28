import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../packages/ensure-webcrypto.ts', './src/test/setup.ts'],
    testTimeout: 30000,
  },
});
