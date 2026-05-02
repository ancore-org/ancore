# Coverage Gates for Critical Security & Transaction Modules

## Overview

This document defines module-level test coverage thresholds for Ancore's security-critical and transaction paths. These gates are enforced in CI to prevent regressions in high-impact code areas where bugs are most expensive.

**Status**: ✅ Active enforcement starting with MVP release  
**Last Updated**: April 2026  
**Enforcement**: Blocking CI check - PRs must meet all thresholds to merge

---

## Why Coverage Gates Matter

MVP risk reduction requires enforcing coverage where regressions are most expensive:

- **Account Authentication & Authorization**: Bypasses enable unauthorized access
- **Session Key Execution**: Misuse enables token theft or fund transfers
- **Transaction Signing**: Malformed signatures cause fund loss
- **Lock/Multi-sig Logic**: Broken enforcement leads to account compromise
- **Key Management**: Weak key derivation or rotation enables full compromise

Enforcing >90% branch coverage on these paths ensures we catch edge cases that unit tests typically miss.

---

## Coverage Thresholds by Module

### 1. Core SDK (`packages/core-sdk`)

Critical execute and session paths for smart wallet transactions.

| Path | Branch | Functions | Lines | Statements | Rationale |
|------|--------|-----------|-------|-----------|-----------|
| `execute-with-session-key.ts` | **95%** | **95%** | **95%** | **95%** | Validates session key before spending - **HIGHEST CRITICALITY** |
| `session/**/*.ts` | **90%** | **95%** | **90%** | **90%** | Session key add/revoke/validation logic |
| `wallet/**/*.ts` | **85%** | **90%** | **85%** | **85%** | Account balance, asset management |
| **Global** | **75%** | **90%** | **85%** | **85%** | All other code in module |

**Previously**: Excluded `execute-with-session-key.ts` from tracking ❌  
**Now**: Full coverage enforcement ✅

---

### 2. Account Abstraction (`packages/account-abstraction`)

Authorization, lock, and transaction execution contract integration.

| Path | Branch | Functions | Lines | Statements | Rationale |
|------|--------|-----------|-------|-----------|-----------|
| `execute.ts` | **95%** | **95%** | **95%** | **95%** | XDR encoding + nonce validation for spending - **HIGHEST CRITICALITY** |
| `auth/**/*.ts` | **90%** | **95%** | **90%** | **90%** | Permission/authorization validation |
| `lock/**/*.ts` | **90%** | **95%** | **90%** | **90%** | Multi-sig and lock mechanism enforcement |
| **Global** | **75%** | **90%** | **85%** | **85%** | All other code in module |

**Previously**: Only 50% branch coverage (lowest in codebase) ❌  
**Now**: 75% global + 95% on auth/lock/execute ✅

---

### 3. Crypto (`packages/crypto`)

Cryptographic primitives - signing, encryption, and key management.

| Path | Branch | Functions | Lines | Statements | Rationale |
|------|--------|-----------|-------|-----------|-----------|
| `keys.ts` | **95%** | **95%** | **95%** | **95%** | Key derivation, rotation, management - **HIGHEST CRITICALITY** |
| `signing/**/*.ts` | **95%** | **95%** | **95%** | **95%** | Signature generation/verification |
| `encryption/**/*.ts` | **90%** | **95%** | **90%** | **90%** | Seed encryption, data encryption |
| **Global** | **85%** | **90%** | **88%** | **88%** | All other cryptographic code |

**Previously**: Excluded `keys.ts`, `encoding.ts`, `hashing.ts` ❌  
**Now**: Full coverage on all critical paths ✅

---

### 4. Stellar (`packages/stellar`)

Network client and retry logic for Stellar operations.

| Path | Branch | Functions | Lines | Statements | Rationale |
|------|--------|-----------|-------|-----------|-----------|
| `client/**/*.ts` | **85%** | **90%** | **85%** | **85%** | Network request/retry logic - prevents broken connections |
| **Global** | **60%** | **75%** | **70%** | **70%** | All other utility code |

**Previously**: 30% branch coverage (lowest overall) ❌  
**Now**: 60% global + 85% on critical client code ✅

---

## Enforcement & CI Integration

### How It Works

1. **Local Development**: Run tests with `pnpm test` - Jest will fail if thresholds not met
2. **Pull Requests**: CI checks via `pnpm run coverage-gate` - **blocks merge if failed**
3. **Coverage Report**: GitHub Actions uploads reports and generates summary in PR

### CI Workflow

```yaml
# In .github/workflows/ci.yml
- name: Run tests
  run: pnpm test

- name: Check coverage gates  ← BLOCKS IF FAILED
  run: node scripts/coverage-gate.js

- name: Upload coverage reports
  uses: actions/upload-artifact@v4
```

**Exit Behavior**:
- ✅ All gates passed → CI succeeds
- ❌ Any gate failed → CI fails, PR cannot merge

---

## Module-Specific Testing Guidance

### Core SDK: execute-with-session-key.ts

**What to test** (95% branch coverage required):
- ✅ Valid session key signature verification
- ✅ Expired session key rejection
- ✅ Invalid nonce handling
- ✅ Permission scope validation
- ✅ Transaction amount validation
- ✅ Recovery account authorization checks
- ✅ All error branches (7+ cases)

**Test Location**: `packages/core-sdk/src/__tests__/execute-with-session-key.test.ts`

