# Contract Methods

> Canonical reference for all `contracts/account` entrypoints.  
> Machine-readable spec: [`api-reference.yaml`](./api-reference.yaml)  
> Last updated: 2026-04-24 · Issue #287

---

## Overview

The Ancore account contract (`contracts/account/src/lib.rs`) is a Soroban smart
contract that implements account abstraction on Stellar. Every user account is a
deployed instance of this contract.

**Storage model**

| Key | Storage type | Description |
|-----|-------------|-------------|
| `Owner` | Instance | Owner `Address` |
| `Nonce` | Instance | Replay-protection counter (`u64`) |
| `Version` | Instance | Contract version (`u32`) |
| `SessionKey(BytesN<32>)` | Persistent | Per-key `SessionKey` struct |

**Instance TTL** is bumped to 30 days on every write. Persistent session-key
entries are bumped proportionally to their `expires_at` value.

---

## Error codes

| Code | Name | Description |
|------|------|-------------|
| 1 | `AlreadyInitialized` | `initialize()` called on an already-initialized contract |
| 2 | `NotInitialized` | Any call before `initialize()` |
| 3 | `Unauthorized` | `require_auth()` failed (caller is not the owner) |
| 4 | `InvalidNonce` | `expected_nonce` does not match the stored nonce |
| 5 | `SessionKeyNotFound` | No session key found for the given public key |
| 6 | `SessionKeyExpired` | `ledger.timestamp() >= session_key.expires_at` |
| 7 | `InsufficientPermission` | Session key lacks `PERMISSION_EXECUTE` (bit 1) |
| 8 | `InvalidVersion` | `new_version <= current_version` in `migrate()` |
| 9 | `InvalidSignature` | Signature or payload missing, or payload mismatch |
| 10 | `InvalidWasmHash` | All-zero WASM hash passed to `upgrade()` |
| 11 | `InvalidExpiration` | `expires_at == 0` in `add_session_key()` |

---

## Session permissions

Permission bits are stored as `Vec<u32>` on each session key.

| Value | Constant | Description |
|-------|----------|-------------|
| `0` | `SEND_PAYMENT` | Authorize payment operations |
| `1` | `MANAGE_DATA` | Authorize manage-data operations |
| `2` | `INVOKE_CONTRACT` | Authorize arbitrary contract invocations |

> **Important:** `execute()` requires the session key to contain the internal
> `PERMISSION_EXECUTE` constant (`1`). This is a separate contract constant —
> **not** the same as `SessionPermission.MANAGE_DATA` (which also has value `1`
> in the TypeScript enum). The contract checks `session.permissions.contains(1)`.
> Always include `1` in the permissions array for session keys that need to call
> `execute()`, regardless of what other permissions are set.

---

## Entrypoints

### `initialize`

Initialize the account with an owner. Call once after deployment.

```rust
pub fn initialize(env: Env, owner: Address) -> Result<(), ContractError>
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `owner` | `Address` | ✓ | Stellar address that will own this account |

**Returns** `void`

**Errors** `AlreadyInitialized (1)`

**State changes**
- Writes `Owner`, `Nonce = 0`, `Version = 1` to instance storage
- Extends instance TTL

**Event** `initialized` → data: `(owner: Address)`

---

### `get_owner`

Return the owner address.

```rust
pub fn get_owner(env: Env) -> Result<Address, ContractError>
```

**Returns** `Address`  
**Errors** `NotInitialized (2)`

---

### `get_nonce`

Return the current replay-protection nonce.

```rust
pub fn get_nonce(env: Env) -> Result<u64, ContractError>
```

**Returns** `u64` (0 if nonce key is absent)  
**Errors** none

---

### `get_version`

Return the current contract version.

```rust
pub fn get_version(env: Env) -> u32
```

**Returns** `u32` (0 if version key is absent)

---

### `execute`

Execute a cross-contract call with replay protection. Supports two auth paths:

- **Owner path** — `session_pub_key` is `None`; `owner.require_auth()` is called.
- **Session-key path** — `session_pub_key` is `Some(key)`; the provided Ed25519
  signature is verified against the canonical payload.

```rust
pub fn execute(
    env: Env,
    _caller: CallerIdentity,
    to: Address,
    function: Symbol,
    args: Vec<Val>,
    expected_nonce: u64,
    session_pub_key: Option<BytesN<32>>,
    signature: Option<BytesN<64>>,
    signature_payload: Option<Bytes>,
) -> Result<Val, ContractError>
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `_caller` | `CallerIdentity` | ✓ | `Owner` or `SessionKey(BytesN<32>)` |
| `to` | `Address` | ✓ | Target contract address |
| `function` | `Symbol` | ✓ | Function name on the target contract |
| `args` | `Vec<Val>` | ✓ | Arguments for the target function |
| `expected_nonce` | `u64` | ✓ | Must equal current nonce |
| `session_pub_key` | `Option<BytesN<32>>` | — | Session key (session-key path) |
| `signature` | `Option<BytesN<64>>` | — | Ed25519 signature (session-key path) |
| `signature_payload` | `Option<Bytes>` | — | Signed payload (session-key path) |

**Signature payload format** (session-key path)

```
XDR(to) ++ XDR(function) ++ XDR(args) ++ XDR(nonce)
```

The contract recomputes this payload and rejects any mismatch, preventing
partial replay attacks.

**Returns** `Val` — return value from the invoked function

**Errors**

