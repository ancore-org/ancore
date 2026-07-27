#!/usr/bin/env node
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const allowlistPath = '.pnpm-audit-allowlist.json';
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));

for (const entry of allowlist.advisories ?? []) {
  if (!entry.id || !entry.issue || !entry.justification || !entry.expires) {
    console.error(`Invalid audit allowlist entry: ${JSON.stringify(entry)}`);
    process.exit(1);
  }
  if (!/^https:\/\/github\.com\/ancore-org\/ancore\/issues\/\d+$/.test(entry.issue)) {
    console.error(
      `Audit allowlist entry ${entry.id} must include an ancore-org/ancore GitHub issue URL.`
    );
    process.exit(1);
  }
  if (Date.parse(entry.expires) <= Date.now()) {
    console.error(`Audit allowlist entry ${entry.id} expired on ${entry.expires}.`);
    process.exit(1);
  }
}

// Large monorepo trees produce multi-MB audit JSON. Node's default maxBuffer (1 MiB)
// truncates stdout mid-object and makes JSON.parse fail ("Unable to parse…").
const audit = spawnSync('pnpm', ['audit', '--audit-level=high', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  // Windows needs a shell to resolve the pnpm.cmd shim from PATH.
  shell: process.platform === 'win32',
});
if (audit.error) {
  console.error('Failed to run pnpm audit:', audit.error.message);
  process.exit(1);
}
if (audit.status === 0) {
  process.exit(0);
}

let report;
try {
  report = JSON.parse(audit.stdout || '{}');
} catch (error) {
  console.error('Unable to parse pnpm audit JSON output.');
  console.error(error instanceof Error ? error.message : error);
  console.error(
    `stdout bytes: ${(audit.stdout || '').length}, stderr bytes: ${(audit.stderr || '').length}`
  );
  if (audit.stderr) {
    console.error(audit.stderr.slice(0, 2000));
  }
  process.exit(1);
}

const allowed = new Set((allowlist.advisories ?? []).map((entry) => String(entry.id)));
const advisories = Object.values(report.advisories ?? {});
const highOrWorse = advisories.filter((advisory) =>
  ['high', 'critical'].includes(advisory.severity)
);
const unallowed = highOrWorse.filter(
  (advisory) =>
    !allowed.has(String(advisory.id)) && !allowed.has(String(advisory.github_advisory_id))
);

if (unallowed.length > 0) {
  console.error('Unallowlisted high/critical pnpm audit advisories found:');
  for (const advisory of unallowed) {
    console.error(
      `- ${advisory.id || advisory.github_advisory_id}: ${advisory.module_name} (${advisory.severity}) ${advisory.title}`
    );
  }
  process.exit(1);
}

console.warn(
  `pnpm audit reported ${highOrWorse.length} high/critical advisories, all allowlisted.`
);
