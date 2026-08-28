# Account Contract v0 to v1 Upgrade Guide

This guide details the procedure to upgrade the smart account contract from v0 to v1, migrating the storage schema to avoid deserialization panics.

## Storage Key Schema

- **v0**: `SessionKey` lacked policy scoping fields.
- **v1**: `SessionKey` includes additional fields for session key policy scoping.

## Migration Procedure

The upgrade requires updating the WASM hash and migrating existing storage in the same transaction to maintain state consistency.

1. **Upload new WASM**: Upload the compiled v1 WASM to the network and retrieve its hash.
2. **Safe Upgrade Sequence**: Execute a multi-operation transaction:
   - Call `upgrade(new_hash)` on the contract.
   - Call `migrate(0)` to read existing v0 `SessionKey`s, inject default values for new fields, and store them as v1 `SessionKey`s.

## Rollback Plan

If an emergency rollback is required, supply the original v0 WASM hash to a subsequent `upgrade()` call. Note that reverting storage from v1 back to v0 requires a separate downward migration function if structural rollback is strictly required, though v0 may simply ignore extra fields depending on the SDK version.

## SDK Version Compatibility

- **Ancore SDK <= v0.9.0**: Compatible with contract v0 only.
- **Ancore SDK >= v1.0.0**: Compatible with contract v1. Older SDKs will fail to serialize transactions for v1 contracts.
