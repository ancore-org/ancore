# Upgrade & Migration Runbook

Step-by-step operational guide for executing smart account contract upgrades
on testnet and mainnet.

## Prerequisites

- Access to the upgrade governor contract (owner key / multi-sig signers).
- `stellar-cli` installed and configured for the target network.
- New WASM artifact built and audited.
- Indexer and relayer URLs updated if the upgrade changes address formats.

## 1. Pre-upgrade validation

1. Build the new WASM:
   ```bash
   cd contracts/account
   cargo build --target wasm32-unknown-unknown --release
   ```
2. Compute the WASM hash:
   ```bash
   stellar contract upload --wasm target/wasm32-unknown-unknown/release/ancore_account.wasm
   ```
3. Review the diff between current and new storage schemas. If new fields are added,
   write a `migrate(new_version)` function in the account contract.
4. Deploy the new WASM to a **fresh test account** and run the full test suite:
   ```bash
   cargo test -p ancore-account
   ```
5. Tag the release:
   ```bash
   git tag -a vX.Y.Z -m "Account contract vX.Y.Z"
   git push origin vX.Y.Z
   ```

## 2. Testnet upgrade procedure

### 2.1 Upload WASM

```bash
stellar contract upload \
  --source-account <owner-keypair> \
  --wasm contracts/account/target/wasm32-unknown-unknown/release/ancore_account.wasm \
  --network testnet
```

Record the returned `wasm_hash`.

### 2.2 Propose upgrade via governor

```bash
stellar contract invoke \
  --source-account <owner-keypair> \
  --id <GOVERNOR_CONTRACT_ID> \
  -- function propose_upgrade \
  --args <wasm_hash> \
  --network testnet
```

Record the `proposal_id` and `execute_after` timestamp.

### 2.3 Wait for timelock

The default timelock is configurable; ensure the community review window passes.

### 2.4 Execute upgrade

```bash
stellar contract invoke \
  --source-account <any-signer> \
  --id <GOVERNOR_CONTRACT_ID> \
  -- function execute_upgrade \
  --args <proposal_id> \
  --network testnet
```

### 2.5 Verify

```bash
stellar contract invoke \
  --id <ACCOUNT_CONTRACT_ID> \
  -- function get_version \
  --network testnet
```

The version should increment.

## 3. Mainnet upgrade procedure

Repeat the testnet steps on mainnet, with the following additions:

1. **Multi-sig approval**: if the governor owner is a multi-sig, collect the required
   signatures before submitting `propose_upgrade`.
2. **Emergency override**: if a critical vulnerability is discovered during the timelock,
   follow the override policy in `docs/release/runbook.md` (minimum 2 core-team members + 1
   security-team member).
3. **Rollback plan**: have the previous WASM hash ready. If the upgrade fails or breaks
   compatibility, propose and execute a rollback upgrade.

## 4. Post-upgrade checklist

- [ ] Confirm contract version bumped on all target accounts.
- [ ] Confirm indexer recognizes the new contract version.
- [ ] Update SDK version constraints (if breaking changes).
- [ ] Announce upgrade in community channels.
- [ ] Monitor relayer and indexer health for 24 hours.

## 5. Emergency patch procedure

If a critical bug is found post-upgrade:

1. Prepare a patched WASM with a new version bump.
2. Propose the patch WASM hash via the governor (timelock applies).
3. If immediate action is required, invoke the override policy documented in
   `docs/release/runbook.md`.
4. After execution, verify the patch and monitor logs.

## 6. Storage migration guidelines

When a storage schema change is required:

1. Add a `migrate(new_version)` function to the account contract.
2. Call it **after** `upgrade(new_wasm_hash)` in the same transaction if possible.
3. The migration should be idempotent and backward-compatible.
4. Test migration on a copy of mainnet state in a sandbox before executing on mainnet.