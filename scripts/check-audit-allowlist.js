#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

// Large monorepo trees produce multi-MB audit JSON. Capturing it through a
// pipe (spawnSync's default 'pipe' stdio) has failed two ways in practice:
// Node's default maxBuffer (1 MiB) truncated stdout mid-object, and even
// after raising maxBuffer, GitHub's Linux runners threw `spawnSync pnpm
// ENOBUFS` — a kernel pipe-buffer overflow from pnpm writing the JSON faster
// than spawnSync's synchronous read loop can drain it, unrelated to
// maxBuffer. Redirecting stdout straight to a file sidesteps the pipe
// entirely: the kernel writes it directly, nothing needs draining, and
// there's no in-memory size limit to hit.
const stdoutPath = path.join(os.tmpdir(), `pnpm-audit-${process.pid}.json`);
const stdoutFd = fs.openSync(stdoutPath, 'w');
let audit;
try {
  audit = spawnSync('pnpm', ['audit', '--audit-level=high', '--json'], {
    stdio: ['ignore', stdoutFd, 'pipe'],
    encoding: 'utf8',
    // Windows needs a shell to resolve the pnpm.cmd shim from PATH.
    shell: process.platform === 'win32',
  });
} finally {
  fs.closeSync(stdoutFd);
}
if (audit.error) {
  fs.unlinkSync(stdoutPath);
  console.error('Failed to run pnpm audit:', audit.error.message);
  process.exit(1);
}
if (audit.status === 0) {
  fs.unlinkSync(stdoutPath);
  process.exit(0);
}

const rawAuditOutput = fs.readFileSync(stdoutPath, 'utf8').trim();
fs.unlinkSync(stdoutPath);
const jsonStartIndex = rawAuditOutput.indexOf('{');
const jsonEndIndex = rawAuditOutput.lastIndexOf('}');
const auditJsonOutput =
  jsonStartIndex >= 0 && jsonEndIndex >= jsonStartIndex
    ? rawAuditOutput.slice(jsonStartIndex, jsonEndIndex + 1)
    : rawAuditOutput;

let report;
try {
  report = JSON.parse(auditJsonOutput || '{}');
} catch (error) {
  console.error('Unable to parse pnpm audit JSON output.');
  console.error(error instanceof Error ? error.message : error);
  console.error(
    `stdout bytes: ${rawAuditOutput.length}, stderr bytes: ${(audit.stderr || '').length}`
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

// An allowlist entry is only justified when there is nothing to upgrade to.
// pnpm reports "<0.0.0" for advisories with no patched release. If a fix has
// since shipped, the entry must go and the dependency must be bumped —
// otherwise a now-patchable vulnerability stays suppressed behind a green gate.
const nowPatchable = highOrWorse.filter(
  (advisory) =>
    (allowed.has(String(advisory.id)) || allowed.has(String(advisory.github_advisory_id))) &&
    advisory.patched_versions &&
    advisory.patched_versions.trim() !== '<0.0.0'
);

if (nowPatchable.length > 0) {
  console.warn('WARNING: allowlisted advisories now have an upstream fix available:');
  for (const advisory of nowPatchable) {
    console.warn(
      `- ${advisory.id || advisory.github_advisory_id}: ${advisory.module_name} -> upgrade to ${advisory.patched_versions}`
    );
  }
  console.warn(
    'These are no longer unfixable. Upgrade the dependency and drop the entry from .pnpm-audit-allowlist.json.'
  );
  console.warn(
    'Reported as a warning rather than a failure so the surfacing change does not itself break CI; the entry expiry date remains the hard deadline.'
  );
}

// Entries that no longer match anything are dead weight: they keep a stale
// suppression alive and obscure which advisories are actually in effect.
const reportedIds = new Set(
  highOrWorse.flatMap((advisory) =>
    [advisory.id, advisory.github_advisory_id].filter(Boolean).map(String)
  )
);
const stale = (allowlist.advisories ?? []).filter((entry) => !reportedIds.has(String(entry.id)));
if (stale.length > 0) {
  console.warn(
    `Note: ${stale.length} allowlist entr${stale.length === 1 ? 'y is' : 'ies are'} no longer reported by pnpm audit and can be removed: ${stale
      .map((entry) => entry.id)
      .join(', ')}`
  );
}

console.warn(
  `pnpm audit reported ${highOrWorse.length} high/critical advisories, all allowlisted.`
);
