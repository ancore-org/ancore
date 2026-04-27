#!/usr/bin/env node

/**
 * Coverage Gate Checker
 * 
 * Validates that test coverage for critical security modules meets defined thresholds.
 * Generates CI-friendly reports and highlights modules below threshold.
 * 
 * Usage:
 *   node scripts/coverage-gate.js [--threshold PERCENT] [--report]
 */

const fs = require('fs');
const path = require('path');

const CRITICAL_MODULES = {
  'core-sdk': {
    paths: [
      'packages/core-sdk/coverage/coverage-final.json',
    ],
    gates: {
      'execute-with-session-key.ts': { branches: 95, functions: 95, lines: 95, statements: 95 },
      'session': { branches: 90, functions: 95, lines: 90, statements: 90 },
      'wallet': { branches: 85, functions: 90, lines: 85, statements: 85 },
      'global': { branches: 75, functions: 90, lines: 85, statements: 85 },
    },
  },
  'account-abstraction': {
    paths: [
      'packages/account-abstraction/coverage/coverage-final.json',
    ],
    gates: {
      'execute.ts': { branches: 95, functions: 95, lines: 95, statements: 95 },
      'auth': { branches: 90, functions: 95, lines: 90, statements: 90 },
      'lock': { branches: 90, functions: 95, lines: 90, statements: 90 },
      'global': { branches: 75, functions: 90, lines: 85, statements: 85 },
    },
  },
  'crypto': {
    paths: [
      'packages/crypto/coverage/coverage-final.json',
    ],
    gates: {
      'keys.ts': { branches: 95, functions: 95, lines: 95, statements: 95 },
      'signing': { branches: 95, functions: 95, lines: 95, statements: 95 },
      'encryption': { branches: 90, functions: 95, lines: 90, statements: 90 },
      'global': { branches: 85, functions: 90, lines: 88, statements: 88 },
    },
  },
  'stellar': {
    paths: [
      'packages/stellar/coverage/coverage-final.json',
    ],
    gates: {
      'client': { branches: 85, functions: 90, lines: 85, statements: 85 },
      'global': { branches: 60, functions: 75, lines: 70, statements: 70 },
    },
  },
};

class CoverageGateChecker {
  constructor() {
    this.failures = [];
    this.warnings = [];
    this.results = {};
  }

  /**
   * Parse coverage data from coverage-final.json
   */
  parseCoverageFile(filePath) {
    if (!fs.existsSync(filePath)) {
      this.warnings.push(`Coverage file not found: ${filePath}`);
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    } catch (error) {
      this.failures.push(`Failed to parse coverage file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate coverage summary for a file or directory
   */
  calculateCoverage(coverageData, filePath) {
    const items = Object.entries(coverageData).filter(([file]) => {
      if (filePath === 'global') return true;
      return file.includes(filePath);
    });

    if (items.length === 0) {
      return null;
    }

    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;

    items.forEach(([, fileCoverage]) => {
      if (fileCoverage.s) {
        const statements = Object.values(fileCoverage.s);
        totalStatements += statements.length;
        coveredStatements += statements.filter(s => s > 0).length;
      }

      if (fileCoverage.b) {
        const branches = Object.values(fileCoverage.b).flat();
        totalBranches += branches.length;
        coveredBranches += branches.filter(b => b > 0).length;
      }

      if (fileCoverage.f) {
        const functions = Object.values(fileCoverage.f);
        totalFunctions += functions.length;
        coveredFunctions += functions.filter(f => f > 0).length;
      }

      if (fileCoverage.l) {
        const lines = Object.values(fileCoverage.l);
        totalLines += lines.length;
        coveredLines += lines.filter(l => l > 0).length;
      }
    });

    return {
      branches: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 0,
      functions: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0,
      lines: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0,
      statements: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0,
    };
  }

  /**
   * Check if coverage meets threshold
   */
  checkThreshold(actual, threshold, modulePath) {
    const failures = [];

    Object.entries(threshold).forEach(([metric, required]) => {
      if (actual[metric] < required) {
        failures.push({
          metric,
          required,
          actual: actual[metric],
          delta: required - actual[metric],
        });
      }
    });

    return failures;
  }

  /**
   * Run full coverage check
   */
  check() {
    console.log('\n📊 Coverage Gate Check\n');
    console.log('='.repeat(80));

    Object.entries(CRITICAL_MODULES).forEach(([moduleName, moduleConfig]) => {
      console.log(`\n🔍 Module: ${moduleName}`);
      console.log('-'.repeat(80));

      const coverageFile = moduleConfig.paths[0];
      const coverageData = this.parseCoverageFile(coverageFile);

      if (!coverageData) {
        return;
      }

      this.results[moduleName] = {
        passed: true,
        checks: [],
      };

      // Check global threshold first
      const globalCoverage = this.calculateCoverage(coverageData, 'global');
      if (globalCoverage) {
        const globalThreshold = moduleConfig.gates.global;
        const globalFailures = this.checkThreshold(globalCoverage, globalThreshold, 'global');

        const status = globalFailures.length === 0 ? '✅' : '❌';
        console.log(`${status} Global: B${globalCoverage.branches}% F${globalCoverage.functions}% L${globalCoverage.lines}% S${globalCoverage.statements}%`);

        if (globalFailures.length > 0) {
          this.results[moduleName].passed = false;
          globalFailures.forEach(f => {
            console.log(`   └─ ${f.metric}: ${f.actual}% (need ${f.required}%, ${f.delta}% short)`);
            this.failures.push(`${moduleName} global ${f.metric}: ${f.actual}% < ${f.required}%`);
          });
        }
      }

      // Check critical paths
      Object.entries(moduleConfig.gates).forEach(([pathName, threshold]) => {
        if (pathName === 'global') return;

        const coverage = this.calculateCoverage(coverageData, pathName);
        if (!coverage) {
          this.warnings.push(`${moduleName}/${pathName}: No coverage data found`);
          return;
        }

        const failures = this.checkThreshold(coverage, threshold, pathName);
        const status = failures.length === 0 ? '✅' : '❌';

        console.log(`${status} ${pathName}: B${coverage.branches}% F${coverage.functions}% L${coverage.lines}% S${coverage.statements}%`);

        if (failures.length > 0) {
          this.results[moduleName].passed = false;
          failures.forEach(f => {
            console.log(`   └─ ${f.metric}: ${f.actual}% (need ${f.required}%, ${f.delta}% short)`);
            this.failures.push(`${moduleName}/${pathName} ${f.metric}: ${f.actual}% < ${f.required}%`);
          });
        }
      });
    });

    this.printSummary();
    return this.failures.length === 0;
  }

  /**
   * Print summary and exit with appropriate code
   */
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 Summary\n');

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(w => console.log(`   - ${w}`));
      console.log();
    }

    if (this.failures.length > 0) {
      console.log(`❌ ${this.failures.length} Coverage Gate(s) Failed:`);
      this.failures.forEach(f => console.log(`   - ${f}`));
      console.log();
      process.exit(1);
    } else {
      console.log('✅ All coverage gates passed!\n');
      process.exit(0);
    }
  }
}

const checker = new CoverageGateChecker();
const passed = checker.check();

if (!passed) {
  process.exit(1);
}