| Code | Name | Condition |
|------|------|-----------|
| 2 | `NotInitialized` | Contract not initialized |
| 3 | `Unauthorized` | Owner auth failed |
| 4 | `InvalidNonce` | Nonce mismatch |
| 5 | `SessionKeyNotFound` | Unknown session key |
| 6 | `SessionKeyExpired` | Key past `expires_at` |
| 7 | `InsufficientPermission` | Key lacks `PERMISSION_EXECUTE` |
| 9 | `InvalidSignature` | Missing or mismatched signature/payload |

**State changes**
- Increments `Nonce` by 1 **before** the cross-contract call
- Extends instance TTL

**Event** `executed` → data: `(to: Address, function: Symbol, nonce: u64)`

---

### `add_session_key`

Register a session key. Owner authorization required.

```rust
pub fn add_session_key(
    env: Env,
    public_key: BytesN<32>,
    expires_at: u64,
    permissions: Vec<u32>,
) -> Result<(), ContractError>
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_key` | `BytesN<32>` | ✓ | Ed25519 public key |
| `expires_at` | `u64` | ✓ | Unix timestamp (seconds); must be > 0 |
| `permissions` | `Vec<u32>` | ✓ | Permission bits |

**Returns** `void`

**Errors**

| Code | Name | Condition |
|------|------|-----------|
| 11 | `InvalidExpiration` | `expires_at == 0` — checked **before** `require_auth()` |
| 2 | `NotInitialized` | Contract not initialized (checked during `get_owner`) |
| 3 | `Unauthorized` | Caller is not the owner |

> `InvalidExpiration` fires before auth. A caller without owner auth still gets
> `InvalidExpiration` when `expires_at == 0`.

**State changes**
- Writes `SessionKey(public_key)` to persistent storage
- Extends session key TTL proportional to `expires_at`
- Extends instance TTL (30-day bump)

**Event** `session_key_added` → data: `(public_key: BytesN<32>, expires_at: u64)`

---

### `revoke_session_key`

Remove a session key immediately. Owner authorization required.

```rust
pub fn revoke_session_key(env: Env, public_key: BytesN<32>) -> Result<(), ContractError>
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `public_key` | `BytesN<32>` | ✓ | Key to revoke |

**Returns** `void`

**Errors** `NotInitialized (2)`, `Unauthorized (3)`

**State changes**
- Removes `SessionKey(public_key)` from persistent storage
- Extends instance TTL

**Event** `session_key_revoked` → data: `(public_key: BytesN<32>)`

---

### `get_session_key`

Return the `SessionKey` struct for a given public key, or `None`.

```rust
pub fn get_session_key(env: Env, public_key: BytesN<32>) -> Option<SessionKey>
```

**Returns** `Option<SessionKey>`

---

### `has_session_key`

Return `true` if a session key exists in storage (regardless of expiry).

```rust
pub fn has_session_key(env: Env, public_key: BytesN<32>) -> bool
```

**Returns** `bool`

---

### `is_session_key_active`

Return `true` if a session key exists **and** has not expired.

```rust
pub fn is_session_key_active(env: Env, public_key: BytesN<32>) -> bool
```

**Returns** `bool`

---

### `refresh_session_key_ttl`

Extend the Soroban storage TTL of an existing session key so it is not evicted
before its logical `expires_at`. Does **not** change `expires_at`.

```rust
pub fn refresh_session_key_ttl(env: Env, public_key: BytesN<32>) -> Result<(), ContractError>
```

**Returns** `void`

**Errors** `SessionKeyNotFound (5)`

**State changes**
- Extends persistent TTL for `SessionKey(public_key)`
- Extends instance TTL

**Event** `session_key_ttl_refreshed` → data: `(public_key: BytesN<32>, expires_at: u64)`

---

### `upgrade`

Replace the contract WASM. Owner authorization required.

```rust
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError>
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `new_wasm_hash` | `BytesN<32>` | ✓ | Hash of the new WASM; must not be all-zero |

**Returns** `void`

**Errors** `NotInitialized (2)`, `Unauthorized (3)`, `InvalidWasmHash (10)`

**State changes**
- Increments `Version` by 1
- Calls `env.deployer().update_current_contract_wasm()`
- Extends instance TTL

**Event** `upgraded` → data: `(new_wasm_hash: BytesN<32>)`

---

### `migrate`

Update the stored version number. Version must be strictly increasing. Owner
authorization required.

```rust
pub fn migrate(env: Env, new_version: u32) -> Result<(), ContractError>
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `new_version` | `u32` | ✓ | Must be > current version |

**Returns** `void`

**Errors** `NotInitialized (2)`, `Unauthorized (3)`, `InvalidVersion (8)`

**State changes**
- Writes `Version → new_version`
- Extends instance TTL

**Event** `migrated` → data: `(old_version: u32, new_version: u32)`

---

## Events reference

| Topic | Data | Emitted by |
|-------|------|-----------|
| `initialized` | `(owner: Address)` | `initialize` |
| `executed` | `(to: Address, function: Symbol, nonce: u64)` | `execute` |
| `session_key_added` | `(public_key: BytesN<32>, expires_at: u64)` | `add_session_key` |
| `session_key_revoked` | `(public_key: BytesN<32>)` | `revoke_session_key` |
| `session_key_ttl_refreshed` | `(public_key: BytesN<32>, expires_at: u64)` | `refresh_session_key_ttl` |
| `upgraded` | `(new_wasm_hash: BytesN<32>)` | `upgrade` |
| `migrated` | `(old_version: u32, new_version: u32)` | `migrate` |
