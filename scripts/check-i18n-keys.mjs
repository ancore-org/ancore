#!/usr/bin/env node
/**
 * Checks that every key in en.json is present in every other locale file.
 * Exits with code 1 if any locale is missing keys, 0 otherwise.
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(
  __dirname,
  "../apps/extension-wallet/src/i18n/locales",
);

function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? flattenKeys(value, full)
      : [full];
  });
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));
const baseFile = "en.json";

if (!files.includes(baseFile)) {
  console.error(`Missing base locale: ${baseFile}`);
  process.exit(1);
}

const baseKeys = new Set(
  flattenKeys(JSON.parse(readFileSync(join(LOCALES_DIR, baseFile), "utf8"))),
);

let failed = false;

for (const file of files) {
  if (file === baseFile) continue;

  const locale = file.replace(".json", "");
  const keys = new Set(
    flattenKeys(JSON.parse(readFileSync(join(LOCALES_DIR, file), "utf8"))),
  );

  const missing = [...baseKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !baseKeys.has(k));

  if (missing.length > 0) {
    console.error(`[${locale}] Missing ${missing.length} key(s):`);
    missing.forEach((k) => console.error(`  - ${k}`));
    failed = true;
  }

  if (extra.length > 0) {
    console.warn(`[${locale}] Extra ${extra.length} key(s) not in en.json:`);
    extra.forEach((k) => console.warn(`  + ${k}`));
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`[${locale}] ✓ All keys match en.json`);
  }
}

if (failed) {
  console.error("\nI18n key coverage check FAILED.");
  process.exit(1);
} else {
  console.log("\nI18n key coverage check passed.");
}
