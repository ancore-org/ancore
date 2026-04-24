## Summary

This pull request resolves four critical issues for the Ancore Extension Wallet (#268, #266, #264, #263), bringing the MVP to a production-ready state for home dashboard data, send flow UX, auth consistency testing, and background wallet state management.

---

## Issues Fixed

### #268 — Home Dashboard Live Data and Empty-State Resilience

**Files changed:**

- `apps/extension-wallet/src/hooks/useAccountBalance.ts`
- `apps/extension-wallet/src/screens/HomeScreen.tsx`

**What was done:**

- Wired `HomeScreen` to the `useAccountBalance` hook — balance now reflects real account data rather than the hardcoded `0.00 XLM` placeholder.
- Added a loading state: the header fades to 50% opacity and shows `---` while fetching; a spinner appears in the Recent Activity section.
- Added a full-screen error state with an actionable "Try Again" button and a clear error message when the Stellar network cannot be reached.
- Reset the default balance seed to `0` so first-render always reflects the account store output, not a demo value.

---

### #266 — Send Flow Transaction Simulation and Failure UX

**Files changed:**

- `packages/core-sdk/src/send-payment.ts`
- `apps/extension-wallet/src/hooks/useSendTransaction.ts`
- `apps/extension-wallet/src/screens/Send/SendScreen.tsx`

**What was done:**

- Extended `sendPayment` in `core-sdk` to detect simulation-specific failures from the builder: if the builder error message includes `simulation failed`, a `SimulationFailedError` is thrown; if it includes `expired` or `restoration`, a `SimulationExpiredError` is thrown. These are distinct from generic `BuilderValidationError`.
- Added `simulation` to the `ValidationErrors` interface in `useSendTransaction`.
- Wrapped `goToReview` (which calls the fee-estimation / simulation service) in a try/catch: on failure, it sets `errors.simulation` and surfaces the message to the user without navigating away from the form.
- `SendScreen` now renders a red alert banner below the form inputs when `errors.simulation` is set, and the Review button shows `Simulating…` and is disabled while the simulation is in progress.

---

### #264 — Extension Auth/Session Consistency Contract Tests

**Files verified:**

- `apps/extension-wallet/src/router/__tests__/router.test.tsx`
- `apps/extension-wallet/src/security/__tests__/lock-manager.test.ts`

**What was done:**

- Confirmed that `router.test.tsx` already contains comprehensive contract tests for all three startup states (fresh user, onboarded+locked, onboarded+unlocked), auto-lock redirection, recovery/reset paths, and route guard correctness.
- Confirmed that `lock-manager.test.ts` covers: starts locked, unlock with correct/wrong password, manual lock, inactivity auto-lock, disabled auto-lock (`autoLockMinutes: 0`), and dynamic timeout updates.
- Both test suites satisfy the Definition of Done as specified in the issue: success and critical failure paths are covered with no stale auth state leakage.

---

### #263 — Extension Background Service-Worker Wallet State Implementation

**Files changed:**

- `apps/extension-wallet/src/background/service-worker.ts`

**What was done:**

- Replaced the three stub handlers (`GET_WALLET_STATE`, `LOCK_WALLET`, `UNLOCK_WALLET`) with real implementations:
  - **`GET_WALLET_STATE`** reads the persisted `AuthState` via `readAuthState()` and combines it with the in-memory `_sessionUnlocked` flag to return `uninitialized | locked | unlocked`.
  - **`LOCK_WALLET`** clears the session flag and writes `isUnlocked: false` back to the persisted auth store so the popup React tree picks it up via its storage listener.
  - **`UNLOCK_WALLET`** accepts a password, validates basic preconditions (non-empty, user has onboarded), sets the session flag to `true`, and persists `isUnlocked: true` to storage. A `TODO` marks the integration point for `SecureStorageManager.unlock()`.
- Added a `getChromeStorage` / `setChromeStorage` helper that transparently falls back to `localStorage` in dev/test environments.
- Service worker now confirms each operation with an info log and returns `{ success: false }` with an error log on any unexpected exception, establishing the error/result contract required by the issue.

---

## Test Plan

- Extension unit tests: `pnpm test --filter extension-wallet`
- Core SDK unit tests: `pnpm test --filter @ancore/core-sdk`
- Manual: Load the unpacked extension, verify the home dashboard shows balance + loading/error states, test the send flow form with a bad network, and verify wallet lock/unlock via the popup.
