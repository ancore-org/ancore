# Ancore Account Contract

Core smart account contract implementing account abstraction for Stellar/Soroban.

## Overview

The Ancore Account contract is the foundation of the Ancore smart wallet system. It provides:

- **Programmable Validation**: Custom signature validation logic
- **Session Keys**: Time-limited signing permissions
- **Upgradeability**: Safe upgrade mechanisms
- **Batching**: Execute multiple operations atomically

## Security

⚠️ **CRITICAL**: This contract handles user funds and must be thoroughly audited.

### Security Properties

1. **Owner Control**: Only the owner can execute transactions
2. **Nonce Protection**: Prevents replay attacks
3. **Session Keys**: Time-limited, permission-scoped keys
4. **Upgrade Safety**: Owner-controlled upgrades

### Audit Status

- [ ] Internal review
- [ ] External audit (Trail of Bits / OpenZeppelin)
- [ ] Formal verification
- [ ] Bug bounty

## Building

```bash
cd contracts/account
cargo build --target wasm32-unknown-unknown --release
```

Or using soroban-cli:

```bash
soroban contract build
```

## Testing

```bash
cargo test
```

## Deployment

### Testnet

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/ancore_account.wasm \
  --network testnet
```

### Mainnet

See `docs/contracts/DEPLOYMENT.md` for mainnet deployment instructions.

## Contract Interface

### Initialize

```rust
fn initialize(env: Env, owner: Address)
```

Initialize the account with an owner address.

### Execute

```rust
fn execute(
    env: Env,
    to: Address,
    function: Symbol,
    args: Vec<Val>,
    expected_nonce: u64,
    session_pub_key: Option<BytesN<32>>,
    signature: Option<BytesN<64>>,
) -> Result<bool, ContractError>
```

Execute a transaction on behalf of the account. For owner execution, omit the session key parameters. For session key execution, provide the session public key and signature. The signature payload is computed on-chain to prevent redundant payload parameters.

### Session Keys

```rust
fn add_session_key(
    env: Env,
    public_key: BytesN<32>,
    expires_at: u64,
    permissions: Vec<u32>,
)

fn revoke_session_key(env: Env, public_key: BytesN<32>)

fn get_session_key(env: Env, public_key: BytesN<32>) -> Option<SessionKey>
```

Manage session keys for the account.

#### Permission bits

<a name="permission-bits"></a>

Session key permissions are stored on-chain as a `Vec<u32>`. The contract
checks `session.permissions.contains(value)` — a session key must hold the
required `u32` value to be authorized.

**Defined constants** (source: `src/lib.rs`):

| Value | Constant             | Description                                                                                                                                             |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1`   | `PERMISSION_EXECUTE` | Required to call `execute()`. A session key whose `permissions` vec does not contain `1` will be rejected with `InsufficientPermission` (error code 7). |

> **Reserved values:** `0` and values ≥ `2` are reserved for future expansion
> and have no effect in the current contract.

> **Reviewer checklist:** When adding a new permission constant, update this
> table, `docs/contract-methods.md#session-permissions`, and the Rust test
> `test_permission_execute_constant_value` to keep all three in sync.

Use `@ancore/account-abstraction` helpers (`permissionsToBitmask`, `bitmaskToContractVec`, `permissionsToContractVec`) to keep UI, SDK, and contract representations aligned.

