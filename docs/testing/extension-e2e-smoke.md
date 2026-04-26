# Extension E2E Smoke Suite

This suite is the minimum release-candidate confidence gate for the extension wallet.

## Coverage

- Onboarding: create wallet flow reaches `home`
- Lock/Unlock: locked wallet unlocks to `home`
- Send/Receive: core transfer screens are reachable
- Session Keys: unlocked access allowed, logged-out access blocked

## Determinism Guarantees

- Stable auth fixtures seeded directly into `localStorage` (`tests/fixtures/extension.ts`)
- Fixed clock per test via `freezeTime()` to avoid timing drift
- No remote dependencies required for smoke assertions
- Single tagged test target (`@smoke`) to keep suite scope explicit

## Local Runner

From repository root:

```bash
pnpm --filter @ancore/extension-wallet test:e2e:smoke
```

Debug mode:

```bash
pnpm --filter @ancore/extension-wallet test:e2e:smoke:debug
```

## Debugging Tips

- If selectors fail, inspect current route and assert URL first before UI expectations.
- Keep smoke assertions focused on user-critical outcomes, not full-page snapshots.
- Prefer fixture seeding over multi-step setup when reproducing a failure quickly.
- Use Playwright traces from debug mode to inspect exact action timing and DOM state.

## CI Integration

- Pull request and branch CI includes a required `Extension E2E Smoke` job.
- Release gate includes `[Gate 6] Extension E2E Smoke`.
- Any failure blocks release gate completion unless a manual override is explicitly used for other failing gates.
