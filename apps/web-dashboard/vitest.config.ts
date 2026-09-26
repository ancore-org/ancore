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
      '@ancore/stellar': path.resolve(__dirname, '../../packages/stellar/src/index.ts'),
      '@ancore/wallet-api': path.resolve(__dirname, '../../packages/wallet-api/src/index.ts'),
      '@ancore/wallet-shared': path.resolve(__dirname, '../../packages/wallet-shared/src/index.ts'),
      '@stellar/stellar-sdk': path.resolve(
        __dirname,
        '../../packages/stellar/node_modules/@stellar/stellar-sdk'
      ),
      'ed25519-hd-key': path.resolve(__dirname, './src/stubs/ed25519-hd-key.ts'),
      '@ledgerhq/hw-transport-webhid': path.resolve(__dirname, './src/stubs/ledger-transport.ts'),
      buffer: 'buffer',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      VITE_RELAYER_URL: 'http://localhost:3000',
      VITE_INDEXER_BASE_URL: 'http://localhost:4000',
    },
    setupFiles: ['../../packages/ensure-webcrypto.ts', './src/test/setup.ts'],
    testTimeout: 30000,
    // `turbo run test` (the pre-push hook) runs every package's tests
    // concurrently (capped at 4 via --concurrency, but each package's own
    // runner defaults to spawning threads sized to the CPU count regardless
    // of that outer cap). This suite leans on real userEvent timing rather
    // than fake timers, so under that compounded oversubscription individual
    // interactions have been observed taking 3-7s instead of ~100ms — enough
    // to blow even the 30s test timeout and leave the next test's DOM in a
    // half-settled state. Capping this suite's own pool keeps its footprint
    // fixed and modest instead of scaling with (and fighting for) whatever
    // the host machine has, which is what actually caused the timeouts.
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
});
