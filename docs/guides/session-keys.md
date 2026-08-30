# Session Key Lifecycle Guide

Ancore uses Session Keys to enable seamless, secure, and scoped interactions between dApps and smart accounts. Instead of prompting users for every single micro-transaction (like in-game moves or trustline creation), users can grant scoped, time-bound execution rights to a temporary key.

---

## What is a Session Key?

A **Session Key** is a time-limited Ed25519 or P-256 public key registered directly on-chain within the smart account contract. Its authorization is strictly scoped:
- **Time Bound**: It automatically expires after a specific timestamp or TTL (Time-To-Live).
- **Scope Bound**: It can be restricted to specific contract addresses, function names, or maximum transaction values.
- **Revocable**: The master key (owner) can revoke the session key on-chain at any time.

---

## Creating a Session Key

Session keys are created by generating a temporary key pair on the client side and registering the public key on the smart account contract via the `add_session_key()` method.

### Code Sample (SDK)

```typescript
import { SessionPermission } from '@ancore/types';
import { AncoreClient } from '@ancore/core-sdk';
import { Keypair } from '@stellar/stellar-sdk';

// Generate temporary session key
const sessionKeypair = Keypair.random();

const tx = await ancoreClient.createSessionKey({
  publicKey: sessionKeypair.publicKey(),
  // `permissions` is an array of SessionPermission values, not a single value.
  permissions: [SessionPermission.MANAGE_DATA],
  expiresAt: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
});
// Submit tx with master account signature to register the key on-chain
```

> `SessionPermission.MANAGE_DATA` is the value the contract calls
> `PERMISSION_EXECUTE` (index `1`) — the permission that gates `execute()`.
> See the enum documentation in `@ancore/types` for the full name/value mapping.

---

## Permissions Explained

On-chain, a session key's permissions are a `Vec<u32>` of **permission indices**
— not a bitmask. The contract validates each entry against its known set and
rejects unknown values or duplicates.

| `SessionPermission` | Contract constant            | Value | Grants                                             |
| ------------------- | ---------------------------- | ----- | -------------------------------------------------- |
| `SEND_PAYMENT`      | `PERMISSION_SEND_PAYMENT`    | `0`   | Initiating payments.                                |
| `MANAGE_DATA`       | `PERMISSION_EXECUTE`         | `1`   | Signing and executing general operations via `execute()`. |
| `INVOKE_CONTRACT`   | `PERMISSION_INVOKE_CONTRACT` | `2`   | Calling contract functions.                         |

A separate **bitmask** representation (`1 << index`) exists purely for UI state,
where a set of checkboxes is more convenient than an array. Convert between the
two with the helpers in `@ancore/account-abstraction` rather than hand-rolling
bit math — the bitmask is never sent to the contract directly:

```typescript
import {
  permissionsToBitmask,
  bitmaskToPermissions,
  permissionsToContractVec,
} from '@ancore/account-abstraction';

const bitmask = permissionsToBitmask([SessionPermission.SEND_PAYMENT]); // UI state
const perms = bitmaskToPermissions(bitmask); // back to enum values
const vec = permissionsToContractVec(perms); // what the contract receives
```

An empty permission array grants no scoped rights; the contract rejects an
`execute()` call from a session key lacking `PERMISSION_EXECUTE`.

---

## dApp Session Key Request

dApps can request a session key from the user's Ancore Wallet extension or mobile app via the `@ancore/wallet-api`.

```javascript
import { requestSessionKey } from '@ancore/wallet-api';

const sessionDetails = await requestSessionKey({
  allowlist: ['CB...contractAddress'],
  methods: ['play_game', 'mint_token'],
  maxAmount: '100.0000000',
  durationSeconds: 3600
});

console.log("Registered Session Key:", sessionDetails.publicKey);
```

---

## Using a Session Key

Once registered, the session key signs a relay payload (transaction parameters + nonce + fee limit). The dApp sends this payload to the Ancore Relayer, which pays the gas fee and submits it to the Soroban contract.

```typescript
const relayPayload = {
  contractId: 'CB...',
  functionName: 'play_game',
  args: [...],
  nonce: await contract.getNonce(),
};

const signature = sessionKeypair.sign(hashPayload(relayPayload));
await relayer.submit({ relayPayload, signature });
```

---

## Revoking a Session Key

If a user wants to invalidate a session key before its natural expiration, they can trigger a revocation transaction.

### Code Sample (SDK)

```typescript
const tx = await ancoreClient.revokeSessionKey({
  publicKey: sessionKeyPublicKey
});
// Sign with master key and submit. The contract invalidates the key immediately.
```

---

## Expiry and TTL

- **On-chain Expiry**: The contract checks `expiresAt` during every transaction simulation/execution. If the block time exceeds `expiresAt`, the transaction fails with `SESSION_KEY_EXPIRED`.
- **State Cleanup / TTL**: To prevent state bloat, session key records are kept under Soroban temporary storage. If the storage TTL expires without a refresh, the key is evicted from the ledger.
