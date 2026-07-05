# Security Audit Report

**Generated:** 2026-07-05T12:56:04.694Z
**Status:** FAIL

## Summary

| Metric       | Value |
| ------------ | ----- |
| Total Checks | 11    |
| Passed       | 7     |
| Failed       | 4     |
| Pass Rate    | 63.6% |

## Checks

### ✓ File exists: docs/security/THREAT_MODEL.md

**Description:** Threat model documentation
**Status:** PASS

### ✓ File exists: docs/security/AUDIT_CHECKLIST.md

**Description:** Audit checklist
**Status:** PASS

### ✓ File exists: docs/security/CRYPTOGRAPHY.md

**Description:** Cryptography details
**Status:** PASS

### ✓ File exists: SECURITY.md

**Description:** Security policy
**Status:** PASS

### ✗ dependency audit

**Description:** NPM dependency vulnerability scan
**Status:** FAIL
**Error:** Command failed: pnpm audit --audit-level=high

### ✗ cargo audit

**Description:** Rust dependency vulnerability scan
**Status:** FAIL
**Error:** Command failed: cargo audit
'cargo' is not recognized as an internal or external command,
operable program or batch file.

### ✗ unit tests

**Description:** Run unit tests with coverage
**Status:** FAIL
**Error:** Command failed: pnpm test -- --coverage
ERROR unexpected argument '--coverage' found

tip: to pass '--coverage' as a value, use '-- --coverage'

Usage: turbo.exe run [OPTIONS] [TASKS]... [-- <PASS_THROUGH_ARGS>...]

Options:
--cache-dir <CACHE_DIR>
--concurrency <CONCURRENCY>
--continue[=<CONTINUE>]
--single-package
--framework-inference [<BOOL>]
--global-deps <GLOBAL_DEPS>
--env-mode [<ENV_MODE>]
--filter <FILTER>
--affected
--output-logs <OUTPUT_LOGS>
--log-order <LOG_ORDER>
--json
--log-file [<LOG_FILE>]
--only
--pkg-inference-root <PKG_INFERENCE_ROOT>
--log-prefix <LOG_PREFIX>
TASKS
PASS_THROUGH_ARGS
--cache <CACHE>
--force [<FORCE>]
--remote-only [<REMOTE_ONLY>]
--remote-cache-read-only [<REMOTE_CACHE_READ_ONLY>]
--no-cache <NO_CACHE>
--cache-workers <CACHE_WORKERS>
--dry-run [<DRY_RUN>]
--graph [<GRAPH>]
--daemon <DAEMON>
--no-daemon <NO_DAEMON>
--profile [<PROFILE>]
--anon-profile [<ANON_PROFILE>]
--summarize [<SUMMARIZE>]
--parallel <PARALLEL>

For more information, try '--help'.

### ✗ lint

**Description:** Linting check
**Status:** FAIL
**Error:** Command failed: pnpm lint
• turbo 2.9.15
ERROR @ancore/wallet-api#lint: command (C:\Users\Wittig_Lyon\Desktop\wae\ancore\packages\wallet-api) C:\Users\Wittig_Lyon\AppData\Roaming\npm\pnpm.cmd run lint exited (1)
ERROR run failed: command exited (1)

### ✓ format check

**Description:** Code formatting check
**Status:** PASS

### ✓ ts compilation

**Description:** TypeScript compilation check
**Status:** PASS

### ✓ build

**Description:** Full build verification
**Status:** PASS

## Artifacts

| Artifact        | Description                | Location        |
| --------------- | -------------------------- | --------------- |
| package-lock    | Locked dependency versions | package-lock    |
| cargo-lock      | Rust dependency lock file  | cargo-lock      |
| security-docs   | Security documentation     | security-docs   |
| audit-checklist | Audit checklist            | audit-checklist |
