import { build } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  await build({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
    build: {
      rollupOptions: {
        plugins: [
          visualizer({
            filename: 'stats.html',
            open: process.env.CI !== 'true',
            gzipSize: true,
            brotliSize: true,
          }),
        ],
      },
    },
  });
})();
