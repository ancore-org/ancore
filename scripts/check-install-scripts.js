#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const allowlistPath = path.join(__dirname, '..', '.pnpm-install-scripts-allowlist.json');
const rootPkgPath = path.join(__dirname, '..', 'package.json');

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

const allowed = new Set(allowlist.packages.map((p) => p.name));
// Packages whose install scripts are known and deliberately NOT run. They must
// stay out of onlyBuiltDependencies — that list is what grants execution.
const denied = new Set((allowlist.denied ?? []).map((p) => p.name));
const configured = new Set(rootPkg.pnpm?.onlyBuiltDependencies ?? []);

const missingFromConfig = [...allowed].filter((name) => !configured.has(name));
const extraInConfig = [...configured].filter((name) => !allowed.has(name));
const deniedButConfigured = [...denied].filter((name) => configured.has(name));

if (missingFromConfig.length > 0) {
  console.error('Packages in allowlist but missing from pnpm.onlyBuiltDependencies:');
  for (const name of missingFromConfig) {
    console.error(`  - ${name}`);
  }
  process.exitCode = 1;
}

if (extraInConfig.length > 0) {
  console.error('Packages in pnpm.onlyBuiltDependencies but missing from allowlist:');
  for (const name of extraInConfig) {
    console.error(`  - ${name}`);
  }
  process.exitCode = 1;
}

if (deniedButConfigured.length > 0) {
  console.error(
    'Packages listed as denied but present in pnpm.onlyBuiltDependencies (this grants them execution):'
  );
  for (const name of deniedButConfigured) {
    console.error(`  - ${name}`);
  }
  process.exitCode = 1;
}

const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
if (fs.existsSync(pnpmDir)) {
  const foundScripts = [];
  const entries = fs.readdirSync(pnpmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nmDir = path.join(pnpmDir, entry.name, 'node_modules');
    if (!fs.existsSync(nmDir)) continue;
    const items = fs.readdirSync(nmDir);
    for (const item of items) {
      const pkgPath = path.join(nmDir, item, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = [];
        if (pkg.scripts) {
          if (pkg.scripts.preinstall) scripts.push('preinstall');
          if (pkg.scripts.install) scripts.push('install');
          if (pkg.scripts.postinstall) scripts.push('postinstall');
        }
        if (scripts.length > 0 && !allowed.has(pkg.name) && !denied.has(pkg.name)) {
          foundScripts.push({ name: pkg.name, scripts });
        }
      } catch {}
    }
  }
  if (foundScripts.length > 0) {
    console.error('Unallowlisted packages with install scripts found:');
    for (const pkg of foundScripts) {
      console.error(`  - ${pkg.name}: ${pkg.scripts.join(', ')}`);
    }
    console.error('');
    console.error('If this package needs to run install scripts:');
    console.error(
      `  1. Add "${foundScripts[0].name}" to "packages" in .pnpm-install-scripts-allowlist.json`
    );
    console.error('  2. Add justification and tracking issue');
    console.error('  3. Add the package name to pnpm.onlyBuiltDependencies in package.json');
    console.error('');
    console.error('If its install script should stay blocked (the usual case), add it');
    console.error('to "denied" instead and leave pnpm.onlyBuiltDependencies alone.');
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error('\nInstall script policy check failed.');
} else {
  console.log('All install scripts are allowlisted and consistent.');
}