**Example**:
```typescript
describe('execute-with-session-key', () => {
  it('should reject expired session keys', () => {
    const expiredKey = createSessionKey({ expiresAt: Date.now() - 1000 });
    expect(() => executeWithSessionKey(expiredKey, tx))
      .toThrow('Session key expired');
  });

  it('should validate nonce sequence', () => {
    // Test nonce=0, nonce=1, nonce=5 (gap), out-of-order, etc.
  });
});
```

### Account Abstraction: execute.ts

**What to test** (95% branch coverage required):
- ✅ XDR transaction encoding correctness
- ✅ Nonce validation (sequence, duplicates)
- ✅ Permission scope enforcement
- ✅ Authorization rejection cases
- ✅ Malformed input handling
- ✅ All contract invocation paths

**Test Location**: `packages/account-abstraction/src/__tests__/execute.test.ts`

### Crypto: keys.ts

**What to test** (95% branch coverage required):
- ✅ Key derivation from seed (bip32/44 paths)
- ✅ Key rotation scenarios
- ✅ Invalid key rejection
- ✅ Serialization/deserialization roundtrip
- ✅ All error cases

**Property-Based Testing**: Leverage `fast-check` for key derivation:
```typescript
import fc from 'fast-check';

it('should derive consistent keys from seed', () => {
  fc.assert(
    fc.property(fc.string(), (seed) => {
      const key1 = deriveKey(seed, 0);
      const key2 = deriveKey(seed, 0);
      expect(key1).toEqual(key2);
    })
  );
});
```

### Stellar: client/\*.ts

**What to test** (85% branch coverage required):
- ✅ Network request success
- ✅ Retry with backoff (immediate, delayed, max retries)
- ✅ Timeout handling
- ✅ Connection pool management
- ✅ Rate limit handling

---

## Exception Process

Coverage gates can be **waived with proper justification**, but only for:

1. **Transient Code**: Code being refactored or deprecated
2. **Infeasible Coverage**: Code that cannot be unit tested (e.g., hardware I/O)
3. **Unreachable Branches**: Dead code paths that can't execute in practice

### How to Request an Exception

1. **Document**: Add a comment in the test file explaining why coverage cannot be achieved
   ```typescript
   // COVERAGE EXCEPTION: This branch requires live Stellar network
   // Marked for removal in v2.0 when moved to integration tests
   ```

2. **Update Jest Config**: Add to `collectCoverageFrom` exclusions with rationale in comment
   ```javascript
   collectCoverageFrom: [
     'src/**/*.ts',
     // EXCEPTION: Live network integration - covered in integration tests
     '!src/network-io.ts',
   ]
   ```

3. **PR Notes**: In PR description, link to the exception and explain why it's justified
   ```markdown
   ## Coverage Exceptions
   - `packages/stellar/src/network-io.ts`: Requires live Stellar testnet (integration only)
   - Mitigation: Covered by E2E smoke tests
   ```

4. **Approval**: Requires 👁️‍🗨️ review from security team

---

## Troubleshooting

### "Coverage threshold for \`branches\` of 90% not met (87.5% actual)"

**Root Causes**:
1. **Unexercised conditional**: `if (config.debug) { log() }` - add test case
2. **Error path not tested**: Add error scenario test
3. **Loop condition**: Test with 0, 1, and N iterations

**Fix**:
```typescript
// BEFORE: Missing error path
try {
  return validate(input);  // ✓ covered
} catch (e) {
  logger.error(e);        // ✗ not covered - add test
}

// AFTER: Test error case
it('should handle validation error', () => {
  expect(() => validate(null)).toThrow();
});
```

### "Could not find a module for path \`./src/auth/perms.ts\`"

The coverage checker searched for coverage data but the file had no covered statements.

**Fix**: Ensure test files exist:
```bash
# Check if test file exists
ls packages/account-abstraction/src/__tests__/auth/perms.test.ts

# If not, create it:
echo 'describe("perms", () => { it("should..."); });' > \
  packages/account-abstraction/src/__tests__/auth/perms.test.ts
```

### "Coverage report uploaded but CI passed - why?"

Coverage failures only fail if gates are **explicitly configured in Jest config**. If you added a new critical file:

1. Add to Jest `coverageThreshold`
2. Create tests to meet threshold
3. Re-run `pnpm test`

---

## Related Documentation

- **Security Policy**: [SECURITY.md](../SECURITY.md)
- **Test Strategy**: [docs/testing/README.md](../docs/testing/README.md)
- **CI Workflow**: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Coverage Reporting**: [scripts/coverage-gate.js](../scripts/coverage-gate.js)

---

## Summary of Changes

| Module | Previous | New | Files Modified |
|--------|----------|-----|-----------------|
| core-sdk | 62% branch (execute excluded) | 75% global, 95% on execute | jest.config.cjs |
| account-abstraction | 50% branch | 75% global, 95% on auth/lock | jest.config.cjs |
| crypto | 80% branch (keys excluded) | 85% global, 95% on keys | jest.config.cjs |
| stellar | 30% branch | 60% global, 85% on client | jest.config.cjs |
| CI | No coverage reporting | Full CI integration | ci.yml, coverage-gate.js |

**Impact**: Regressions in critical security paths will be caught before merge ✅

---

**Questions?** Open an issue tagged `#coverage` or contact the security team.
