#!/usr/bin/env node
/**
 * Fails when a tracked text file uses classic-Mac (CR-only) line endings.
 *
 * Why this exists as a separate check rather than a Prettier setting:
 *
 * `.prettierrc.json` sets `endOfLine: "auto"`, which tells Prettier to keep
 * whichever line ending it finds first in a file. That is deliberate — the
 * repo has Windows contributors and plenty of CRLF files, and forcing `"lf"`
 * would make `pnpm format:check` fail on all of them. The side effect is that
 * a CR-only file round-trips through Prettier unchanged: `prettier --check`
 * reports it as correctly formatted, because by its own rules it is.
 *
 * The result is a file that every tool reports as fine and every human reports
 * as broken. `wc -l` says zero lines, editors and `git diff` show one endless
 * line, and review is impossible.
 * `apps/mobile-wallet/src/navigation/MobileAppRoot.tsx` — the mobile app's
 * root component — sat in that state on `main` (#1353).
 *
 * CR-only is never intentional in this repo: it is what is left when a tool
 * strips the LF from CRLF. So the rule is narrow — CR present, LF absent — and
 * leaves ordinary CRLF files alone.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TEXT_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|css|html)$/;

const CR = 0x0d;
const LF = 0x0a;

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter((name) => name.length > 0);
}

/**
 * A file is flagged when it contains at least one CR and no LF at all.
 *
 * Checking "no LF at all" rather than "any bare CR" keeps the check free of
 * false positives: a CR inside a string literal in an otherwise LF file is
 * legitimate, and mixed CRLF/LF files are Prettier's problem, not this one.
 */
function hasCrOnlyLineEndings(contents) {
  let sawCr = false;
  for (const byte of contents) {
    if (byte === LF) return false;
    if (byte === CR) sawCr = true;
  }
  return sawCr;
}

const offenders = [];

for (const file of trackedFiles()) {
  if (!TEXT_FILE_PATTERN.test(file)) continue;

  let contents;
  try {
    contents = readFileSync(file);
  } catch {
    // Deleted or unreadable in the working tree — not this check's business.
    continue;
  }

  if (hasCrOnlyLineEndings(contents)) {
    offenders.push(file);
  }
}

if (offenders.length > 0) {
  console.error('Files use CR-only (classic Mac) line endings:\n');
  for (const file of offenders) {
    console.error(`  ${file}`);
  }
  console.error(
    '\nThese read as a single unbroken line in editors and diffs, and Prettier' +
      "\ncannot catch them because endOfLine is 'auto'. Convert each to LF, e.g." +
      "\n\n  node -e \"const f=process.argv[1],fs=require('fs');" +
      "fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/\\r/g,'\\n'))\" <file>" +
      '\n\nthen re-run Prettier on the file.'
  );
  process.exit(1);
}

console.log(`Line endings OK (${offenders.length} offenders).`);
