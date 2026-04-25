import { build } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function analyzeBundle() {
  console.log('Building extension with bundle analysis...');

  try {
    await build({
      configFile: path.resolve(__dirname, '../vite.config.ts'),
      build: {
        rollupOptions: {
          plugins: [
            visualizer({
              filename: 'dist/stats.html',
              open: process.env.CI !== 'true',
              gzipSize: true,
              brotliSize: true,
            }),
          ],
        },
      },
    });

    console.log('Build complete. Analyzing with bundlewatch...');

    // Run bundlewatch if available
    try {
      execSync('npx bundlewatch --config .bundlewatch.json', {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
      });
    } catch (error) {
      if (process.env.CI === 'true') {
        console.error('Bundle size check failed in CI');
        process.exit(1);
      }
      console.warn('Bundlewatch check failed (non-fatal in dev mode)');
    }

    // Generate report
    console.log('Generating bundle report...');
    const reportPath = path.resolve(__dirname, '../dist/bundle-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      files: [],
    };

    // Scan dist directory for bundle sizes
    const distPath = path.resolve(__dirname, '../dist');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath, { recursive: true });
      for (const file of files) {
        const fullPath = path.join(distPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.css'))) {
          report.files.push({
            path: String(file),
            size: stat.size,
            sizeKb: (stat.size / 1024).toFixed(2),
          });
        }
      }
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Bundle report saved to ${reportPath}`);
    console.log(`Total files analyzed: ${report.files.length}`);
  } catch (error) {
    console.error('Bundle analysis failed:', error);
    process.exit(1);
  }
}

analyzeBundle();
