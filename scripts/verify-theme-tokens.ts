#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const uiKitSrc = path.join(repoRoot, 'packages/ui-kit/src');

const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignoredSegments = new Set(['node_modules', 'dist', 'coverage', '.turbo']);
const colorFamilies = [
  'white',
  'black',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];
const colorFamilyPattern = colorFamilies.join('|');
const disallowedTokenPattern = new RegExp(
  String.raw`(?:^|[\s"'\`])((?:hover:|focus:|focus-visible:|active:|disabled:|group-hover:|group-focus-within:|dark:|sm:|md:|lg:|xl:|2xl:|motion-safe:|motion-reduce:)*(?:bg|text|border|ring|outline|shadow|fill|stroke|from|via|to|decoration|placeholder|caret)-(${colorFamilyPattern})(?:-(?:\d{2,3}|\d{1,2}))?(?:\/[\w.[\]-]+)?)(?=$|[\s"'\`])`,
  'g'
);
const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/g;

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredSegments.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (
      entry.isFile() &&
      extensions.has(path.extname(entry.name)) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineAndColumn(content, index) {
  const before = content.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function main() {
  if (!fs.existsSync(uiKitSrc)) {
    console.error(`ui-kit source directory not found: ${uiKitSrc}`);
    process.exit(1);
  }

  const violations = [];
  for (const file of walk(uiKitSrc)) {
    const content = fs.readFileSync(file, 'utf8');
    let match;

    disallowedTokenPattern.lastIndex = 0;
    while ((match = disallowedTokenPattern.exec(content)) !== null) {
      const token = match[1];
      const offset = match.index + match[0].indexOf(token);
      violations.push({ file, token, ...lineAndColumn(content, offset) });
    }

    hexColorPattern.lastIndex = 0;
    while ((match = hexColorPattern.exec(content)) !== null) {
      violations.push({ file, token: match[0], ...lineAndColumn(content, match.index) });
    }
  }

  if (violations.length > 0) {
    console.error('Hardcoded ui-kit colors found. Use semantic theme tokens instead.');
    console.error(
      'Allowed examples: bg-background, text-foreground, border-border, bg-primary, text-muted-foreground.'
    );
    for (const violation of violations) {
      console.error(
        `${path.relative(repoRoot, violation.file)}:${violation.line}:${violation.column} ${violation.token}`
      );
    }
    process.exit(1);
  }

  console.log('Success: ui-kit source uses semantic theme tokens only.');
}

main();
