## Summary

This PR resolves three independently implementable issues across UI Kit components, Core SDK documentation and runnable examples, and cross-package testing fixtures.

- **UI Kit Button Loading State (#630)**: Added `loading` prop, Loader2 spinner, `aria-busy` attribute, and click prevention to the UI Kit `Button` component, alongside exhaustive tests and stories.
- **Core SDK Documentation & CI Verification (#587)**: Expanded `packages/core-sdk/README.md` to accurately document all `AncoreClient` methods and standalone exports, added a fully runnable session key lifecycle example, and wrote a CI script to enforce documentation compliance.
- **Canonical Cross-Package Relay Payload Test (#687)**: Scaffolded a shared `@ancore/test-fixtures` package with a JSON payload schema, linked it to the workspace, and integrated cross-package unit tests in both `services/relayer` and `packages/account-abstraction` to assert structure alignment.

---

## Purpose / Motivation

- **#630**: Interactive elements should prevent double-submissions, visually reflect pending operations via animations, and remain fully accessible (`aria-busy`).
- **#587**: Prevent API drifts in `core-sdk` by explicitly documenting its modular exports and providing realistic developer-facing integration examples.
- **#687**: Establish type and contract alignment between relayer execution payloads and smart account-abstraction parsing via shared testing fixtures.

---

## Changes Made

### #630 — UI Kit Button Loading State

- Modified `packages/ui-kit/src/components/ui/button.tsx` to accept a `loading` prop.
- Added a spinning `Loader2` icon from `lucide-react` when loading is active, applied `aria-busy` for screen readers, and disabled event emission to prevent duplicate form submissions or actions.
- Added comprehensive unit tests in `packages/ui-kit/src/components/ui/button.test.tsx` verifying spinner rendering, disabled attribute application, and click event suppression.
- Added new stories (`Loading`, `DestructiveLoading`) in `packages/ui-kit/src/components/ui/button.stories.tsx` for manual UI verification.

### #587 — Core SDK Documentation & CI Verification

- Updated `packages/core-sdk/README.md` with accurate mappings of `AncoreClient` methods and all 100+ modular package exports (wallet helpers, payments, storage managers, etc.).
- Created a fully executable developer integration walkthrough in `packages/core-sdk/examples/01-session-key-lifecycle.ts` using `@stellar/stellar-sdk` and `@ancore/core-sdk`.
- Fixed a contract-derivation bug in `deriveContractId` that constructed invalid 58-character contract IDs, changing it to use `StrKey` encoding to produce valid 56-character Stellar/Soroban contract addresses.
- Created `scripts/verify-readme-exports.ts` to automatically scan `index.ts` exports and fail the build if any export is not fully cataloged in the README.

### #687 — Canonical Cross-Package Relay Payload Test

- Scaffolded `@ancore/test-fixtures` package in `packages/test-fixtures/` with a standard `relay-payload-v1.json` schema.
- Added the package to the root workspace and declared it as a dependency in both `packages/account-abstraction` and `services/relayer`.
- Added unit tests in `packages/account-abstraction/src/__tests__/relay-payload.test.ts` and `services/relayer/tests/unit/relay-payload.test.ts` importing the shared JSON fixture and validating schema parity.

---

## How to Test

### UI Kit Button (#630)

```bash
npx pnpm --filter @ancore/ui-kit test
```

Expected: All 146 tests pass successfully, including all loading-state assertions.

### Core SDK & Verification (#587)

```bash
# Run unit tests
npx pnpm --filter @ancore/core-sdk test

# Run runnable lifecycle example
npx tsx packages/core-sdk/examples/01-session-key-lifecycle.ts

# Run README compliance check
npx tsx scripts/verify-readme-exports.ts
```

Expected: All tests pass, lifecycle example completes successfully, and verify-readme-exports confirms 100% API coverage.

### Cross-Package Relay Payload (#687)

```bash
# Run account abstraction tests
npx pnpm --filter @ancore/account-abstraction test

# Run relayer tests
npx pnpm --filter @ancore/relayer test
```

Expected: All tests pass, ensuring complete canonical payload parity between relayer ingestion and core execution layers.

---

## Related Issues

- Closes ancore-org/ancore#630
- Closes ancore-org/ancore#587
- Closes ancore-org/ancore#687

---

## Checklist

- [x] Code builds successfully
- [x] Tests added/updated
- [x] No console errors
- [x] Documentation updated (if needed)
