import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

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
      'ed25519-hd-key': path.resolve(__dirname, './src/stubs/ed25519-hd-key.ts'),
      '@ledgerhq/hw-transport-webhid': path.resolve(__dirname, './src/stubs/ledger-transport.ts'),
      buffer: 'buffer',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../packages/ensure-webcrypto.ts', './src/test/setup.ts'],
    testTimeout: 30000,
  },
});
