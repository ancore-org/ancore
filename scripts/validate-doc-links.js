#!/usr/bin/env node

/**
 * Validate markdown links in documentation files.
 * Checks for:
 * - Broken relative links
 * - Invalid anchor references
 * - Missing files
 *
 * Usage: node scripts/validate-doc-links.js [--fix]
 */

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.join(__dirname, '..', 'docs');
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const ANCHOR_PATTERN = /^#(.+)$/;

let errorCount = 0;
let warningCount = 0;

/**
 * Resolve a markdown link to an absolute file path
 */
function resolveLinkPath(fromFile, linkTarget) {
  const [filePath, anchor] = linkTarget.split('#');

  if (!filePath) {
    // Anchor-only link (same file)
    return { file: fromFile, anchor, isValid: true };
  }

  // Resolve relative path
  const fromDir = path.dirname(fromFile);
  const resolvedPath = path.resolve(fromDir, filePath);

  return { file: resolvedPath, anchor, isRelative: true };
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Extract anchors from a markdown file
 */
function extractAnchors(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const anchors = new Set();

    // Extract heading anchors (## Heading → #heading)
    const headingPattern = /^#+\s+(.+)$/gm;
    let match;
    while ((match = headingPattern.exec(content)) !== null) {
      const heading = match[1]
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      anchors.add(heading);
    }

    // Extract explicit anchor IDs (e.g., <!-- #custom-id -->)
    const idPattern = /<!--\s*#([\w-]+)\s*-->/g;
    while ((match = idPattern.exec(content)) !== null) {
      anchors.add(match[1]);
    }

    return anchors;
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    return new Set();
  }
}

/**
 * Validate a single link
 */
function validateLink(fromFile, linkText, linkTarget) {
  // Skip external links
  if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
    return true;
  }

  // Skip email links
  if (linkTarget.startsWith('mailto:')) {
    return true;
  }

  const { file, anchor } = resolveLinkPath(fromFile, linkTarget);

  // Check if file exists
  if (!fileExists(file)) {
    console.error(`❌ Broken link in ${fromFile}:`);
    console.error(`   [${linkText}](${linkTarget})`);
    console.error(`   → File not found: ${file}`);
    errorCount++;
    return false;
  }

  // Check if anchor exists (if specified)
  if (anchor) {
    const anchors = extractAnchors(file);
    if (!anchors.has(anchor)) {
      console.warn(`⚠️  Invalid anchor in ${fromFile}:`);
      console.warn(`   [${linkText}](${linkTarget})`);
      console.warn(`   → Anchor not found: #${anchor}`);
      console.warn(`   Available anchors: ${Array.from(anchors).join(', ') || 'none'}`);
      warningCount++;
      return false;
    }
  }

  return true;
}

/**
 * Validate all links in a markdown file
 */
function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let match;

    while ((match = LINK_PATTERN.exec(content)) !== null) {
      const [, linkText, linkTarget] = match;
      validateLink(filePath, linkText, linkTarget);
    }
  } catch (err) {
    console.error(`Error processing ${filePath}: ${err.message}`);
    errorCount++;
  }
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...findMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}: ${err.message}`);
  }

  return files;
}

/**
 * Main validation
 */
function main() {
  console.log(`🔍 Validating markdown links in ${DOCS_ROOT}...\n`);

  const files = findMarkdownFiles(DOCS_ROOT);
  console.log(`Found ${files.length} markdown files\n`);

  for (const file of files) {
    validateFile(file);
  }

  console.log(`\n📊 Results:`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Warnings: ${warningCount}`);

  if (errorCount > 0) {
    console.log(`\n❌ Link validation failed`);
    process.exit(1);
  }

  if (warningCount > 0) {
    console.log(`\n⚠️  Link validation passed with warnings`);
    process.exit(0);
  }

  console.log(`\n✅ All links valid`);
  process.exit(0);
}

main();
