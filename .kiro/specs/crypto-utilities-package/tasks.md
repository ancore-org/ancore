# Implementation Plan: @ancore/crypto Package Integration

## Overview

Wire together all cryptographic submodules by updating `packages/crypto/src/index.ts` to re-export every public symbol, then add a smoke test that acts as a living manifest of the public API surface.

## Tasks

- [ ] 1. Install fast-check and update package configuration
  - Run `pnpm add -D fast-check --filter @ancore/crypto` to add the property-based testing library
  - Verify `jest.config.cjs` picks up `src/__tests__/*.test.ts` files (no changes expected)
  - _Requirements: 3.4_

- [ ] 2. Update `packages/crypto/src/index.ts` barrel export
  - [ ] 2.1 Replace the stub index with the full barrel export
    - Export `CRYPTO_VERSION` as a string constant
    - Add `export * from './signing'`, `export * from './hashing'`, `export * from './keys'`, `export * from './mnemonic'`, `export * from './encoding'`
    - Ensure no logic or internal helpers are exported — index is re-exports only
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]\* 2.2 Write property test for Property 1: All expected exports are defined
    - **Property 1: All expected exports are defined**
    - **Validates: Requirements 1.1, 1.3, 3.1, 5.2**
    - Use `fc.constantFrom(...EXPECTED_EXPORTS)` to assert each symbol is not `undefined` in the imported namespace
  - [ ]\* 2.3 Write property test for Property 2: Export set matches the public API exactly
    - **Property 2: Export set matches the public API exactly**
    - **Validates: Requirements 1.4, 4.3**
    - Assert that `Object.keys(CryptoAPI)` equals `EXPECTED_EXPORTS` — no extras, no missing

- [ ] 3. Create `packages/crypto/src/__tests__/smoke.test.ts`
  - [ ] 3.1 Implement the smoke test file with the EXPECTED_EXPORTS manifest
    - Import `* as CryptoAPI from '@ancore/crypto'`
    - Define `EXPECTED_EXPORTS` as a `const` array of all public symbol names
    - Assert each symbol in `EXPECTED_EXPORTS` is defined (not `undefined`)
    - Invoke at least one exported async function with valid inputs and assert it resolves without throwing
    - _Requirements: 3.1, 3.2, 3.4, 5.2_
  - [ ] 3.2 Add console spy assertions to the smoke test
    - Use `jest.spyOn` on `console.log`, `console.warn`, and `console.error` before each test
    - Assert none of the spies were called after invoking exported functions
    - _Requirements: 3.3, 4.1_
  - [ ]\* 3.3 Write property test for Property 3: No console output during normal operation
    - **Property 3: No console output during normal operation**
    - **Validates: Requirements 3.3, 4.1**
    - Use `fc.constantFrom` over callable exports; spy on console methods and assert zero calls per invocation
  - [ ]\* 3.4 Write property test for Property 4: Error messages do not contain secret material
    - **Property 4: Error messages do not contain secret material**
    - **Validates: Requirements 4.2**
    - Use `fc.uint8Array({ minLength: 32, maxLength: 32 })` as the secret value; call exported functions with invalid inputs alongside the secret and assert the error message does not include the secret bytes
  - [ ]\* 3.5 Write property test for Property 5: Module resolution is idempotent
    - **Property 5: Module resolution is idempotent**
    - **Validates: Requirements 5.3**
    - Use `fc.constantFrom(...EXPECTED_EXPORTS)` and assert `CryptoAPI[symbol] === CryptoAPI[symbol]` (same reference on repeated access)

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Verify build integrity
  - [ ] 5.1 Confirm `tsup` build produces all three output artifacts
    - Check that `dist/index.js` (CJS), `dist/index.mjs` (ESM), and `dist/index.d.ts` (declarations) are generated after build
    - Confirm no TypeScript compiler errors or missing-import errors
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 5.2 Verify missing-submodule build failure behavior
    - Confirm that if a submodule path referenced in `index.ts` does not exist, the build fails with a descriptive module-not-found error
    - _Requirements: 2.4_

- [ ] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per `fc.assert` call
- The smoke test doubles as the export completeness manifest (Requirement 5.2)
- Internal helpers must not appear in submodule public surfaces — the barrel `export *` will only pick up what each submodule explicitly exports
