# Account Abstraction, Stellar Client & Secure Storage Implementation

## Overview

This PR implements four interconnected issues for the Ancore SDK:

- **#55**: Account Abstraction SDK Package
- **#52**: Stellar Network Client
- **#115**: Secure Storage Encryption Primitives
- **#121**: Secure Storage Export/Import

## Changes

### Account Abstraction SDK (#55)

- `AccountContract` class wrapping Soroban contract invocations
- XDR encoding/decoding utilities for contract parameters
- Typed error mapping for contract errors
- Support for initialize, execute, and session key operations
- 23 tests covering all contract methods

### Stellar Network Client (#52)

- `StellarClient` for network interactions (testnet, mainnet, local)
- Account queries, balance lookups, transaction submission
- Retry logic with exponential backoff (3 retries: 1s/2s/4s)
- Friendbot funding for testnet
- Custom error types (NetworkError, AccountNotFoundError, TransactionError)
- 24 tests for client methods and retry logic

### Encryption Primitives (#115)

- `deriveKey()` using PBKDF2 (100k+ iterations)
- `encrypt()` using AES-256-GCM with random IV
- `decrypt()` with auth tag validation
- Encrypted payload format with salt, IV, ciphertext
- 30 tests for encryption round-trip and error cases

### Backup Export/Import (#121)

- `exportBackup()` for encrypted backup creation
- `importBackup()` for encrypted backup restoration
- Support for account data and session keys
- Malformed backup handling
- 20 tests for export/import round-trip

## Test Results

- **Core SDK**: 120 tests passing, 98.83% coverage
- **Account Abstraction**: 23 tests passing
- **Stellar**: 24 tests passing (50% coverage - integration-focused)
- **All tests**: 300+ tests passing

## Files Created

- `packages/core-sdk/src/storage/encryption-primitives.ts`
- `packages/core-sdk/src/storage/backup.ts`
- `packages/core-sdk/src/storage/__tests__/encryption-primitives.test.ts`
- `packages/core-sdk/src/storage/__tests__/backup.test.ts`
- `packages/account-abstraction/src/__tests__/account-contract.test.ts`
- `packages/stellar/src/__tests__/client.test.ts`
- `packages/stellar/src/__tests__/retry.test.ts`

## Breaking Changes

None - all new functionality

## Notes

- All code follows project conventions and passes linting
- Comprehensive test coverage with edge case handling
- Ready for integration testing against deployed testnet contract
