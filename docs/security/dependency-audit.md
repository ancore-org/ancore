# Dependency audit gate

Pull requests run a pnpm audit gate for high and critical advisories. The preferred fix is to
upgrade the affected dependency and refresh `pnpm-lock.yaml` with `pnpm install --lockfile-only`.

## Local triage

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level=high
node scripts/check-audit-allowlist.js
```

## Allowlist process

Use `.pnpm-audit-allowlist.json` only for false positives or temporary exceptions where an immediate
upgrade is not available. Every entry must include:

- the advisory id (`id`), matching either the numeric pnpm advisory id or GHSA id;
- a GitHub issue URL in `https://github.com/ancore-org/ancore/issues/<number>` format;
- a short justification;
- an ISO `expires` date so exceptions are revisited.

Expired, undocumented, or issue-less entries fail CI before the audit result is considered.
