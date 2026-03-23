# Requirements Document

## Introduction

The `@ancore/crypto` package provides cryptographic utilities for the Ancore wallet. Currently the package is a stub — only `CRYPTO_VERSION` and `verifySignature` are exported. This feature wires together all cryptographic submodules (signing, hashing, key derivation, etc., implemented in separate issues #065–#072) and exposes a clean, stable public API surface from `packages/crypto/src/index.ts`. The scope here is integration and export correctness, not the internal logic of each submodule.

## Glossary

- **Package**: The `@ancore/crypto` npm package located at `packages/crypto`.
- **Index**: The file `packages/crypto/src/index.ts` — the single public entry point of the Package.
- **Submodule**: A TypeScript source file inside `packages/crypto/src/` that implements a cohesive group of cryptographic functions (e.g., `signing.ts`, `hashing.ts`, `keys.ts`).
- **Public_API**: The set of functions, types, and constants re-exported from the Index.
- **Consumer**: Any package or application that imports from `@ancore/crypto`.
- **Secret_Material**: Private keys, seed phrases, raw entropy, or any value that must not be logged or exposed outside its intended scope.
- **Smoke_Test**: A lightweight test that imports from the Index and asserts that exported symbols are callable and return expected types, without exercising full cryptographic correctness.
- **Build**: The TypeScript compilation and bundling step executed via `tsup`.

---

## Requirements

### Requirement 1: Public API Surface

**User Story:** As a Consumer, I want all cryptographic utilities to be importable from `@ancore/crypto`, so that I do not need to reference internal submodule paths.

#### Acceptance Criteria

1. THE Index SHALL re-export every public function and type from each Submodule present in `packages/crypto/src/`.
2. THE Index SHALL export `CRYPTO_VERSION` as a string constant.
3. WHEN a Consumer imports a symbol from `@ancore/crypto`, THE Package SHALL resolve that symbol without requiring the Consumer to reference any internal Submodule path.
4. THE Index SHALL NOT export any symbol that is not part of the intended Public_API (i.e., internal helpers remain unexported).

---

### Requirement 2: Build Integrity

**User Story:** As a developer, I want the package to compile cleanly, so that downstream packages can depend on `@ancore/crypto` without build failures.

#### Acceptance Criteria

1. WHEN the Build is executed, THE Package SHALL produce no TypeScript compiler errors.
2. WHEN the Build is executed, THE Package SHALL produce no missing-import or missing-export errors.
3. THE Package SHALL generate CommonJS (`dist/index.js`), ESM (`dist/index.mjs`), and TypeScript declaration (`dist/index.d.ts`) outputs.
4. IF a Submodule referenced in the Index does not exist on disk, THEN THE Build SHALL fail with a descriptive error identifying the missing Submodule.

---

### Requirement 3: Smoke Test

**User Story:** As a developer, I want a smoke test that verifies the wiring of exports, so that integration regressions are caught immediately.

#### Acceptance Criteria

1. THE Smoke_Test SHALL import each symbol exported from the Index and assert that the symbol is defined (not `undefined`).
2. THE Smoke_Test SHALL invoke at least one exported async function with valid inputs and assert that it resolves without throwing.
3. WHEN the Smoke_Test is executed, THE Package SHALL not log any output to `console.log`, `console.warn`, or `console.error`.
4. THE Smoke_Test SHALL pass within the existing Jest test suite without requiring additional test infrastructure.

---

### Requirement 4: No Secret Material Exposure

**User Story:** As a security reviewer, I want the package to never log or expose Secret Material, so that private keys and seeds cannot be leaked through observability tooling.

#### Acceptance Criteria

1. THE Package SHALL NOT call `console.log`, `console.warn`, `console.error`, or any equivalent logging function with Secret_Material as an argument.
2. IF an error occurs during a cryptographic operation, THEN THE Package SHALL return an error result or throw a typed error WITHOUT including Secret_Material in the error message.
3. THE Index SHALL NOT re-export any internal utility whose sole purpose is to handle or transform raw Secret_Material in an unprotected form.

---

### Requirement 5: Export Completeness Verification

**User Story:** As a developer, I want a way to verify that all intended exports are present after submodules are added, so that accidental omissions are caught during CI.

#### Acceptance Criteria

1. WHEN a new Submodule is added to `packages/crypto/src/`, THE Index SHALL be updated to include a re-export of that Submodule's public symbols.
2. THE Smoke_Test SHALL enumerate and assert the presence of each named export defined in the Public_API, so that a missing re-export causes a test failure.
3. FOR ALL symbols asserted in the Smoke_Test, importing then re-importing the same symbol from `@ancore/crypto` SHALL resolve to the same reference (idempotent module resolution).
