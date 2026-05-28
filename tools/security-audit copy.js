#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Security Audit Evidence Collection Script
 *
 * Automates security audit preparation by:
 * 1. Running security validation steps
 * 2. Collecting test outputs and config snapshots
 * 3. Verifying threat model documentation
 * 4. Generating audit evidence report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const evidenceDir = path.resolve(rootDir, '.audit-evidence');

// Create evidence directory
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

const report = {
  timestamp: new Date().toISOString(),
  version: '1.0.0',
  checks: [],
  artifacts: [],
  status: 'pending',
};

function log(message, level = 'INFO') {
  console.log(`[${level}] ${message}`);
}

function runCheck(name, command, description) {
  log(`Running: ${name}`);
  try {
    const output = execSync(command, { encoding: 'utf-8', cwd: rootDir });
    report.checks.push({
      name,
      description,
      status: 'PASS',
      timestamp: new Date().toISOString(),
    });
    log(`✓ ${name} passed`, 'PASS');
    return output;
  } catch (error) {
    report.checks.push({
      name,
      description,
      status: 'FAIL',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    log(`✗ ${name} failed: ${error.message}`, 'FAIL');
    return null;
  }
}

function collectArtifact(name, sourcePath, description) {
  log(`Collecting artifact: ${name}`);
  try {
    const fullPath = path.resolve(rootDir, sourcePath);
    if (fs.existsSync(fullPath)) {
      const destPath = path.resolve(evidenceDir, name.replace(/\s+/g, '-').toLowerCase());

      if (fs.statSync(fullPath).isDirectory()) {
        // Copy directory recursively
        copyDirSync(fullPath, destPath);
      } else {
        // Copy file
        fs.copyFileSync(fullPath, destPath);
      }

      report.artifacts.push({
        name,
        description,
        sourcePath,
        location: destPath,
        timestamp: new Date().toISOString(),
      });
      log(`✓ Collected ${name}`, 'PASS');
    } else {
      log(`✗ Artifact not found: ${sourcePath}`, 'WARN');
    }
  } catch (error) {
    log(`✗ Failed to collect ${name}: ${error.message}`, 'FAIL');
  }
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function verifyFileExists(filePath, description) {
  const fullPath = path.resolve(rootDir, filePath);
  const exists = fs.existsSync(fullPath);

  report.checks.push({
    name: `File exists: ${filePath}`,
    description,
    status: exists ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
  });

  if (exists) {
    log(`✓ ${filePath} exists`, 'PASS');
  } else {
    log(`✗ ${filePath} missing`, 'FAIL');
  }

  return exists;
}

async function runAudit() {
  log('Starting security audit evidence collection...');
  log(`Evidence directory: ${evidenceDir}`);

  // Phase 1: Verify critical security documentation
  log('\n=== Phase 1: Documentation Verification ===');
  verifyFileExists('docs/security/THREAT_MODEL.md', 'Threat model documentation');
  verifyFileExists('docs/security/AUDIT_CHECKLIST.md', 'Audit checklist');
  verifyFileExists('docs/security/CRYPTOGRAPHY.md', 'Cryptography details');
  verifyFileExists('SECURITY.md', 'Security policy');

  // Phase 2: Run security checks
  log('\n=== Phase 2: Security Validation ===');
  runCheck(
    'dependency audit',
    'pnpm audit --audit-level=high',
    'NPM dependency vulnerability scan'
  );
  runCheck('cargo audit', 'cargo audit', 'Rust dependency vulnerability scan');

  // Phase 3: Run tests
  log('\n=== Phase 3: Test Coverage ===');
  runCheck('unit tests', 'pnpm test -- --coverage', 'Run unit tests with coverage');

  // Phase 4: Lint and format checks
  log('\n=== Phase 4: Code Quality ===');
  runCheck('lint', 'pnpm lint', 'Linting check');
  runCheck('format check', 'pnpm format:check', 'Code formatting check');

  // Phase 5: Build verification
  log('\n=== Phase 5: Build Verification ===');
  runCheck('ts compilation', 'pnpm tsc --noEmit', 'TypeScript compilation check');
  runCheck('build', 'pnpm build', 'Full build verification');

  // Phase 6: Collect artifacts
  log('\n=== Phase 6: Artifact Collection ===');
  collectArtifact('test-coverage', 'coverage/', 'Test coverage reports');
  collectArtifact('package-lock', 'pnpm-lock.yaml', 'Locked dependency versions');
  collectArtifact('cargo-lock', 'contracts/Cargo.lock', 'Rust dependency lock file');
  collectArtifact('security-docs', 'docs/security/', 'Security documentation');
  collectArtifact('audit-checklist', 'docs/security/AUDIT_CHECKLIST.md', 'Audit checklist');

  // Phase 7: Generate summary
  log('\n=== Phase 7: Summary ===');
  const passed = report.checks.filter((c) => c.status === 'PASS').length;
  const failed = report.checks.filter((c) => c.status === 'FAIL').length;
  const total = report.checks.length;

  report.status = failed === 0 ? 'PASS' : 'FAIL';
  report.summary = {
    totalChecks: total,
    passed,
    failed,
    passRate: ((passed / total) * 100).toFixed(1),
  };

  // Save report
  const reportPath = path.resolve(evidenceDir, 'audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Generate readable report
  const readableReportPath = path.resolve(evidenceDir, 'AUDIT_REPORT.md');
  const readableReport = generateMarkdownReport(report);
  fs.writeFileSync(readableReportPath, readableReport);

  log(`\n=== Audit Complete ===`);
  log(`Status: ${report.status}`);
  log(`Passed: ${passed}/${total}`);
  log(`Evidence directory: ${evidenceDir}`);
  log(`Report: ${reportPath}`);

  process.exit(failed === 0 ? 0 : 1);
}

function generateMarkdownReport(report) {
  let markdown = `# Security Audit Report\n\n`;
  markdown += `**Generated:** ${new Date(report.timestamp).toISOString()}\n`;
  markdown += `**Status:** ${report.status}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Checks | ${report.summary.totalChecks} |\n`;
  markdown += `| Passed | ${report.summary.passed} |\n`;
  markdown += `| Failed | ${report.summary.failed} |\n`;
  markdown += `| Pass Rate | ${report.summary.passRate}% |\n\n`;

  markdown += `## Checks\n\n`;
  for (const check of report.checks) {
    const icon = check.status === 'PASS' ? '✓' : '✗';
    markdown += `### ${icon} ${check.name}\n\n`;
    markdown += `**Description:** ${check.description}\n`;
    markdown += `**Status:** ${check.status}\n`;
    if (check.error) {
      markdown += `**Error:** ${check.error}\n`;
    }
    markdown += `\n`;
  }

  markdown += `## Artifacts\n\n`;
  if (report.artifacts.length === 0) {
    markdown += `No artifacts collected.\n`;
  } else {
    markdown += `| Artifact | Description | Location |\n`;
    markdown += `|----------|-------------|----------|\n`;
    for (const artifact of report.artifacts) {
      markdown += `| ${artifact.name} | ${artifact.description} | ${path.relative(evidenceDir, artifact.location)} |\n`;
    }
  }

  return markdown;
}

runAudit().catch((error) => {
  log(`Audit failed: ${error.message}`, 'ERROR');
  process.exit(1);
});
