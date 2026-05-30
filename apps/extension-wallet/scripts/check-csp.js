/**
 * check-csp.js
 *
 * Scans the popup bundle output for patterns that would be blocked by the
 * extension Content Security Policy:
 *   - Inline <script> tags (no src attribute)
 *   - Inline event handlers (onclick=, onload=, etc.)
 *   - javascript: URIs
 *   - eval() / new Function() calls
 *
 * Run after `pnpm build`:
 *   node scripts/check-csp.js
 *
 * Exits with code 1 if any violation is found (suitable for CI).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');

const CHECKS = [
  { re: /<script(?![^>]*\bsrc=)[^>]*>/i, label: 'inline <script> tag' },
  { re: /\bon\w+\s*=/i, label: 'inline event handler' },
  { re: /javascript\s*:/i, label: 'javascript: URI' },
  { re: /\beval\s*\(/, label: 'eval() call' },
  { re: /new\s+Function\s*\(/, label: 'new Function() call' },
];

function scanDir(dir) {
  const violations = [];
  if (!fs.existsSync(dir)) {
    console.error(`dist directory not found: ${dir}`);
    console.error('Run `pnpm build` first.');
    process.exit(1);
  }

  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!['.html', '.js'].includes(ext)) continue;

    const filePath = path.join(entry.parentPath ?? entry.path, entry.name);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const { re, label } of CHECKS) {
      if (re.test(content)) {
        violations.push(`  [${label}] ${path.relative(DIST, filePath)}`);
      }
    }
  }
  return violations;
}

const violations = scanDir(DIST);

if (violations.length > 0) {
  console.error('CSP violations detected in build output:\n');
  violations.forEach((v) => console.error(v));
  console.error('\nFix these before shipping. See docs/security/extension-wallet.md.');
  process.exit(1);
} else {
  console.log('CSP check passed — no inline scripts or unsafe patterns found.');
}
