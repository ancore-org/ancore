# Session-Key Lifecycle Cookbook

> End-to-end examples for managing session keys throughout their lifecycle.  
> References: [`session-key-execute.md`](./session-key-execute.md) · [`sdk-wrappers.md`](../sdk-wrappers.md)  
> Last updated: 2026-04-28

---

## Overview

Session keys enable scoped delegation of account permissions without exposing the owner's private key. This cookbook covers the complete lifecycle:

```
1. Generate session key pair          (key generation)
2. Add session key on-chain           (add_session_key)
3. Execute operations with session key (execute)
4. Refresh session key expiration     (add_session_key with new expiresAt)
5. Revoke session key                 (revoke_session_key)
```

---

## Prerequisites

```bash
pnpm add @ancore/core-sdk @ancore/account-abstraction @ancore/types @ancore/crypto @stellar/stellar-sdk
```

---

## 1. Generate a Session Key Pair

Before adding a session key, generate a key pair for the session:

```typescript
import { Keypair } from '@stellar/stellar-sdk';

// Generate a new session key pair
const sessionKeyPair = Keypair.random();

console.log('Session public key:', sessionKeyPair.publicKey());
console.log('Session secret key:', sessionKeyPair.secret()); // Keep this secure!

// Store the secret key securely (encrypted storage, keychain, etc.)
// Never expose it to client-side code in production
```

**Security Note:** Session key secrets must be stored securely. Use platform-appropriate secure storage:
- **Extension wallet:** Encrypted storage with user password
- **Mobile wallet:** Secure enclave / keychain
- **Web dashboard:** Encrypted localStorage (with user password)

---

## 2. Add a Session Key

Register the session key on-chain with specific permissions and expiration:

```typescript
import { AncoreClient, SessionPermission } from '@ancore/core-sdk';
import { AccountContract } from '@ancore/account-abstraction';

const CONTRACT_ID = 'C...'; // Your deployed account contract
const SESSION_KEY_PUB = sessionKeyPair.publicKey();

const client = new AncoreClient({ accountContractId: CONTRACT_ID });

// Calculate expiration (24 hours from now, in unix seconds)
const expiresAt = Math.floor(Date.now() / 1000) + 86400;

// Build the add_session_key invocation
const invocation = client.addSessionKey({
  publicKey: SESSION_KEY_PUB,
  permissions: [
    SessionPermission.SEND_PAYMENT,
    SessionPermission.INVOKE_CONTRACT,
  ],
  expiresAt,
});

// Submit via your transaction builder (owner must sign)
// await ownerTransactionBuilder.buildAndSubmit(invocation);
```

**Permission Options:**
- `SessionPermission.SEND_PAYMENT` (0) - Send XLM payments
- `SessionPermission.MANAGE_DATA` (1) - Manage account data entries
- `SessionPermission.INVOKE_CONTRACT` (2) - Invoke other contracts

**Important:** `expiresAt` is in **unix seconds** (not milliseconds) for the contract layer.

---

## 3. Execute with Session Key

Use the session key to authorize operations:

```typescript
import { executeWithSessionKey } from '@ancore/core-sdk';
import { AccountContract } from '@ancore/account-abstraction';
import { Server } from '@stellar/stellar-sdk/rpc';
import { xdr } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'C...';
const TARGET_CONTRACT = 'C...';
const SOURCE_ACCOUNT = 'G...';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const server = new Server('https://soroban-testnet.stellar.org');
const contract = new AccountContract(CONTRACT_ID);

// Fetch current nonce (always do this immediately before execute)
const nonce = await contract.getNonce({
  server,
  sourceAccount: SOURCE_ACCOUNT,
  networkPassphrase: NETWORK_PASSPHRASE,
});

// Signer implementation - adapt to your key management
const signer = {
  publicKey: SESSION_KEY_PUB,
  signAuthEntryXdr: async (authEntryXdr: string): Promise<string> => {
    // Sign the auth entry XDR with the session key's private key
    const entryBytes = Buffer.from(authEntryXdr, 'base64');
    const signature = sessionKeyPair.sign(entryBytes);
    return signature.toString('base64');
  },
};

// Execute a contract call
const result = await executeWithSessionKey({
  target: TARGET_CONTRACT,
  function: 'transfer',
  args: [
    xdr.ScVal.scvAddress('G...DESTINATION'),
    xdr.ScVal.scvI128(1000000), // 1 XLM (in stroops)
  ],
  expectedNonce: nonce,
  signer,
});

console.log('Transaction hash:', result.transactionHash);
console.log('Result:', result.result);
```

---

## 4. Refresh Session Key Expiration

To extend a session key's expiration, call `add_session_key` again with the same public key but a new `expiresAt`:

```typescript
import { AncoreClient, SessionPermission } from '@ancore/core-sdk';

const client = new AncoreClient({ accountContractId: CONTRACT_ID });

// Extend expiration by another 24 hours
const newExpiresAt = Math.floor(Date.now() / 1000) + 86400;

// Re-add with same permissions and new expiration
const invocation = client.addSessionKey({
  publicKey: SESSION_KEY_PUB,
  permissions: [
    SessionPermission.SEND_PAYMENT,
    SessionPermission.INVOKE_CONTRACT,
  ],
  expiresAt: newExpiresAt,
});

// Submit via your transaction builder (owner must sign)
// await ownerTransactionBuilder.buildAndSubmit(invocation);
```

