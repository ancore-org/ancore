import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // TODO: Re-enable DTS generation after fixing path alias resolution
  // TypeScript path aliases (@/*) in tsconfig.json cause DTS build failures
  // with tsup. The bundled JS/ESM work correctly, but type generation fails.
  // For now, consumers can use JSDoc and inference. Plan is to either:
  // 1. Switch to tsc for DTS generation separately, or
  // 2. Remove path aliases and use relative imports
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
