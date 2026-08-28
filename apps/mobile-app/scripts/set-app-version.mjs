#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

function usage(message) {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.error("Usage: node scripts/set-app-version.mjs <version>");
  process.exit(1);
}

const version = process.argv[2];
if (!version) {
  usage("Version is required");
}

if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
  usage(`Invalid semver: ${version}`);
}

function updateFile(filePath, updater) {
  const absolutePath = path.join(rootDir, filePath);
  const original = fs.readFileSync(absolutePath, "utf8");
  const updated = updater(original);

  if (original === updated) {
    console.warn(`No changes applied to ${filePath}`);
  } else {
    fs.writeFileSync(absolutePath, updated, "utf8");
    console.log(`Updated ${filePath}`);
  }
}

updateFile("android/app/build.gradle", (contents) =>
  contents.replace(/versionName\s+"[^"]+"/g, `versionName "${version}"`),
);

// iOS marketing version is driven by MARKETING_VERSION in project.pbxproj.
// Plists use $(MARKETING_VERSION) — no plist edits needed when the macro is present.

updateFile("ios/AncoreWallet.xcodeproj/project.pbxproj", (contents) =>
  contents.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`),
);

updateFile("package.json", (contents) => {
  const packageJson = JSON.parse(contents);
  packageJson.version = version;
  return `${JSON.stringify(packageJson, null, 2)}\n`;
});

console.log(`App version set to ${version}`);
