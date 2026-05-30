## Summary

This PR resolves four independently implementable issues across relayer tests, indexer persistence, extension security, and the Stellar SDK.

- Adds missing `/relay/validate` auth integration coverage with supertest
- Replaces the in-memory ingest checkpoint stub with a durable Postgres-backed repository
- Throttles failed wallet unlock attempts in the extension service worker using session-scoped exponential backoff
- Introduces a multi-network `createStellarClient` factory with `futurenet` support

## Purpose / Motivation

Relayer validation lacked parity with execute-route auth testing, ingest cursors were lost on restart, the extension allowed unlimited password guessing, and Stellar client creation required manual network configuration. These changes close those gaps while keeping each fix scoped to its own module.

## Changes Made

### #654 — Relayer integration tests
- Extended `relay.test.ts` with a missing-auth `401` case for `POST /relay/validate`
- Existing invalid-body `400` coverage and CI relayer test job remain unchanged

### #670 — Postgres checkpoint repository
- Added `CheckpointStore` trait with `PostgresCheckpointStore` and async `MemoryCheckpointStore`
- Genericized `IngestWorker` to accept any checkpoint store implementation
- Wired checkpoint loading into indexer startup in `main.rs`
- Added ignored Postgres integration tests and documented `ingest_checkpoints` schema in README

### #678 — Unlock rate limiting
- Added `unlock-rate-limit.ts` with session-scoped failure tracking and exponential backoff
- Updated `UNLOCK_WALLET` handler to return `retryAfterMs` and a user-visible `message` during lockout
- Added fake-timer unit tests for rate-limit logic and service-worker behavior

### #681 — Stellar client factory
- Added `futurenet` to shared `Network` type and Stellar network config
- Exported `createStellarClient(network)` and `NetworkId` from `@ancore/stellar`
- Invalid networks now throw `NetworkError` at construction time

## How to Test

### Relayer (#654)
```bash
cd services/relayer
pnpm test tests/integration/relay.test.ts
```
Expected: validate-route tests pass, including `401 when Authorization header is missing`.

### Indexer (#670)
```bash
cd services/indexer
cargo test --lib
# Optional with Postgres:
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ancore_test cargo test postgres_checkpoint -- --ignored
```
Expected: unit tests pass; ignored integration tests persist and reload checkpoints across restart.

### Extension wallet (#678)
```bash
cd apps/extension-wallet
pnpm test src/background/__tests__/unlock-rate-limit.test.ts
pnpm test src/background/__tests__/service-worker.test.ts
```
Expected: lockout after repeated failures, success resets counter, expired lockout allows retry.

### Stellar SDK (#681)
```bash
cd packages/stellar
pnpm test src/__tests__/client.test.ts
```
Expected: factory tests pass for testnet/mainnet/futurenet; invalid network throws.

## Breaking Changes

None.

## Related Issues

Closes ancore-org/ancore#654
Closes ancore-org/ancore#670
Closes ancore-org/ancore#678
Closes ancore-org/ancore#681

## Checklist

- [x] Code builds successfully
- [x] Tests added/updated
- [x] No console errors
- [x] Documentation updated (if needed)
