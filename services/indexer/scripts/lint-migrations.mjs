#!/usr/bin/env node
// Validates migration filename conventions and catches duplicate sequence numbers.
//
// Convention: NNN_snake_case_description.sql
//   - NNN  : exactly 3 zero-padded digits (001, 002, …)
//   - body : lowercase letters, digits, underscores only
//   - ext  : .sql
//
// Exits 0 on success, 1 on any violation.

import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');

const VALID = /^\d{3}_[a-z][a-z0-9_]*\.sql$/;

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const errors = [];
const seen = new Map(); // sequence → filename

for (const file of files) {
  if (!VALID.test(file)) {
    errors.push(`  ✗ Invalid name: "${file}"  (expected NNN_snake_case_description.sql)`);
    continue;
  }

  const seq = file.slice(0, 3);
  if (seen.has(seq)) {
    errors.push(`  ✗ Duplicate sequence ${seq}: "${seen.get(seq)}" and "${file}"`);
  } else {
    seen.set(seq, file);
  }
}

if (errors.length) {
  console.error('Migration lint failed:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(
  `Migration lint passed (${files.length} file${files.length !== 1 ? 's' : ''} checked).`
);
