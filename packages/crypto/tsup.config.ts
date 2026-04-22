import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['bip39'], // Marking bip39 as external
  target: 'es2022',
  clean: true,
});
