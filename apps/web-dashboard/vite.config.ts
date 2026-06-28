import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// All VITE_* variables are declared in .env.example and validated at runtime
// by src/lib/env.ts (zod). Vite exposes them to the browser automatically
// — no manual `define` entries are required.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ancore/core-sdk': path.resolve(__dirname, '../../packages/core-sdk/src/index.ts'),
      '@ancore/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@ancore/crypto': path.resolve(__dirname, '../../packages/crypto/src/index.ts'),
      '@ancore/account-abstraction': path.resolve(
        __dirname,
        '../../packages/account-abstraction/src/index.ts'
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../packages/ensure-webcrypto.ts', './src/test/setup.ts'],
    testTimeout: 30000,
  },
});