See also: [`docs/contract-methods.md` — Session permissions](../../docs/contract-methods.md#session-permissions)

### Upgrade

```rust
fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError>
```

Upgrade the contract to a new WASM hash. Only the owner can execute upgrades. The function rejects:

- All-zero WASM hash: `[0u8; 32]`
- Same hash as currently deployed: re-upgrade to identical hash is rejected with `InvalidWasmHash`

This prevents no-op upgrades and ensures gas efficiency.

### Validation Module Boundary

Pluggable validation modules are defined in `contracts/validation-modules/`.
The MVP account integration boundary is interface-level only: the account
contract does not yet store module addresses or invoke modules during
`execute`.

Future module-aware execution should validate the existing owner/session-key
authority and nonce first, build a `ValidationContext` from the exact target,
function, canonical argument digest, and nonce, invoke the configured module's
`validate` function, then increment nonce and dispatch only after module
approval. Module failures must fail closed.

## Contract Errors

The contract uses structured error codes to provide clear feedback for failure conditions. These error codes are essential for SDK and frontend error handling.

### Error Code Reference

| Error Code | Variant                  | Description                            |
| ---------- | ------------------------ | -------------------------------------- |
| 1          | `AlreadyInitialized`     | Account is already initialized         |
| 2          | `NotInitialized`         | Account is not initialized             |
| 3          | `Unauthorized`           | Caller is not authorized               |
| 4          | `InvalidNonce`           | Invalid nonce provided                 |
| 5          | `SessionKeyNotFound`     | Session key not found                  |
| 6          | `SessionKeyExpired`      | Session key has expired                |
| 7          | `InsufficientPermission` | Insufficient permissions               |
| 8          | `InvalidVersion`         | Invalid version provided for migration |
| 9          | `InvalidSignature`       | Invalid signature provided             |
| 10         | `InvalidWasmHash`        | Invalid or duplicate WASM hash         |

### Error Handling Examples

#### SDK Integration

```rust
match contract_result {
    Ok(result) => handle_success(result),
    Err(ContractError::InvalidNonce) => {
        // Handle nonce mismatch - refresh nonce and retry
    },
    Err(ContractError::SessionKeyExpired) => {
        // Handle expired session key - request new key
    },
    Err(error) => {
        // Handle other errors
        eprintln!("Contract error: {:?}", error);
    }
}
```

#### Frontend Integration

```javascript
try {
    await contract.execute(params);
} catch (error) {
    switch (error.code) {
        case 4: // InvalidNonce
            showNonceError();
            break;
        case 6: // SessionKeyExpired
            showSessionKeyExpiredError();
            break;
        case 7: // InsufficientPermission
            showPermissionError();
            break;
        default:
            showGenericError(error.message);
    }
}
## Events

The contract emits structured events for all state-changing operations. These events provide a stable schema for SDK/indexer integrations.

### Event Schema

| Event Topic | Data Type | Description |
|-------------|-----------|-------------|
| `initialized` | `(owner: Address)` | Emitted when the account is initialized with the owner address |
| `executed` | `(to: Address, function: Symbol, nonce: u64)` | Emitted when a transaction is executed with target contract, function name, and nonce used |
| `session_key_added` | `(public_key: BytesN<32>, expires_at: u64)` | Emitted when a session key is added with the public key and expiration timestamp |
| `session_key_revoked` | `(public_key: BytesN<32>)` | Emitted when a session key is revoked with the public key |
| `upgraded` | `(new_wasm_hash: BytesN<32>)` | Emitted when the contract is upgraded with the new WASM hash |
| `migrated` | `(old_version: u32, new_version: u32)` | Emitted when a migration is completed with version transition |

### Event Examples

#### Account Initialization
```

Topic: initialized
Data: 0x1234567890abcdef... (owner Address)

```

#### Transaction Execution
```

Topic: executed
Data: (0x1234567890abcdef..., Symbol("transfer"), 42)

```

#### Session Key Addition
```

Topic: session_key_added
Data: (0xabcdef1234567890..., 1735689600) // (public_key, expires_at)

```

#### Session Key Revocation
```

Topic: session_key_revoked
Data: 0xabcdef1234567890... // public_key

```

#### Contract Upgrade
```

Topic: upgraded
Data: 0x1234567890abcdef... // new_wasm_hash

```

#### Migration
```

Topic: migrated
Data: (1, 2) // (old_version, new_version)

````

## Development

### Prerequisites

- Rust toolchain (1.74.0+)
- Soroban CLI: `cargo install --locked soroban-cli`
- wasm32-unknown-unknown target: `rustup target add wasm32-unknown-unknown`

### Local Development

```bash
# Build
cargo build

# Test
cargo test

# Build optimized WASM
cargo build --target wasm32-unknown-unknown --release
````

## License

Apache-2.0
