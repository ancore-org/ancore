# Coverage Gates - Quick Reference

## TL;DR

**PRs must pass coverage gates to merge.** Critical security code requires 90-95% test coverage.

```bash
# Check if your tests pass coverage gates
pnpm test && node scripts/coverage-gate.js
```

If it fails → **Add tests** for the highlighted modules until gates pass.

---

## Critical Paths & Their Thresholds

### 🔴 Must Have 95% Branch Coverage
- **core-sdk**: `execute-with-session-key.ts` (session validation)
- **account-abstraction**: `execute.ts` (transaction execution)
- **crypto**: `keys.ts` (key management)
- **crypto**: `signing/**` (signature generation)

### 🟠 Must Have 90% Branch Coverage
- **core-sdk**: `session/**` (session key operations)
- **account-abstraction**: `auth/**` (authorization)
- **account-abstraction**: `lock/**` (lock mechanism)
- **crypto**: `encryption/**` (data encryption)

### 🟡 Must Have 85% or 75% Branch Coverage (varies by module)
- **core-sdk**: global 75%, wallet/** 85%
- **account-abstraction**: global 75%
- **crypto**: global 85%
- **stellar**: global 60%, client/** 85%

---

## Common Issues & Fixes

### Issue: "Coverage threshold for `branches` of 95% not met (93.5% actual)"

**Solution**: Add tests for the 1-2 missing branch cases
```typescript
// Find untested branches with IDE coverage highlighting
// or look for if/else/try/catch that doesn't have a test

it('should handle edge case X', () => {
  expect(() => fn(edgeCase)).toThrow(expected);
});
```

### Issue: "Cannot find module for path `./src/auth/perms.ts`"

**Solution**: Create missing test file
```bash
mkdir -p packages/account-abstraction/src/__tests__/auth
cat > packages/account-abstraction/src/__tests__/auth/perms.test.ts << 'EOF'
describe('perms', () => {
  it('should validate permissions', () => {
    // add tests
  });
});
EOF
```

### Issue: "Coverage gate check failed in CI but passed locally"

**Solution**: Ensure you're running full test suite
```bash
# Make sure you run ALL tests, not just one file
pnpm test        # ✅ Full suite
pnpm test -t abc # ❌ Only tests matching 'abc'
```

---

## When You Need An Exception

**Only for**:
- Code being deprecated/refactored
- Code that's impossible to unit test (hardware I/O)
- Dead code that can't execute

**How to get approved**:
1. Add comment in code: `// COVERAGE EXCEPTION: [reason]`
2. Update jest.config.cjs exclusions with comment explaining why
3. Note in PR description with link to security team approval

---

## Files to Know

| File | Purpose |
|------|---------|
| `packages/*/jest.config.cjs` | Defines coverage thresholds |
| `scripts/coverage-gate.js` | Validates gates in CI |
| `docs/coverage-gates.md` | Full documentation |
| `.github/workflows/ci.yml` | Runs gates on every PR |

---

## Module Ownership

| Module | Owner | Slack |
|--------|-------|-------|
| core-sdk | SDK team | #sdk |
| account-abstraction | Auth team | #auth |
| crypto | Security team | #security |
| stellar | Network team | #stellar |

Contact them if you need guidance on testing critical paths.

---

**Need help?** → Check [docs/coverage-gates.md](../docs/coverage-gates.md) for detailed guidance per module
