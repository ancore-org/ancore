# Upgrade Governor Contract

> Timelocked on-chain governance for smart account WASM upgrades.

## Overview

The `UpgradeGovernor` contract implements a transparent, timelocked upgrade path for
Ancore account contracts. It separates _proposal_ from _execution_ so the community
and users have a predictable window to review changes before they take effect.

## Why this exists

- Eliminates redeploy-and-migrate pain for session-key and multi-sig evolution.
- Provides on-chain audit trail via events (`proposed`, `executed`, `cancelled`).
- Enforces a delay between proposal and execution, giving users time to inspect
  new WASM hashes and, if needed, move funds before an upgrade.

## Architecture

```
Owner ──► propose_upgrade(wasm_hash) ──► stores proposal
          waits for timelock delay
          ▼
execute_upgrade(proposal_id) ──► invokes target_account.upgrade(wasm_hash)
```

- **Single-owner model**: one `Address` controls proposals and cancellation.
  Multi-sig or threshold governance can be layered later by making the owner a
  multi-sig contract.
- **Timelock**: configurable at initialization; applies to new proposals.
- **Target account**: set at initialization; this is the account contract that
  `execute_upgrade` calls.

## Storage Schema

| Key              | Type       | Description                           |
| ---------------- | ---------- | ------------------------------------- |
| `Owner`          | `Address`  | Governance owner                      |
| `TargetAccount`  | `Address`  | Account contract to upgrade           |
| `TimelockDelay`  | `u64`      | Seconds before a proposal can execute |
| `NextProposalId` | `u32`      | Auto-incrementing proposal counter    |
| `Proposal(N)`    | `Proposal` | Proposal record                       |

```rust
pub struct Proposal {
    pub id: u32,
    pub wasm_hash: BytesN<32>,
    pub proposed_at: u64,
    pub execute_after: u64,
    pub executed: bool,
    pub cancelled: bool,
}
```

## Events

| Event              | Data                             | Purpose                             |
| ------------------ | -------------------------------- | ----------------------------------- |
| `proposed`         | `(id, wasm_hash, execute_after)` | New upgrade proposal created        |
| `executed`         | `(id, wasm_hash)`                | Upgrade executed on target          |
| `cancelled`        | `(id)`                           | Proposal cancelled before execution |
| `timelock_updated` | `(new_delay_seconds)`            | Timelock delay changed              |

## Lifecycle

1. **Initialize** — owner, target account, timelock delay.
2. **Propose** — owner submits a new WASM hash; receives proposal ID.
3. **Wait** — timelock elapses; community reviews.
4. **Execute** — anyone can call `execute_upgrade` once timelock passes.
5. **Cancel** — owner may cancel before execution.

## Integration with Account Contract

The target account must expose:

```rust
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError>;
pub fn get_version(env: Env) -> u32;
```

See `contracts/account/src/lib.rs` for the reference implementation.

## Security Considerations

- **Owner is privileged**: compromise of the owner key allows malicious upgrades.
  Use a multi-sig owner for mainnet.
- **Timelock is not a rollback**: once executed, the only recovery is a subsequent
  upgrade to a corrected WASM hash (or, if the contract supports it, a `migrate()`
  call that repairs storage).
- **Re-entrancy**: `execute_upgrade` writes proposal state before invoking the
  target contract. If the target re-enters, the `executed` flag prevents double
  execution.

## Testing

Unit tests cover initialization, proposal creation, cancellation, timelock
boundary, and zero-hash rejection.

```bash
cd contracts && cargo test -p upgrade
```

Integration tests simulate the full propose → wait → execute flow.

```bash
cd contracts && cargo test -p upgrade --test integration
```

## Factory Helper

`contracts/upgrade/src/factory.rs` documents (but does not yet implement) the
expected deployment helpers:

- `deploy_new_account(owner, wasm_hash)` — deploy a fresh account contract.
- `upgrade_existing_account(governor, proposal_id)` — execute an upgrade through
  an existing governor.

These are stubs pending the final Soroban deployer API surface.

## Operational Runbooks

See `docs/release/` for:

- Emergency patch procedures.
- Testnet → mainnet migration checklists.
- Override policy for release gate failures.
