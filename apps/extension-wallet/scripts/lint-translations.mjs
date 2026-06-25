#!/usr/bin/env node

/**
 * Translation key lint — fails when t('...') keys used in source are missing from en.json,
 * and when i18n-enforced files contain hardcoded user-visible string literals.
 *
 * Usage:
 *   node scripts/lint-translations.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(EXTENSION_ROOT, 'src');
const LOCALE_FILE = path.join(EXTENSION_ROOT, 'src/i18n/en.json');

/** Files fully migrated to i18n — must not add new hardcoded user-visible literals. */
export const I18N_ENFORCED_FILES = [
  'src/screens/Settings/SettingsScreen.tsx',
  'src/i18n/settings-labels.ts',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '__tests__']);

const STATIC_KEY_PATTERN = /\bt\(\s*['"]([^'"]+)['"]/g;
const HARDCODED_PROP_PATTERN = /\b(label|description|title)=\s*["']([^"']+)["']/g;
const JSX_TEXT_PATTERN = />\s*([^<>{}\n]+?)\s*</g;

const ALLOWED_JSX_TEXT = new Set(['A']);

function isLikelyUserFacingJsxText(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2 || ALLOWED_JSX_TEXT.has(trimmed)) {
    return false;
  }

  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }

  // Skip fragments that look like code leaked from TS generics, not JSX copy.
  if (/[=;=>()[\]]/.test(trimmed)) {
    return false;
  }

  return true;
}

export function extractTranslationKeys(source) {
  const keys = new Set();
  let match = STATIC_KEY_PATTERN.exec(source);

  while (match) {
    keys.add(match[1]);
    match = STATIC_KEY_PATTERN.exec(source);
  }

  STATIC_KEY_PATTERN.lastIndex = 0;
  return keys;
}

export function flattenLocaleKeys(value, prefix = '') {
  const keys = new Set();

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return keys;
  }

  for (const [key, nested] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const childKey of flattenLocaleKeys(nested, fullKey)) {
        keys.add(childKey);
      }
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function findHardcodedUserStrings(source, relativePath = '') {
  const stripped = stripComments(source);
  const violations = [];

  HARDCODED_PROP_PATTERN.lastIndex = 0;
  let match = HARDCODED_PROP_PATTERN.exec(stripped);
  while (match) {
    violations.push({
      file: relativePath,
      kind: 'prop',
      detail: `${match[1]}="${match[2]}"`,
    });
    match = HARDCODED_PROP_PATTERN.exec(stripped);
  }

  if (!relativePath.endsWith('.tsx')) {
    return violations;
  }

  JSX_TEXT_PATTERN.lastIndex = 0;
  match = JSX_TEXT_PATTERN.exec(stripped);
  while (match) {
    const text = match[1];
    if (isLikelyUserFacingJsxText(text)) {
      violations.push({
        file: relativePath,
        kind: 'jsx-text',
        detail: `"${text.trim()}"`,
      });
    }
    match = JSX_TEXT_PATTERN.exec(stripped);
  }

  return violations;
}

export function collectSourceFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

export function collectUsedTranslationKeys(sourceContents) {
  const usedKeys = new Set();

  for (const source of sourceContents) {
    for (const key of extractTranslationKeys(source)) {
      usedKeys.add(key);
    }
  }

  return usedKeys;
}

export function findMissingTranslationKeys(sourceContents, localeData) {
  const localeKeys = flattenLocaleKeys(localeData);
  const usedKeys = collectUsedTranslationKeys(sourceContents);

  return [...usedKeys].filter((key) => !localeKeys.has(key)).sort();
}

export function findHardcodedViolations(enforcedFiles = I18N_ENFORCED_FILES, root = EXTENSION_ROOT) {
  const violations = [];

  for (const relativePath of enforcedFiles) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      violations.push({
        file: relativePath,
        kind: 'missing-file',
        detail: 'Enforced i18n file not found',
      });
      continue;
    }

    const source = fs.readFileSync(absolutePath, 'utf8');
    violations.push(...findHardcodedUserStrings(source, relativePath));
  }

  return violations;
}

export function lintTranslations({
  srcDir = SRC_DIR,
  localeFile = LOCALE_FILE,
  enforcedFiles = I18N_ENFORCED_FILES,
} = {}) {
  if (!fs.existsSync(localeFile)) {
    throw new Error(`Locale file not found: ${localeFile}`);
  }

  const localeData = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
  const sourceFiles = collectSourceFiles(srcDir);
  const sourceContents = sourceFiles.map((file) => fs.readFileSync(file, 'utf8'));
  const missingKeys = findMissingTranslationKeys(sourceContents, localeData);
  const hardcodedViolations = findHardcodedViolations(enforcedFiles);

  return {
    sourceFiles,
    missingKeys,
    hardcodedViolations,
    ok: missingKeys.length === 0 && hardcodedViolations.length === 0,
  };
}

function main() {
  const { missingKeys, hardcodedViolations, ok } = lintTranslations();

  if (ok) {
    console.log('✓ All translation keys used in source are present in src/i18n/en.json');
    console.log('✓ No hardcoded user-visible strings in i18n-enforced files');
    return;
  }

  if (missingKeys.length > 0) {
    console.error('✗ Missing translation keys in src/i18n/en.json:');
    for (const key of missingKeys) {
      console.error(`  - ${key}`);
    }
  }

  if (hardcodedViolations.length > 0) {
    console.error('✗ Hardcoded user-visible strings in i18n-enforced files:');
    for (const violation of hardcodedViolations) {
      console.error(`  - ${violation.file}: ${violation.kind} ${violation.detail}`);
    }
  }

  process.exit(1);
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}
