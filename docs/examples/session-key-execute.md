# Example: Session-Key Execute Flow

> End-to-end example for executing a contract call authenticated by a session key.  
> References: [`sdk-wrappers.md`](../sdk-wrappers.md) · [`contract-methods.md`](../contract-methods.md)  
> Last updated: 2026-04-24 · Issue #287

---

## Overview

The session-key execute flow lets a scoped key (e.g. held by a dApp or mobile
app) authorize contract calls on behalf of the account owner — without exposing
the owner's private key.

**Flow**

```
1. Owner adds session key on-chain  (add_session_key)
2. App fetches current nonce        (get_nonce)
3. App builds execute invocation    (executeWithSessionKey)
4. Session key signs auth entry     (signer.signAuthEntryXdr)
5. Transaction submitted            (execution layer)
6. Contract verifies signature, increments nonce, invokes target
```

---

## Prerequisites

```bash
pnpm add @ancore/core-sdk @ancore/account-abstraction @ancore/types
```

---

## Step 1 — Add a session key (owner)

The account owner registers the session key once. This is typically done in the
wallet UI.

```typescript
import { AncoreClient, SessionPermission } from '@ancore/core-sdk';
import { AccountContract } from '@ancore/account-abstraction';

const CONTRACT_ID = 'C...'; // your deployed account contract

const client = new AncoreClient({ accountContractId: CONTRACT_ID });

// Build the invocation (synchronous — no network call yet)
const invocation = client.addSessionKey({
  publicKey:   'GABC...SESSION_KEY_PUBLIC_KEY',
  permissions: [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT],
  expiresAt:   Math.floor(Date.now() / 1000) + 86400, // unix seconds — 24 hours from now
  // Note: AddSessionKeyParams.expiresAt is unix seconds (contract layer).
  // @ancore/types SessionKey.expiresAt is unix ms — they are different units.
});

// Submit via your transaction builder (owner must sign)
// await ownerTransactionBuilder.buildAndSubmit(invocation);
```

---

## Step 2 — Fetch the current nonce

Always fetch the nonce immediately before building the execute call to avoid
`InvalidNonce` errors.

```typescript
import { AccountContract } from '@ancore/account-abstraction';
import { Server } from '@stellar/stellar-sdk/rpc';

const CONTRACT_ID = 'C...';
const SOURCE_ACCOUNT = 'G...'; // any funded account for simulation
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const server = new Server('https://soroban-testnet.stellar.org');
const contract = new AccountContract(CONTRACT_ID);

const nonce = await contract.getNonce({
  server,
  sourceAccount: SOURCE_ACCOUNT,
  networkPassphrase: NETWORK_PASSPHRASE,
});
```

---

## Step 3 — Execute with session key

```typescript
import { executeWithSessionKey, SessionKeyExecutionError } from '@ancore/core-sdk';
import { xdr } from '@stellar/stellar-sdk';

// Signer implementation — adapt to your key management solution
const signer = {
  publicKey: 'GABC...SESSION_KEY_PUBLIC_KEY',
  signAuthEntryXdr: async (authEntryXdr: string): Promise<string> => {
    // Sign the auth entry XDR with the session key's private key.
    // Implementation depends on your platform (see platform notes below).
    return myKeyManager.signAuthEntry(authEntryXdr);
  },
};

try {
  const result = await executeWithSessionKey({
    target:        'C...TARGET_CONTRACT',
    function:      'transfer',
    args:          [
      xdr.ScVal.scvAddress(/* destination address */),
      xdr.ScVal.scvI128(/* amount */),
    ],
    expectedNonce: nonce,
    signer,
  });

  console.log('Transaction hash:', result.transactionHash);
  console.log('Result:', result.result);
} catch (error) {
  handleSessionKeyError(error);
}
```

---

## Error handling

