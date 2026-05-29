#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const docsToCheck = ['README.md', 'docs/architecture/OVERVIEW.md'];
const markerStart = '<!-- repo-structure-check:start -->';
const markerEnd = '<!-- repo-structure-check:end -->';

function getMarkedRegion(markdown, documentPath) {
  const start = markdown.indexOf(markerStart);
  const end = markdown.indexOf(markerEnd);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `${documentPath} must contain a ${markerStart} / ${markerEnd} block around the documented repository tree.`
    );
  }

  return markdown.slice(start + markerStart.length, end);
}

function extractDocumentedDirectories(region, documentPath) {
  const directories = [];
  const stack = [];
  const lines = region.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (line.trim() === 'ancore/') {
      stack.length = 0;
      stack[0] = '';
      continue;
    }

    const treeMatch = line.match(/^([│ ]*)[├└]──\s+([^#]+?)(?:\s+#.*)?$/u);
    if (!treeMatch) {
      continue;
    }

    const [, prefix, rawEntry] = treeMatch;
    const entry = rawEntry.trim();

    if (!entry.endsWith('/')) {
      continue;
    }

    const depth = Math.floor(prefix.length / 4);
    const name = entry.replace(/\/$/, '');
    const parent = stack[depth] ?? '';
    const relativePath = parent ? `${parent}/${name}` : name;

    stack[depth + 1] = relativePath;
    stack.length = depth + 2;

    directories.push({
      documentPath,
      line: index + 1,
      relativePath,
    });
  }

  if (directories.length === 0) {
    throw new Error(
      `${documentPath} has a repository structure check block, but no documented directories were found.`
    );
  }

  return directories;
}

async function directoryExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

const failures = [];

for (const documentPath of docsToCheck) {
  const markdown = await readFile(path.join(repoRoot, documentPath), 'utf8');
  const region = getMarkedRegion(markdown, documentPath);
  const documentedDirectories = extractDocumentedDirectories(region, documentPath);

  for (const directory of documentedDirectories) {
    if (!(await directoryExists(directory.relativePath))) {
      failures.push(directory);
    }
  }
}

if (failures.length > 0) {
  console.error('Repository structure drift detected. Documented directories are missing:');
  for (const failure of failures) {
    console.error(
      `- ${failure.relativePath}/ documented in ${failure.documentPath} (structure block line ${failure.line})`
    );
  }
  console.error(
    '\nUpdate the docs to match the repository, restore the missing directories, or update scripts/check-docs-repo-structure.mjs if the checked docs change.'
  );
  process.exit(1);
}

console.log(`Repository structure docs are in sync (${docsToCheck.join(', ')}).`);
