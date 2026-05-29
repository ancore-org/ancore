#!/usr/bin/env node
/**
 * CI guard: check-log-redaction.js
 *
 * Scans the relayer source tree for log call sites that pass raw sensitive
 * fields (sessionKey, signature, signedTransactionXdr, token, privateKey)
 * directly to a logger or console method without going through a redaction
 * helper from `src/logging/redact.ts`.
 *
 * Exit codes:
 *   0 — no violations found
 *   1 — one or more violations found (CI should fail)
 *
 * Usage:
 *   node services/relayer/scripts/check-log-redaction.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const SRC_DIR = path.resolve(__dirname, '..', 'src');

/**
 * Patterns that indicate a raw sensitive value is being passed to a log call.
 *
 * Each entry is a regex that, when matched in a source file, signals a
 * potential violation. The regex is intentionally conservative — it looks for
 * the sensitive field name appearing as a bare property key inside a log/console
 * call without a surrounding redact*() wrapper.
 *
 * False-positive rate is low because:
 *  - The redact helpers always wrap the value: redactPublicKey(sessionKey)
 *  - A bare `sessionKey` or `signature:` inside a log object is the violation.
 */
const FORBIDDEN_PATTERNS = [
  // Raw sessionKey passed to logger/console without redaction wrapper
  {
    pattern:
      /(?:log(?:ger)?|console)\s*\.\s*(?:info|warn|error|debug)\s*\([^)]*\bsessionKey\s*(?:,|\))/,
    description: 'Raw sessionKey passed to log call — use redactPublicKey(sessionKey)',
  },
  // Raw signature passed to logger/console without redaction wrapper
  {
    pattern:
      /(?:log(?:ger)?|console)\s*\.\s*(?:info|warn|error|debug)\s*\([^)]*\bsignature\s*(?:,|\))/,
    description: 'Raw signature passed to log call — use redactSignature(signature)',
  },
  // signedTransactionXdr logged raw
  {
    pattern:
      /(?:log(?:ger)?|console)\s*\.\s*(?:info|warn|error|debug)\s*\([^)]*\bsignedTransactionXdr\b/,
    description: 'Raw signedTransactionXdr passed to log call — use redactSignedPayload()',
  },
  // Bearer token logged raw
  {
    pattern: /(?:log(?:ger)?|console)\s*\.\s*(?:info|warn|error|debug)\s*\([^)]*\btoken\s*(?:,|\))/,
    description: 'Raw token passed to log call — use redactSecret(token)',
  },
  // privateKey logged raw
  {
    pattern: /(?:log(?:ger)?|console)\s*\.\s*(?:info|warn|error|debug)\s*\([^)]*\bprivateKey\b/,
    description: 'Raw privateKey passed to log call — use redactSecret(privateKey)',
  },
];

// Files to skip (the redact module itself, tests that intentionally use raw values)
const SKIP_PATTERNS = [
  /[\\/]logging[\\/]redact\.ts$/,
  /[\\/]logging[\\/]__tests__[\\/]/,
  /[\\/]__tests__[\\/]/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
];

// ── File walker ───────────────────────────────────────────────────────────────

function walkTs(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTs(full, files);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// ── Main ──────────────────────────────────────────────────────────────────────

let violations = 0;

const files = walkTs(SRC_DIR).filter((f) => !SKIP_PATTERNS.some((skip) => skip.test(f)));

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  for (const { pattern, description } of FORBIDDEN_PATTERNS) {
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        const rel = path.relative(process.cwd(), file);
        console.error(`\n[LOG-REDACTION VIOLATION] ${rel}:${idx + 1}`);
        console.error(`  Rule: ${description}`);
        console.error(`  Line: ${line.trim()}`);
        violations++;
      }
    });
  }
}

if (violations === 0) {
  console.log('[check-log-redaction] ✓ No raw sensitive values found in log call sites.');
  process.exit(0);
} else {
  console.error(
    `\n[check-log-redaction] ✗ Found ${violations} violation(s). ` +
      'Wrap sensitive values with helpers from src/logging/redact.ts before logging.'
  );
  process.exit(1);
}
