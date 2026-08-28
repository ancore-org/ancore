# Background Handlers Coverage

Package-level vitest thresholds gate CI on `src/background/handlers/**/*.ts` coverage.

## Current thresholds

| Metric    | Threshold | Rationale                                   |
| --------- | --------- | ------------------------------------------- |
| Statements | 35%      | Covers sign-transaction, allowlist, registry |
| Branches  | 75%       | External handlers well-tested               |
| Functions | 60%       | Core message handlers covered               |
| Lines     | 35%       | Matches statement coverage                  |

Thresholds live in `apps/extension-wallet/vitest.config.ts` under `test.coverage.thresholds`.

## Running coverage

```bash
# From repo root
corepack pnpm --filter @ancore/extension-wallet test:coverage

# From apps/extension-wallet/
corepack pnpm test:coverage
```

## Raising thresholds

1. Run `test:coverage` and review the v8 report.
2. Identify untested handlers (0% or low coverage).
3. Write tests in colocated `__tests__/` directories.
4. Re-run `test:coverage` to confirm improvement.
5. Update thresholds in `vitest.config.ts` to match the new floor.
6. Commit both the tests and the threshold bump together.

**Rule of thumb:** only raise a threshold when the new value is already met by the current test suite. Never set a threshold above current coverage — that creates a failing gate that blocks all PRs.

## Why these specific paths?

`src/background/handlers/` is the security-critical surface for wallet operations: transaction signing, lock/unlock, health checks, and external dApp request handling. Regressions here can silently break signing or approval flows.
