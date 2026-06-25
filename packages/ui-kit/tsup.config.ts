import path from 'path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
