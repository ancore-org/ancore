# Contract Event Catalog

> Canonical reference for all events emitted by `contracts/account/src/lib.rs`.  
> Use this document to map on-chain events to indexer ingestion actions.  
> Last updated: 2026-06-01

---

## Overview

Every state-changing operation in the Ancore Account contract emits a Soroban event.
Events are accessible via the Horizon `/accounts/{id}/transactions` endpoint or the
Soroban RPC `getEvents` method. All events follow the pattern:

```
topic: [Symbol("<event_name>")]
data:  <event-specific tuple or value>
```

---

## Event Catalog

### `initialized`

Emitted once when an account is deployed and `initialize()` is called.

| Field | Type | Description |
|-------|------|-------------|
| `owner` | `Address` | The Stellar address set as the account owner |

**Indexer action:** Insert a new account row with `owner`, `contract_id`, and `ledger_seq`.

**Sample Horizon event payload**

```json
{
  "type": "contract",
  "ledger": "53000001",
  "ledgerClosedAt": "2024-06-01T12:00:00Z",
  "contractId": "CAABC...XYZ",
  "id": "0000053000001-0000000001",
  "topic": [
    { "type": "symbol", "value": "initialized" }
  ],
  "value": {
    "type": "address",
    "value": "GABC...OWNER"
  }
}
```

---

### `executed`

Emitted each time `execute()` successfully invokes a contract function.

| Field | Type | Description |
|-------|------|-------------|
| `to` | `Address` | Target contract address |
| `function` | `Symbol` | Name of the invoked function |
| `nonce` | `u64` | Pre-increment nonce value (nonce at time of call) |

**Indexer action:** Insert an activity row with `activity_type = "execute"`,
`counterparty = to`, and `metadata = { function, nonce }`.

**Sample payload**

```json
{
  "topic": [{ "type": "symbol", "value": "executed" }],
  "value": {
    "type": "vec",
    "values": [
      { "type": "address", "value": "CABC...TARGET" },
      { "type": "symbol", "value": "transfer" },
      { "type": "u64",    "value": "42" }
    ]
  }
}
```

---

### `session_key_added`

Emitted when a session key is registered via `add_session_key()`.

| Field | Type | Description |
|-------|------|-------------|
| `public_key` | `BytesN<32>` | Ed25519 public key of the session key (hex) |
| `expires_at` | `u64` | Unix timestamp (seconds) when the key expires |

**Indexer action:** Insert or upsert a session-key row; set `status = "active"`.

---

### `session_key_revoked`

Emitted when a session key is removed via `revoke_session_key()`.

| Field | Type | Description |
|-------|------|-------------|
| `public_key` | `BytesN<32>` | Ed25519 public key of the revoked session key |

**Indexer action:** Update session-key row to `status = "revoked"`.

---

### `session_key_ttl_refreshed`

Emitted when a session key's expiry is extended via `refresh_session_key_ttl()`.

| Field | Type | Description |
|-------|------|-------------|
| `public_key` | `BytesN<32>` | Ed25519 public key of the refreshed session key |
| `expires_at` | `u64` | New Unix expiry timestamp (seconds) |

**Indexer action:** Update session-key row with new `expires_at`.

---

### `upgraded`

Emitted when the contract WASM is replaced via `upgrade()`.

| Field | Type | Description |
|-------|------|-------------|
| `new_wasm_hash` | `BytesN<32>` | Hash of the new WASM module |

**Indexer action:** Update the contract row with `wasm_hash` and increment a version counter.

---

### `migrated`

Emitted when a data-schema migration runs via `migrate()`.

| Field | Type | Description |
|-------|------|-------------|
| `old_version` | `u32` | Contract version before migration |
| `new_version` | `u32` | Contract version after migration |

**Indexer action:** Insert a migration-history row; update the contract row with `version = new_version`.

---

## Ingestion Notes

- **Event ordering**: Soroban guarantees ledger-level ordering. Process events in
  `ledger_seq` + `event_index` order to avoid race conditions.
- **Idempotency**: Use the Horizon event `id` field as a natural deduplication key.
  Re-processing the same event must be a no-op.
- **`BytesN<32>` encoding**: Soroban encodes raw byte arrays as base64 in JSON.
  Decode to hex before storing for human-readable queries.
- **Address encoding**: Soroban `Address` values are Stellar strkeys (G-accounts or
  C-contracts). Store as-is; no conversion is needed.

---

## Related Resources

- [Contract methods reference](../contract-methods.md)
- [Integration guide](../integration-guide.md)
- [Indexer service API](../../services/indexer/README.md)
- [Soroban events RPC reference](https://developers.stellar.org/docs/data/rpc/api-reference/methods/getEvents)