**Note:** Refreshing does not change permissions. To modify permissions, revoke and re-add with new permissions.

---

## 5. Revoke a Session Key

Remove a session key's authorization:

```typescript
import { AncoreClient } from '@ancore/core-sdk';

const client = new AncoreClient({ accountContractId: CONTRACT_ID });

// Build the revoke_session_key invocation
const invocation = client.revokeSessionKey({
  publicKey: SESSION_KEY_PUB,
});

// Submit via your transaction builder (owner must sign)
// await ownerTransactionBuilder.buildAndSubmit(invocation);

// After revocation, securely delete the session key secret from storage
// await secureStorage.delete(SESSION_KEY_PUB);
```

**Security Note:** Always delete the session key secret from storage after revocation to prevent accidental reuse.

---

## 6. Query Session Key Status

Check if a session key exists and its current state:

```typescript
import { getSessionKey } from '@ancore/account-abstraction';
import { AccountContract } from '@ancore/account-abstraction';
import { Server } from '@stellar/stellar-sdk/rpc';

const CONTRACT_ID = 'C...';
const SOURCE_ACCOUNT = 'G...';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const server = new Server('https://soroban-testnet.stellar.org');
const contract = new AccountContract(CONTRACT_ID);

const sessionKeyInfo = await getSessionKey(
  contract,
  SESSION_KEY_PUB,
  {
    server,
    sourceAccount: SOURCE_ACCOUNT,
    networkPassphrase: NETWORK_PASSPHRASE,
  }
);

if (sessionKeyInfo) {
  console.log('Session key exists:', sessionKeyInfo);
  console.log('Permissions:', sessionKeyInfo.permissions);
  console.log('Expires at:', sessionKeyInfo.expiresAt);
} else {
  console.log('Session key not found or expired');
}
```

---

## 7. List All Session Keys (Local Storage)

Query session keys stored locally in the wallet:

```typescript
import { getSessionKeys } from '@ancore/core-sdk/storage';
import { SecureStorageManager } from '@ancore/core-sdk/storage';

// Initialize secure storage manager
const storageManager = new SecureStorageManager({
  storage: chrome.storage.local, // or your storage adapter
  password: userPassword,
});

await storageManager.unlock(userPassword);

// Get all stored session keys
const sessionKeysData = await getSessionKeys({
  storage: chrome.storage.local,
  decryptData: (payload) => storageManager.decryptData(payload),
  assertUnlocked: () => storageManager.assertUnlocked(),
});

console.log('Stored session keys:', sessionKeysData.keys);

// Iterate through keys
for (const [publicKey, privateKey] of Object.entries(sessionKeysData.keys)) {
  console.log(`Session key: ${publicKey}`);
}
```

---

## 8. Complete Lifecycle Example

Full end-to-end example combining all operations:

