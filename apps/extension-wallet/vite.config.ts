import fs from 'fs';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Fails the build if the popup HTML output contains inline scripts or
 * inline event handlers, which would be blocked by the extension CSP.
 */
function cspInlineScriptGuard(): Plugin {
  return {
    name: 'csp-inline-script-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      const inlineScriptRe = /<script(?![^>]*\bsrc=)[^>]*>/i;
      const inlineHandlerRe = /\bon\w+\s*=/i;
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (!fileName.endsWith('.html')) continue;
        const source = chunk.type === 'asset' ? String(chunk.source) : '';
        if (inlineScriptRe.test(source) || inlineHandlerRe.test(source)) {
          this.error(
            `CSP violation: "${fileName}" contains an inline script or event handler. ` +
              'Move all scripts to external files to comply with the extension CSP.'
          );
        }
      }
    },
  };
}

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
  plugins: [react(), cspInlineScriptGuard(), manifestPlugin()],
  publicDir: 'public',
  define: {
    'import.meta.env.VITE_RELAYER_URL': JSON.stringify(
      process.env.VITE_RELAYER_URL ?? 'http://localhost:3000'
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ancore/core-sdk': path.resolve(__dirname, '../../packages/core-sdk/src/index.ts'),
      '@ancore/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@ancore/wallet-shared': path.resolve(__dirname, '../../packages/wallet-shared/src/index.ts'),
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
        'content-script/content-script': path.resolve(__dirname, 'src/content-script/index.ts'),
        'sidepanel/index': path.resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content-script/content-script') {
            return 'content-script/content-script.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