```typescript
import {
  SessionKeyExecutionError,
  SessionKeyExecutionValidationError,
  AncoreSdkError,
} from '@ancore/core-sdk';
import {
  SessionKeyExpiredError,
  SessionKeyNotFoundError,
  InvalidNonceError,
} from '@ancore/account-abstraction';

function handleSessionKeyError(error: unknown): never {
  if (error instanceof SessionKeyExecutionValidationError) {
    // Bad inputs — fix the call site
    throw new Error(`Invalid parameters: ${error.message}`);
  }

  if (error instanceof SessionKeyExecutionError) {
    switch (error.code) {
      case 'SESSION_KEY_EXECUTION_UNAUTHORIZED':
        // Session key not authorized — check permissions or re-add key
        throw new Error('Session key is not authorized for this operation.');

      case 'SESSION_KEY_EXECUTION_INVALID_NONCE':
        // Nonce race — re-fetch nonce and retry once
        throw new Error('Nonce mismatch — retry after re-fetching the nonce.');

      case 'SESSION_KEY_EXECUTION_NOT_INITIALIZED':
        throw new Error('Contract not initialized.');

      default:
        throw new Error(`Session key execution failed [${error.code}]: ${error.message}`);
    }
  }

  throw error;
}
```

---

## Platform notes

### Extension wallet (`apps/extension-wallet`)

The extension wallet holds session keys in encrypted storage. Use the
background service's signing API:

```typescript
// In content script / popup
const signedXdr = await chrome.runtime.sendMessage({
  type: 'SIGN_AUTH_ENTRY',
  authEntryXdr,
  publicKey: signer.publicKey,
});
```

### Mobile wallet (`apps/mobile-wallet`)

Use the secure enclave or keychain to sign auth entries:

```typescript
import { signAuthEntry } from '@/security/keychain';

const signer = {
  publicKey: storedPublicKey,
  signAuthEntryXdr: (xdr) => signAuthEntry(xdr, storedPublicKey),
};
```

### Web dashboard (`apps/web-dashboard`)

For in-browser signing, use the `@ancore/crypto` signing utilities:

```typescript
import { signBytes } from '@ancore/crypto';

const signer = {
  publicKey: sessionKeyPublicKey,
  signAuthEntryXdr: async (authEntryXdr) => {
    const entryBytes = Buffer.from(authEntryXdr, 'base64');
    return signBytes(entryBytes, sessionKeyPrivateKey);
  },
};
```

---

## Full example (TypeScript)

```typescript
import { AncoreClient, executeWithSessionKey, SessionPermission } from '@ancore/core-sdk';
import { AccountContract } from '@ancore/account-abstraction';
import { Server } from '@stellar/stellar-sdk/rpc';
import { xdr } from '@stellar/stellar-sdk';

const CONTRACT_ID      = 'C...';
const TARGET_CONTRACT  = 'C...';
const SOURCE_ACCOUNT   = 'G...';
const SESSION_KEY_PUB  = 'G...';
const NETWORK          = 'Test SDF Network ; September 2015';

async function runSessionKeyExecute() {
  const server   = new Server('https://soroban-testnet.stellar.org');
  const contract = new AccountContract(CONTRACT_ID);

  // 1. Fetch nonce
  const nonce = await contract.getNonce({
    server,
    sourceAccount: SOURCE_ACCOUNT,
    networkPassphrase: NETWORK,
  });

  // 2. Execute
  const result = await executeWithSessionKey({
    target:        TARGET_CONTRACT,
    function:      'transfer',
    args:          [xdr.ScVal.scvAddress(/* ... */), xdr.ScVal.scvI128(/* ... */)],
    expectedNonce: nonce,
    signer: {
      publicKey:        SESSION_KEY_PUB,
      signAuthEntryXdr: (xdr) => myKeyManager.sign(xdr),
    },
  });

  return result;
}
```

---

## Related

- [Contract method: `execute`](../contract-methods.md#execute)
- [Contract method: `add_session_key`](../contract-methods.md#add_session_key)
- [SDK: `executeWithSessionKey`](../sdk-wrappers.md#executewithsessionkey)
- [Send payment example](./send-payment.md)
