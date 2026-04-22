import fs from 'fs';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function manifestPlugin(): Plugin {
  return {
    name: 'extension-manifest',
    apply: 'build',
    generateBundle() {
      const source = fs.readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), manifestPlugin()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'popup/index': path.resolve(__dirname, 'src/popup/index.html'),
        background: path.resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
