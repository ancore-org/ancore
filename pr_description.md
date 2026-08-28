# Fix: Implement `get_by_account` for Invoices

## Problem

The `get_by_account` function in `contracts/invoice/src/lib.rs` was previously returning an empty vector as a stub. This was misleading for off-chain or indexer queries attempting to fetch an account's invoices. Additionally, `cargo test` in the `invoice` contract was failing on the `main` branch due to type errors in recent SDK upgrades (e.g. `Option<BytesN<32>>` causing `ScVal` `TryFrom` bound errors, and incorrect tuple hashing with `sha256`).

## Solution

1. **Restore and Implement `get_by_account`**: Implemented `get_by_account` which combines the `list_by_creator` and `list_by_recipient` indexes to return a deduplicated list of resolved `Invoice` structs.
2. **Fix `main` branch compilation in tests**:
   - Fixed `env.crypto().sha256` hashing logic by properly serializing tuple fields to XDR format via `soroban_sdk::xdr::ToXdr`.
   - Fixed `Option<BytesN<32>>` conversion errors by changing `payment_tx` to `Option<soroban_sdk::Bytes>` inside the `Invoice` struct, which restores compilation under `testutils`.
   - Fixed outdated `&i128` reference requirements and `.unwrap()` panics in the existing tests.
3. **Add Tests**: Added `test_get_by_account` unit test to verify that the endpoint correctly fetches and deduplicates creator and recipient invoices for a given account.

closes #1113
