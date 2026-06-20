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
    // Crypto-heavy security tests run in Node — jsdom subtle is unreliable on Linux CI.
    environmentMatchGlobs: [
      ['src/security/__tests__/vault-export.test.ts', 'node'],
      ['src/security/__tests__/extension-storage-encryption.test.ts', 'node'],
    ],
    setupFiles: ['../../packages/ensure-webcrypto.ts', './src/test/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    css: true,
    fileParallelism: process.env.CI !== 'true',
    exclude: [
      '**/node_modules/**',
      '**/*.e2e.test.{ts,tsx}',
      '**/tests/e2e/**',
      '**/messaging/__tests__/messaging.test.ts',
      '**/SessionKeys/__tests__/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@ancore/core-sdk': path.resolve(rootDir, '../../packages/core-sdk/src/index.ts'),
      '@ancore/types': path.resolve(rootDir, '../../packages/types/src/index.ts'),
      '@ancore/crypto': path.resolve(rootDir, '../../packages/crypto/src/index.ts'),
      '@ancore/account-abstraction': path.resolve(
        rootDir,
        '../../packages/account-abstraction/src/index.ts'
      ),
      '@ancore/wallet-shared': path.resolve(rootDir, '../../packages/wallet-shared/src/index.ts'),
    },
  },
});
