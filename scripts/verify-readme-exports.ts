import * as fs from 'fs';
import * as path from 'path';

const INDEX_PATH = path.join(__dirname, '../packages/core-sdk/src/index.ts');
const README_PATH = path.join(__dirname, '../packages/core-sdk/README.md');

function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`Index file not found at: ${INDEX_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(README_PATH)) {
    console.error(`README file not found at: ${README_PATH}`);
    process.exit(1);
  }

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
  const readmeContent = fs.readFileSync(README_PATH, 'utf8');

  const exports = new Set<string>();

  // 1. Match: export const XYZ = ... or export function XYZ(...) or export class XYZ ...
  const constRegex = /export\s+(?:const|class|function|let|var)\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = constRegex.exec(indexContent)) !== null) {
    exports.add(match[1]);
  }

  // 2. Match braces: export { ... }
  const exportBracesRegex = /export\s+(?:type\s+)?{([^}]+)}/g;
  while ((match = exportBracesRegex.exec(indexContent)) !== null) {
    const list = match[1];
    const items = list.split(',');
    for (let item of items) {
      item = item.trim();
      if (!item) continue;
      // Handle renames like "foo as bar"
      if (item.includes(' as ')) {
        item = item.split(' as ')[1].trim();
      }
      // Handle "type foo"
      if (item.startsWith('type ')) {
        item = item.slice(5).trim();
      }
      if (item) {
        exports.add(item);
      }
    }
  }

  console.log(`Found ${exports.size} total exports in index.ts`);

  const missing: string[] = [];
  for (const exp of exports) {
    if (!readmeContent.includes(exp)) {
      missing.push(exp);
    }
  }

  if (missing.length > 0) {
    console.error('\x1b[31mError: Undocumented exports found in README.md:\x1b[0m');
    for (const item of missing) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  console.log('\x1b[32mSuccess: All core-sdk exports are documented in README.md!\x1b[0m');
  process.exit(0);
}

main();
