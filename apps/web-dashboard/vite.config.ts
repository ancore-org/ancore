import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// All VITE_* variables are declared in .env.example and validated at runtime
// by src/lib/env.ts (zod). Vite exposes them to the browser automatically
// — no manual `define` entries are required.
export default defineConfig({
  plugins: [react()],
  define: {
    // Free-identifier replacements for Node-ish deps pulled through monorepo packages.
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.browser': true,
    'process.version': JSON.stringify('v20.0.0'),
    'process.versions': JSON.stringify({ node: '20.0.0' }),
    global: 'globalThis',
  },
  optimizeDeps: {
    // Force eager pre-bundling so these are ready before the first request that
    // needs them (e.g. clicking "Create wallet"). Left to lazy/on-demand discovery,
    // Vite can serve that first request mid-optimization and throw "Buffer is not
    // defined" from the not-yet-patched bip39 chunk.
    include: ['bip39', '@noble/hashes/hmac', '@noble/hashes/sha2', 'buffer'],
    exclude: ['ed25519-hd-key', '@ledgerhq/hw-transport-webhid'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
        'process.env.NODE_ENV': '"development"',
        'process.browser': 'true',
        'process.version': '"v20.0.0"',
      },
    },
  },
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
});