```typescript
import { 
  AncoreClient, 
  executeWithSessionKey, 
  SessionPermission,
  getSessionKeys,
  saveSessionKeys,
} from '@ancore/core-sdk';
import { AccountContract, getSessionKey } from '@ancore/account-abstraction';
import { Keypair, Server, xdr } from '@stellar/stellar-sdk';

const CONTRACT_ID = 'C...';
const TARGET_CONTRACT = 'C...';
const SOURCE_ACCOUNT = 'G...';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

// Initialize
const server = new Server('https://soroban-testnet.stellar.org');
const contract = new AccountContract(CONTRACT_ID);
const client = new AncoreClient({ accountContractId: CONTRACT_ID });

async function sessionKeyLifecycle() {
  // 1. Generate session key
  const sessionKeyPair = Keypair.random();
  const sessionKeyPub = sessionKeyPair.publicKey();
  console.log('Generated session key:', sessionKeyPub);

  // 2. Store session key securely
  await saveSessionKeys(
    { keys: { [sessionKeyPub]: sessionKeyPair.secret() } },
    {
      storage: chrome.storage.local,
      encryptData: (data) => storageManager.encryptData(data),
      assertUnlocked: () => storageManager.assertUnlocked(),
    }
  );

  // 3. Add session key on-chain
  const expiresAt = Math.floor(Date.now() / 1000) + 86400;
  const addInvocation = client.addSessionKey({
    publicKey: sessionKeyPub,
    permissions: [SessionPermission.SEND_PAYMENT],
    expiresAt,
  });
  await ownerTransactionBuilder.buildAndSubmit(addInvocation);
  console.log('Session key added on-chain');

  // 4. Verify session key exists
  const sessionKeyInfo = await getSessionKey(contract, sessionKeyPub, {
    server,
    sourceAccount: SOURCE_ACCOUNT,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  console.log('Session key verified:', sessionKeyInfo);

  // 5. Execute with session key
  const nonce = await contract.getNonce({
    server,
    sourceAccount: SOURCE_ACCOUNT,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const result = await executeWithSessionKey({
    target: TARGET_CONTRACT,
    function: 'transfer',
    args: [xdr.ScVal.scvAddress('G...DEST'), xdr.ScVal.scvI128(1000000)],
    expectedNonce: nonce,
    signer: {
      publicKey: sessionKeyPub,
      signAuthEntryXdr: async (authEntryXdr) => {
        const entryBytes = Buffer.from(authEntryXdr, 'base64');
        const signature = sessionKeyPair.sign(entryBytes);
        return signature.toString('base64');
      },
    },
  });
  console.log('Execution successful:', result.transactionHash);

  // 6. Refresh expiration
  const newExpiresAt = Math.floor(Date.now() / 1000) + 86400;
  const refreshInvocation = client.addSessionKey({
    publicKey: sessionKeyPub,
    permissions: [SessionPermission.SEND_PAYMENT],
    expiresAt: newExpiresAt,
  });
  await ownerTransactionBuilder.buildAndSubmit(refreshInvocation);
  console.log('Session key expiration refreshed');

  // 7. Revoke session key
  const revokeInvocation = client.revokeSessionKey({
    publicKey: sessionKeyPub,
  });
  await ownerTransactionBuilder.buildAndSubmit(revokeInvocation);
  console.log('Session key revoked');

  // 8. Clean up local storage
  const currentKeys = await getSessionKeys({
    storage: chrome.storage.local,
    decryptData: (payload) => storageManager.decryptData(payload),
    assertUnlocked: () => storageManager.assertUnlocked(),
  });
  delete currentKeys.keys[sessionKeyPub];
  await saveSessionKeys(currentKeys, {
    storage: chrome.storage.local,
    encryptData: (data) => storageManager.encryptData(data),
    assertUnlocked: () => storageManager.assertUnlocked(),
  });
  console.log('Session key removed from storage');
}

sessionKeyLifecycle().catch(console.error);
```

---

## Error Handling

Handle common session key errors:

```typescript
import {
  SessionKeyManagementError,
  SessionKeyExecutionError,
  BuilderValidationError,
} from '@ancore/core-sdk';
import {
  SessionKeyNotFoundError,
  SessionKeyExpiredError,
  InvalidNonceError,
} from '@ancore/account-abstraction';

function handleSessionKeyError(error: unknown): never {
  if (error instanceof BuilderValidationError) {
    throw new Error(`Invalid parameters: ${error.message}`);
  }

  if (error instanceof SessionKeyManagementError) {
    switch (error.code) {
      case 'SESSION_KEY_ADD_FAILED':
        throw new Error('Failed to add session key. Check public key format and permissions.');
      case 'SESSION_KEY_REVOKE_FAILED':
        throw new Error('Failed to revoke session key. Check if key exists.');
      default:
        throw new Error(`Session key management error: ${error.message}`);
    }
  }

  if (error instanceof SessionKeyExecutionError) {
    switch (error.code) {
      case 'SESSION_KEY_EXECUTION_UNAUTHORIZED':
        throw new Error('Session key not authorized. Check permissions or re-add key.');
      case 'SESSION_KEY_EXECUTION_INVALID_NONCE':
        throw new Error('Nonce mismatch. Re-fetch nonce and retry.');
      case 'SESSION_KEY_EXECUTION_NOT_INITIALIZED':
        throw new Error('Contract not initialized.');
      default:
        throw new Error(`Execution failed: ${error.message}`);
    }
  }

  if (error instanceof SessionKeyNotFoundError) {
    throw new Error('Session key not found on-chain. It may have been revoked or expired.');
  }

  if (error instanceof SessionKeyExpiredError) {
    throw new Error('Session key has expired. Refresh or re-add the key.');
  }

  if (error instanceof InvalidNonceError) {
    throw new Error('Invalid nonce. Fetch current nonce and retry.');
  }

  throw error;
}
```

---

## Best Practices

### Security
- **Never** expose session key secrets in client-side code
- Use platform-appropriate secure storage (encrypted, password-protected)
- Revoke session keys immediately after use for one-time operations
- Use short expiration times (hours, not days) for session keys
- Rotate session keys regularly

### Permissions
- Grant minimum required permissions only
- Use `SEND_PAYMENT` for simple transfers
- Use `INVOKE_CONTRACT` only when needed for dApp interactions
- Avoid `MANAGE_DATA` unless specifically required

### Nonce Management
- Always fetch nonce immediately before execute
- Handle nonce race conditions with retry logic
- Never reuse nonces across transactions

### Error Handling
- Always wrap session key operations in try/catch
- Provide clear error messages to users
- Implement retry logic for transient errors (nonce, network)

---

## Related Documentation

- [Session Key Execute Example](./session-key-execute.md)
- [Send Payment Example](./send-payment.md)
- [SDK Wrappers](../sdk-wrappers.md)
- [Contract Methods](../contract-methods.md)
- [Account Abstraction README](../../packages/account-abstraction/README.md)
