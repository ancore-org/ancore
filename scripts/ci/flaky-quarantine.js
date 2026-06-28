#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_REGISTRY = '.github/flaky-test-quarantine.json';
const REPORT_PATH = '.ci/flaky-quarantine-report.md';
const VALID_AREAS = new Set([
  'smart-contracts',
  'sdk',
  'extension-wallet',
  'mobile-wallet',
  'web-dashboard',
  'documentation',
  'infrastructure',
  'security',
  'other',
]);

function usage() {
  console.error(`Usage:
  node scripts/ci/flaky-quarantine.js validate [--registry path]
  node scripts/ci/flaky-quarantine.js report [--registry path]
  node scripts/ci/flaky-quarantine.js run [--registry path] [--area name] -- <command> [args...]`);
}

function parseOptions(args) {
  const options = { registry: DEFAULT_REGISTRY, area: undefined, command: [] };
  const commandIndex = args.indexOf('--');
  const optionArgs = commandIndex === -1 ? args : args.slice(0, commandIndex);
  options.command = commandIndex === -1 ? [] : args.slice(commandIndex + 1);

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if (arg === '--registry') {
      options.registry = optionArgs[++i];
    } else if (arg === '--area') {
      options.area = optionArgs[++i];
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readRegistry(registryPath) {
  const absolutePath = path.resolve(registryPath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return { registry: JSON.parse(raw) };
}

function parseDate(value, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function daysBetween(start, end) {
  const millis = end.getTime() - start.getTime();
  return Math.ceil(millis / 86_400_000);
}

function validateRegistry(registry) {
  const errors = [];
  const warnings = [];
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const ids = new Set();

  if (registry.version !== 1) {
    errors.push('version must be 1');
  }

  if (!Number.isInteger(registry.maxQuarantineDays) || registry.maxQuarantineDays < 1) {
    errors.push('maxQuarantineDays must be a positive integer');
  }

  if (
    !Array.isArray(registry.labels) ||
    registry.labels.length === 0 ||
    registry.labels.some((label) => typeof label !== 'string' || label.trim() === '')
  ) {
    errors.push('labels must be a non-empty string array');
  }

  if (!Array.isArray(registry.tests)) {
    errors.push('tests must be an array');
    return { errors, warnings };
  }

  registry.tests.forEach((entry, index) => {
    const prefix = `tests[${index}]`;
    for (const field of ['id', 'title', 'area', 'owner', 'issue', 'expiresOn', 'matchers']) {
      if (entry[field] === undefined) {
        errors.push(`${prefix}.${field} is required`);
      }
    }

    if (typeof entry.id === 'string') {
      if (!/^[a-z0-9][a-z0-9-]+$/.test(entry.id)) {
        errors.push(`${prefix}.id must be kebab-case`);
      }
      if (ids.has(entry.id)) {
        errors.push(`${prefix}.id duplicates another quarantine entry`);
      }
      ids.add(entry.id);
    }

    if (!VALID_AREAS.has(entry.area)) {
      errors.push(`${prefix}.area must be one of: ${Array.from(VALID_AREAS).join(', ')}`);
    }

    if (
      typeof entry.issue !== 'string' ||
      !/^#\d+$|^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(entry.issue)
    ) {
      errors.push(
        `${prefix}.issue must be a GitHub issue reference such as #123 or https://github.com/org/repo/issues/123`
      );
    }

    if (!Array.isArray(entry.matchers) || entry.matchers.length === 0) {
      errors.push(`${prefix}.matchers must contain at least one failure signature`);
    } else if (
      entry.matchers.some((matcher) => typeof matcher !== 'string' || matcher.trim() === '')
    ) {
      errors.push(`${prefix}.matchers values must be non-empty strings`);
    }

    if (entry.expiresOn) {
      try {
        const expiresOn = parseDate(entry.expiresOn, `${prefix}.expiresOn`);
        const openedOn = entry.openedOn
          ? parseDate(entry.openedOn, `${prefix}.openedOn`)
          : todayUtc;
        const remainingDays = daysBetween(todayUtc, expiresOn);
        const totalDays = daysBetween(openedOn, expiresOn);

        if (remainingDays < 0) {
          errors.push(`${prefix}.expiresOn is expired`);
        } else if (remainingDays <= 7) {
          warnings.push(`${prefix}.expiresOn expires in ${remainingDays} day(s)`);
        }

        if (registry.maxQuarantineDays && totalDays > registry.maxQuarantineDays) {
          errors.push(
            `${prefix}.expiresOn exceeds maxQuarantineDays (${registry.maxQuarantineDays})`
          );
        }
      } catch (error) {
        errors.push(error.message);
      }
    }
  });

  return { errors, warnings };
}

function matcherHits(matcher, text) {
  if (matcher.startsWith('/') && matcher.endsWith('/') && matcher.length > 2) {
    return new RegExp(matcher.slice(1, -1), 'm').test(text);
  }

  return text.includes(matcher);
}

function matchingEntries(registry, text, area) {
  return registry.tests.filter((entry) => {
    if (area && entry.area !== area) {
      return false;
    }
    return entry.matchers.some((matcher) => matcherHits(matcher, text));
  });
}

function writeGitHubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

function appendStepSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}

function registryReport(registry, matchedEntries = []) {
  const activeEntries = registry.tests;
  const matchedIds = new Set(matchedEntries.map((entry) => entry.id));
  const lines = ['## Flaky Test Quarantine', ''];

  if (activeEntries.length === 0) {
    lines.push('No active quarantined tests.');
  } else {
    lines.push('| ID | Area | Owner | Follow-up | Expires | Status |');
    lines.push('|---|---|---|---|---|---|');
    for (const entry of activeEntries) {
      const status = matchedIds.has(entry.id) ? 'Matched this run' : 'Active';
      lines.push(
        `| ${entry.id} | ${entry.area} | ${entry.owner} | ${entry.issue} | ${entry.expiresOn} | ${status} |`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

function ensureReportDir() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}

function validateCommand(options) {
  const { registry } = readRegistry(options.registry);
  const result = validateRegistry(registry);
  for (const warning of result.warnings) {
    console.warn(`::warning::${warning}`);
  }
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`::error::${error}`);
    }
    writeGitHubOutput({ active_count: registry.tests?.length || 0, valid: false });
    return 1;
  }

  const activeCount = registry.tests.length;
  writeGitHubOutput({ active_count: activeCount, valid: true });
  console.log(
    `Flaky quarantine registry is valid with ${activeCount} active entr${
      activeCount === 1 ? 'y' : 'ies'
    }.`
  );
  return 0;
}

function reportCommand(options) {
  const { registry } = readRegistry(options.registry);
  const markdown = registryReport(registry);
  ensureReportDir();
  fs.writeFileSync(REPORT_PATH, markdown);
  appendStepSummary(markdown);
  console.log(markdown);
  return 0;
}

function runCommand(options) {
  if (options.command.length === 0) {
    throw new Error('run requires a command after --');
  }

  const { registry } = readRegistry(options.registry);
  const validation = validateRegistry(registry);
  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      console.error(`::error::${error}`);
    }
    return 1;
  }

  const result = spawnSync(options.command[0], options.command.slice(1), {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status === 0) {
    return 0;
  }

  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  const matches = matchingEntries(registry, combinedOutput, options.area);
  if (matches.length === 0) {
    return result.status || 1;
  }

  const markdown = registryReport(registry, matches);
  ensureReportDir();
  fs.writeFileSync(REPORT_PATH, markdown);
  appendStepSummary(markdown);
  writeGitHubOutput({ quarantined: true, matched_count: matches.length });

  for (const entry of matches) {
    console.warn(`::warning::Quarantined flaky test matched: ${entry.id} (${entry.issue})`);
  }
  console.warn(
    'A quarantined flaky signature matched this failure. CI will continue, but the follow-up issue remains required.'
  );
  return 0;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  try {
    const options = parseOptions(args);
    if (command === 'validate') {
      process.exitCode = validateCommand(options);
    } else if (command === 'report') {
      process.exitCode = reportCommand(options);
    } else if (command === 'run') {
      process.exitCode = runCommand(options);
    } else {
      usage();
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    usage();
    process.exitCode = 1;
  }
}

main();
