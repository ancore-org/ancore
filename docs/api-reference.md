# Ancore Wallet dApp API Reference

Comprehensive reference for dApp developers integrating with the **Ancore Wallet** browser extension. This document details all supported message types, wire postMessage protocol formats, Soroban-specific behavior, and error handling.

For library installation and basic quick-start guides, see [`@ancore/wallet-api`](../packages/wallet-api/README.md).

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
  - [PostMessage Wire Protocol](#postmessage-wire-protocol)
  - [Request Envelope](#request-envelope)
  - [Response Envelope](#response-envelope)
  - [Ancore vs Classic Stellar Wallets](#ancore-vs-classic-stellar-wallets)
- [Message Types Reference](#message-types-reference)
  - [1. `requestAccess`](#1-requestaccess)
  - [2. `connect`](#2-connect)
  - [3. `getAddress`](#3-getaddress)
  - [4. `getPublicKey`](#4-getpublickey)
  - [5. `getNetwork`](#5-getnetwork)
  - [6. `isConnected`](#6-isconnected)
  - [7. `getSmartAccount`](#7-getsmartaccount)
  - [8. `signTransaction`](#8-signtransaction)
  - [9. `signAuthEntry`](#9-signauthentry)
  - [10. `signMessage`](#10-signmessage)
  - [11. `requestSessionKey`](#11-requestsessionkey)
  - [12. `signRelayPayload`](#12-signrelaypayload)
  - [13. `addToken`](#13-addtoken)
- [Soroban-Specific Behavior](#soroban-specific-behavior)
  - [Smart Account Identity (C-Address vs G-Address)](#smart-account-identity-c-address-vs-g-address)
  - [SEP-43 Soroban Authorization Entries](#sep-43-soroban-authorization-entries)
  - [Session Keys and Granular Policies](#session-keys-and-granular-policies)
  - [Relayer Meta-Transactions and Fee Abstraction](#relayer-meta-transactions-and-fee-abstraction)
  - [Contract Deployment Probing](#contract-deployment-probing)
- [Error Handling & Catalog](#error-handling--catalog)
  - [Wire Error Envelope](#wire-error-envelope)
  - [Error Hierarchy in `@ancore/wallet-api`](#error-hierarchy-in-ancorewallet-api)
  - [Error Catalog](#error-catalog)
  - [The Two Timeouts Model](#the-two-timeouts-model)
  - [Typed Error Handling Pattern](#typed-error-handling-pattern)
- [Integration Walkthrough](#integration-walkthrough)

---

## Overview & Architecture

Communication between dApp web pages and the Ancore Wallet extension takes place over a secure browser bridge:

```text
dApp Web Page              Content Script             Background Worker          Approval UI
─────────────              ──────────────             ─────────────────          ───────────
window.postMessage()  ──>  Validate origin &
(ANCORE_WALLET_REQUEST)    whitelist method
                           chrome.runtime.send() ──>  Check allowlist
                                                      If not allowed:
                                                      Enqueue request   ───>     Open popup /
                                                      Wait for decision <───     side-panel UI
                           chrome.runtime.reply() <── Result / Error
window.postMessage()  <──  Forward response
(ANCORE_WALLET_RESPONSE)
```

1. **`@ancore/wallet-api`**: High-level TypeScript client library exposing strongly-typed helper methods.
2. **Content Script**: Injected at `document_start`. Validates that incoming `window` messages match `ANCORE_WALLET_REQUEST` and only contain allowlisted external methods.
3. **Background Service Worker**: Verifies site permissions (allowlist keyed by `network`, `smartAccountId`, `origin`), handles cryptographic operations, coordinates session keys, and opens user approval dialogs.

### PostMessage Wire Protocol

All inter-frame requests and responses adhere to standard JSON envelopes tagged with protocol identifiers from `@ancore/wallet-shared`.

#### Request Envelope

Messages sent from the dApp page to `window`:

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "a5482390-50d4-4a2e-8c31-cbb612f0011b",
  "method": "signTransaction",
  "params": {
    "xdr": "AAAAAgAAAAD...",
    "network": "testnet"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"ANCORE_WALLET_REQUEST"` | Identifies the message as an Ancore wallet request. |
| `source` | `"ancore-wallet-api@1"` | Protocol source discriminator. |
| `requestId` | `string` | Unique client-generated correlation ID (e.g. UUIDv4). |
| `method` | `ExternalApiMethodName` | Method name matching the allowlisted external API methods. |
| `params` | `object` *(optional)* | Method arguments object. |

#### Response Envelope

Messages returned from the content script back to `window`:

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "a5482390-50d4-4a2e-8c31-cbb612f0011b",
  "ok": true,
  "result": {
    "signedXdr": "AAAAAgAAAAD..."
  }
}
```

When an operation fails:

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "a5482390-50d4-4a2e-8c31-cbb612f0011b",
  "ok": false,
  "error": "User rejected the sign request"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"ANCORE_WALLET_RESPONSE"` | Identifies the message as an Ancore wallet response. |
| `source` | `"ancore-content-script@1"` | Content script source discriminator. |
| `requestId` | `string` | Matches the `requestId` of the originating request. |
| `ok` | `boolean` | `true` if successful; `false` on rejection or error. |
| `result` | `unknown` *(optional)* | Result payload when `ok` is `true`. |
| `error` | `string` *(optional)* | Error message string when `ok` is `false`. |

---

### Ancore vs Classic Stellar Wallets

| Feature | Classic Stellar (e.g. Freighter) | Ancore Account Abstraction |
|---|---|---|
| **Primary Account ID** | Ed25519 Public Key (`G...`, 56 chars) | Soroban Smart Contract ID (`C...`, 56 chars) |
| **Owner Key** | Primary signing key | Secret key / hardware key controlling the contract |
| **Transaction Signing** | Ed25519 signature on transaction hash | Contract invocation signature or SEP-43 auth entry |
| **Gas / Fees** | Source account pays native XLM fees | Can be sponsored via Relayer (`submitViaRelayer`) |
| **Micro-interactions** | User approval popup on every tx | Scoped **Session Keys** with limits & expiration |

---

## Message Types Reference

### 1. `requestAccess`

Prompts the user to grant permission for the calling dApp origin to interact with their active smart account. If the origin is already on the allowlist for the current network and account, resolves immediately without opening an approval window.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "6cf7e721-70e2-4bd5-8f6a-0466be9794cb",
  "method": "requestAccess",
  "params": {
    "network": "testnet"
  }
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "6cf7e721-70e2-4bd5-8f6a-0466be9794cb",
  "ok": true,
  "result": {
    "smartAccountId": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "ownerPublicKey": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "network": "testnet"
  }
}
```

#### TypeScript SDK Usage

```typescript
import { requestAccess } from '@ancore/wallet-api';

const { smartAccountId, ownerPublicKey, network } = await requestAccess();
console.log(`Connected to smart account ${smartAccountId} on ${network}`);
```

---

### 2. `connect`

High-level connection convenience method mirroring `requestAccess`. If not already allowlisted, prompts the user for access. Resolves directly with the primary smart account contract C-address.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "8f8b82e2-0f5a-4eb3-81b0-4660d5bfa4a3",
  "method": "connect",
  "params": {}
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "8f8b82e2-0f5a-4eb3-81b0-4660d5bfa4a3",
  "ok": true,
  "result": {
    "smartAccountId": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "network": "testnet"
  }
}
```

#### TypeScript SDK Usage

```typescript
import { connect } from '@ancore/wallet-api';

const smartAccountId = await connect();
// Returns string: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
```

---

### 3. `getAddress`

Returns the active smart account address and optional owner public key without triggering any user prompt. Requires that the calling origin has already been approved via `requestAccess` or `connect`.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "d258cb21-2e5b-4c4f-9e79-cb4ecb5eb541",
  "method": "getAddress",
  "params": {}
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "d258cb21-2e5b-4c4f-9e79-cb4ecb5eb541",
  "ok": true,
  "result": {
    "address": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "network": "testnet",
    "ownerPublicKey": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
  }
}
```

#### TypeScript SDK Usage

```typescript
import { getAddress } from '@ancore/wallet-api';

const { smartAccountId, ownerPublicKey } = await getAddress();
```

> **Note:** If the origin is not allowlisted, the background worker rejects with `"Origin not allowed. Call requestAccess first."`.

---

### 4. `getPublicKey`

Returns the primary public identity address of the active account. In Ancore, this returns the deployed smart-account C-address (stored in extension storage). Requires prior access approval.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "b3e34320-1bfa-4c55-bfa3-f47de023ba11",
  "method": "getPublicKey",
  "params": {}
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "b3e34320-1bfa-4c55-bfa3-f47de023ba11",
  "ok": true,
  "result": {
    "publicKey": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }
}
```

---

### 5. `getNetwork`

Queries the active Stellar network currently selected in the extension settings. Returns the network name and its official network passphrase.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "6d92ec17-30e4-4fa9-b883-7d2d3a3d66fe",
  "method": "getNetwork",
  "params": {}
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "6d92ec17-30e4-4fa9-b883-7d2d3a3d66fe",
  "ok": true,
  "result": {
    "network": "testnet",
    "networkPassphrase": "Test SDF Network ; September 2015"
  }
}
```

#### TypeScript SDK Usage

```typescript
import { getNetwork } from '@ancore/wallet-api';

const network = await getNetwork(); // 'mainnet' | 'testnet' | 'futurenet' | 'local'
```

---

### 6. `isConnected`

Silent check to verify whether the dApp origin is currently allowlisted for the active smart account on the current network. Never prompts the user.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "50c4bb21-2ef3-4011-8c43-c90a82e9b08f",
  "method": "isConnected",
  "params": {}
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "50c4bb21-2ef3-4011-8c43-c90a82e9b08f",
  "ok": true,
  "result": {
    "connected": true
  }
}
```

#### TypeScript SDK Usage

```typescript
import { isConnected } from '@ancore/wallet-api';

if (await isConnected()) {
  // Safe to read address without user prompt
}
```

---

### 7. `getSmartAccount`

Ancore-specific extension method providing full smart account status, including on-chain contract deployment verification via Soroban RPC.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "79b32948-43ec-44f2-a0bb-2647cbf2ad6a",
  "method": "getSmartAccount",
  "params": {}
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "79b32948-43ec-44f2-a0bb-2647cbf2ad6a",
  "ok": true,
  "result": {
    "contractId": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "deploymentStatus": "deployed",
    "network": "testnet"
  }
}
```

| Deployment Status | Meaning |
|---|---|
| `"deployed"` | Contract is initialized and live on the network (verified via RPC simulation). |
| `"not_deployed"` | Account address is derived/configured, but contract instance is not found on-chain. |
| `"pending"` | Deployment transaction is currently being processed. |
| `"unknown"` | Network/RPC unreachable; status could not be verified. |

#### TypeScript SDK Usage

```typescript
import { getSmartAccount } from '@ancore/wallet-api';

const account = await getSmartAccount();
if (account.deployed) {
  console.log(`Ready for Soroban calls: ${account.smartAccountId}`);
}
```

---

### 8. `signTransaction`

Requests user signature on a Stellar / Soroban transaction XDR. Opens an approval window displaying transaction details, operations, memo, and estimated fee.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "e1586a51-93c1-4775-bf7d-5a93d4040bf5",
  "method": "signTransaction",
  "params": {
    "xdr": "AAAAAgAAAADl3J8VvW249zK...",
    "networkPassphrase": "Test SDF Network ; September 2015",
    "submitViaRelayer": false
  }
}
```

#### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `xdr` | `string` | Yes | Base64-encoded transaction envelope XDR. |
| `networkPassphrase` | `string` | No | Overrides the network passphrase for signature verification. |
| `submitViaRelayer` | `boolean` | No | When `true`, delegates fee payment and submission to the Ancore relayer. |

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "e1586a51-93c1-4775-bf7d-5a93d4040bf5",
  "ok": true,
  "result": {
    "signedXdr": "AAAAAgAAAADl3J8VvW249zK...signed...",
    "txHash": "a1b2c3d4e5f6..."
  }
}
```

#### TypeScript SDK Usage

```typescript
import { signTransaction } from '@ancore/wallet-api';

const { signedXdr, txHash } = await signTransaction({
  xdr: unsignedXdr,
  networkPassphrase: 'Test SDF Network ; September 2015',
  submitViaRelayer: false,
});
```

---

### 9. `signAuthEntry`

Signs a Soroban authorization entry (`SorobanAuthorizationEntry` XDR, SEP-43). Required for invoking smart account methods where the user's contract address is specified in contract credentials.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "5c18ee11-b0e6-4221-a392-7489679fce90",
  "method": "signAuthEntry",
  "params": {
    "authEntry": "AAAAEAAAAAE...",
    "networkPassphrase": "Test SDF Network ; September 2015"
  }
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "5c18ee11-b0e6-4221-a392-7489679fce90",
  "ok": true,
  "result": {
    "signedAuthEntry": "AAAAEAAAAAE...signed..."
  }
}
```

#### Soroban-Specific Behavior
- **Validation Before Prompt:** The wallet validates that `authEntry` is non-empty and valid base64 before opening the approval window. If invalid, fails immediately with `"Invalid auth entry XDR"`.
- **Root Invocation Inspection:** The approval UI decodes the `SorobanAuthorizedInvocation` inside the auth entry, showing the user the exact contract ID, function name, and arguments being authorized.

#### TypeScript SDK Usage

```typescript
import { signAuthEntry } from '@ancore/wallet-api';

const { signedAuthEntry } = await signAuthEntry({
  authEntryXdr: rawAuthEntryXdr,
  networkPassphrase: 'Test SDF Network ; September 2015',
});
```

---

### 10. `signMessage`

Signs an arbitrary UTF-8 string or message challenge (SEP-53 format). Opens an approval screen showing the plain-text message.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "129ae7d9-35da-4856-b072-bc32fa5a7749",
  "method": "signMessage",
  "params": {
    "message": "Authenticate to MyApp at 2026-09-30T12:00:00Z"
  }
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "129ae7d9-35da-4856-b072-bc32fa5a7749",
  "ok": true,
  "result": {
    "signature": "3f4a9b2c..."
  }
}
```

#### TypeScript SDK Usage

```typescript
import { signMessage } from '@ancore/wallet-api';

const { signedMessage } = await signMessage({
  message: 'Authenticate to MyApp at 2026-09-30T12:00:00Z',
});
// signedMessage is the hex-encoded signature
```

---

### 11. `requestSessionKey`

Requests the user's smart account to grant a temporary, scoped **Session Key**. This enables dApps to execute limited interactions (such as automated swaps, gaming actions, or micro-transactions) without prompting user confirmation on every single transaction.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "812fce4d-d79e-4c74-a698-c174345d2e08",
  "method": "requestSessionKey",
  "params": {
    "expiresAt": 1790774400000,
    "permissions": 3,
    "allowedContracts": [
      "CBPDNZG26J2AWZMWWW2I6K5WZEZ6O27Z37PFFC3CJJR7SSQY3U4GZ244"
    ],
    "maxAmountPerCall": "100000000"
  }
}
```

#### Parameters (`SessionKeyPolicy`)

| Field | Type | Required | Description |
|---|---|---|---|
| `expiresAt` | `number` | Yes | Future Unix timestamp in milliseconds when the key expires. |
| `permissions` | `number` | Yes | Non-negative integer bitmask matching on-chain session key permissions. |
| `allowedContracts` | `string[]` | No | Optional array of contract C-addresses the session key is permitted to call. |
| `maxAmountPerCall` | `string` | No | Optional numeric string specifying spend limit per invocation in stroops. |

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "812fce4d-d79e-4c74-a698-c174345d2e08",
  "ok": true,
  "result": {
    "publicKey": "GDUXQWVQ273767...",
    "expiresAt": 1790774400000
  }
}
```

#### TypeScript SDK Usage

```typescript
import { requestSessionKey } from '@ancore/wallet-api';

const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
const sessionKey = await requestSessionKey({
  expiresAt: oneDayFromNow,
  permissions: 1, // e.g. CallContract permission
  allowedContracts: ['CBPDNZG26J2AWZMWWW2I6K5WZEZ6O27Z37PFFC3CJJR7SSQY3U4GZ244'],
  maxAmountPerCall: '50000000', // 5 XLM
});

console.log('Session Public Key:', sessionKey.publicKey);
```

---

### 12. `signRelayPayload`

Signs a canonical meta-transaction envelope designed for submission to the Ancore platform relayer (`/relay/execute`, issue #1213). The wallet generates the session key signature and canonical payload atomically.

#### Wire Request

```json
{
  "type": "ANCORE_WALLET_REQUEST",
  "source": "ancore-wallet-api@1",
  "requestId": "9db2a191-2483-4a11-8e93-27eb69c6e392",
  "method": "signRelayPayload",
  "params": {
    "operation": "transfer",
    "nonce": 42,
    "to": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "amount": "10000000",
    "asset": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
  }
}
```

#### Wire Response

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "9db2a191-2483-4a11-8e93-27eb69c6e392",
  "ok": true,
  "result": {
    "sessionKey": "GBLZX37...",
    "signature": "8a7f9b0c..."
  }
}
```

#### TypeScript SDK Usage

```typescript
import { signRelayPayload } from '@ancore/wallet-api';

const { sessionKey, signature } = await signRelayPayload({
  operation: 'transfer',
  nonce: 1,
  to: recipientAddress,
  amount: '50000000',
  asset: sacContractAddress,
});
```

---

### 13. `addToken`

Token discovery and management in Ancore differs from classic Stellar trustlines:

- **Classic Stellar:** Requires an explicit `ChangeTrust` operation on a classic G-account before receiving non-native assets.
- **Soroban Smart Accounts:** Use **Soroban Asset Contracts (SAC)** or custom token contracts (`C...`). Contracts do not require classic trustlines; balances are stored in contract ledger data.

When migrating from Freighter:
- Freighter's `addToken` (SEP-0007 / watchAsset) adds a classic trustline or notifies the UI to track a token.
- In Ancore, token discovery and tracking are managed through Soroban Asset Contract addresses. dApps can pass token C-addresses when preparing invocations or meta-transactions.
- Future versions of the extension will expose an explicit `watchAsset` / `addToken` external method to pin custom SAC tokens into the extension asset list.

---

## Soroban-Specific Behavior

### Smart Account Identity (C-Address vs G-Address)

Ancore uses the native Soroban account abstraction architecture:
1. Every user has a **Smart Account contract** deployed on-chain (`C...`).
2. The user holds an underlying Ed25519 signer key (`G...`), but this key is an **owner/admin** key, not the primary account.
3. dApps query `getAddress()` and receive `smartAccountId` (`C...`). Smart contract invocations should specify this C-address as the source/caller.

### SEP-43 Soroban Authorization Entries

When invoking Soroban smart contracts on behalf of a smart account:
1. Build the transaction containing the `InvokeHostFunction` operation.
2. The authorization entry requires a signature from the smart account.
3. Call `signAuthEntry({ authEntryXdr })` to prompt the wallet to generate the correct Soroban signature credentials (`SorobanCredentials`).

### Session Keys and Granular Policies

Session keys allow sub-delegation:
- **Time-bound:** Automatically expire after `expiresAt`.
- **Scope-bound:** Limited to specific contracts (`allowedContracts`).
- **Value-bound:** Maximum spend caps (`maxAmountPerCall`).
The extension enforces policies both locally in the background worker and on-chain in the smart account contract.

### Relayer Meta-Transactions and Fee Abstraction

dApps do not need to require users to fund their smart account with native XLM before taking action:
- Transactions marked with `submitViaRelayer: true` or signed via `signRelayPayload` are submitted via the Ancore Relayer service.
- The relayer wraps the invocation in a sponsored transaction envelope, paying gas fees on behalf of the user.

### Contract Deployment Probing

Before submitting contract calls, dApps can check whether the account contract is already deployed on the active network:
```typescript
import { getSmartAccount } from '@ancore/wallet-api';

const { deployed, smartAccountId } = await getSmartAccount();
if (!deployed) {
  // Show prompt explaining the smart account requires initial activation/deployment
}
```

---

## Error Handling & Catalog

### Wire Error Envelope

All failed requests reject the promise with a `WalletApiError`. Over the wire, the response envelope has `ok: false`:

```json
{
  "type": "ANCORE_WALLET_RESPONSE",
  "source": "ancore-content-script@1",
  "requestId": "...",
  "ok": false,
  "error": "<error string>"
}
```

### Error Hierarchy in `@ancore/wallet-api`

```text
Error
 └── WalletApiError
      └── WalletNotInstalledError
```

- **`WalletApiError`**: Base class for all errors thrown by `@ancore/wallet-api`.
- **`WalletNotInstalledError`**: Thrown when the content script does not reply (extension not installed or unavailable).

```typescript
import { WalletApiError, WalletNotInstalledError } from '@ancore/wallet-api';

try {
  await connect();
} catch (err) {
  if (err instanceof WalletNotInstalledError) {
    // Prompt user to install Ancore extension
  } else if (err instanceof WalletApiError) {
    // Handle wallet logic / user rejection error
  }
}
```

---

### Error Catalog

The table below lists all standard error messages generated across the wallet bridge and background handlers:

| Error Message (`error.message`) | Origin | Cause | Recommended Action |
|---|---|---|---|
| `wallet-api requires a browser window` | `@ancore/wallet-api` bridge | Called in SSR / Node.js environment where `window` is undefined | Ensure wallet methods are only called on the client side |
| `Request timed out after 30000ms` | `@ancore/wallet-api` bridge | Bridge received no reply within 30 seconds | Prompt user to install wallet or check if extension is disabled |
| `Ancore extension not detected...` | `WalletNotInstalledError` | No response received within probe timeout | Display "Install Extension" UI |
| `Origin not allowed. Call requestAccess first.` | Background handler | Calling origin is not allowlisted for the active account | Call `connect()` or `requestAccess()` before calling privileged methods |
| `Wallet not set up. Complete onboarding first.` | Background handler | Extension is installed but user has not created/imported a vault | Prompt user to complete wallet onboarding |
| `User rejected the sign request` | Approval UI | User clicked **Reject** in the approval window | Treat as user cancellation; do not display as a fatal failure |
| `Access request was not approved.` | Background handler | User declined origin connection | Cancel connection flow gracefully |
| `Approval request expired after 5 minutes...` | Background handler | Approval window was ignored or left open past the 5-minute timeout | Prompt user to retry the operation |
| `Invalid signTransaction params: ...` | Background handler | Parameter validation failed (e.g. empty or malformed XDR) | Verify transaction builder output |
| `Invalid auth entry XDR` | Background handler | Auth entry string is empty or invalid base64 | Check Soroban auth entry simulation output |
| `Invalid signMessage params: ...` | Background handler | Empty or malformed message payload | Provide non-empty string |
| `Invalid session key params: ...` | Background handler | Policy violates validation rules (e.g. invalid C-address) | Ensure contract addresses follow `C...` format |
| `Session key policy must include a future expiresAt timestamp.` | Background handler | `expiresAt` is in the past or zero | Provide future Unix timestamp in milliseconds |
| `Unknown method: <method>` | Content script | Requested method is not in the allowlist | Verify SDK and extension version compatibility |
| `Unknown external API method: <method>` | Background worker | Method bypassed content script but has no background handler | Check extension version |
| `Invalid origin` / `Origin mismatch` | Service worker | Security violation: sender origin mismatch | Security error; do not retry |

---

### The Two Timeouts Model

When performing operations requiring user approval (`signTransaction`, `signAuthEntry`, `requestSessionKey`, `signMessage`):

1. **dApp Bridge Timeout (30 seconds):** The client-side `sendExternalRequest` timer rejects after 30s by default to prevent hanging client promises.
2. **Wallet Approval Timeout (5 minutes):** The extension background worker keeps the request in the queue for 5 minutes before discarding it.

> **Important:** If a user takes longer than 30 seconds to review a transaction, the dApp bridge may time out while the extension approval window remains open. Always check `isConnected()` or prompt the user before initiating an automatic retry.

---

### Typed Error Handling Pattern

Use the following helper to cleanly classify errors in dApp frontends:

```typescript
import { WalletApiError, WalletNotInstalledError } from '@ancore/wallet-api';

export type WalletErrorKind =
  | 'NOT_INSTALLED'
  | 'USER_REJECTED'
  | 'UNAUTHORIZED'
  | 'NOT_ONBOARDED'
  | 'TIMEOUT'
  | 'INVALID_PARAMS'
  | 'UNKNOWN';

export interface ParsedWalletError {
  kind: WalletErrorKind;
  message: string;
  isUserActionable: boolean;
  canRetry: boolean;
}

export function parseWalletError(error: unknown): ParsedWalletError {
  if (error instanceof WalletNotInstalledError) {
    return {
      kind: 'NOT_INSTALLED',
      message: 'Ancore Wallet extension is not installed.',
      isUserActionable: true,
      canRetry: false,
    };
  }

  if (error instanceof WalletApiError || error instanceof Error) {
    const msg = error.message;

    if (msg.includes('rejected') || msg.includes('not approved')) {
      return {
        kind: 'USER_REJECTED',
        message: 'Request was cancelled by user.',
        isUserActionable: false,
        canRetry: true,
      };
    }

    if (msg.includes('Origin not allowed')) {
      return {
        kind: 'UNAUTHORIZED',
        message: 'Site not connected to wallet. Please connect first.',
        isUserActionable: true,
        canRetry: true,
      };
    }

    if (msg.includes('Wallet not set up')) {
      return {
        kind: 'NOT_ONBOARDED',
        message: 'Wallet onboarding incomplete. Please finish wallet setup.',
        isUserActionable: true,
        canRetry: false,
      };
    }

    if (msg.includes('timed out') || msg.includes('expired')) {
      return {
        kind: 'TIMEOUT',
        message: 'Wallet request timed out. Please try again.',
        isUserActionable: true,
        canRetry: true,
      };
    }

    if (msg.startsWith('Invalid')) {
      return {
        kind: 'INVALID_PARAMS',
        message: `Invalid request payload: ${msg}`,
        isUserActionable: false,
        canRetry: false,
      };
    }
  }

  return {
    kind: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'Unknown wallet error occurred.',
    isUserActionable: false,
    canRetry: true,
  };
}
```

---

## Integration Walkthrough

Below is a complete end-to-end example demonstrating connection, network verification, Soroban contract authorization, and transaction signing:

```typescript
import {
  connect,
  getAddress,
  getNetwork,
  getSmartAccount,
  signTransaction,
  signAuthEntry,
  WalletNotInstalledError,
} from '@ancore/wallet-api';
import { parseWalletError } from './walletErrorHelper';

async function executeDappAction(unsignedTxXdr: string, authEntryXdr?: string) {
  try {
    // 1. Connect dApp to user's smart account
    const smartAccountId = await connect();
    console.log('Connected smart account:', smartAccountId);

    // 2. Validate active network
    const network = await getNetwork();
    if (network !== 'testnet') {
      throw new Error(`Please switch your Ancore Wallet to testnet (currently on ${network})`);
    }

    // 3. Confirm smart account deployment status
    const accountInfo = await getSmartAccount();
    if (!accountInfo.deployed) {
      console.warn('Smart account is not yet deployed on-chain.');
    }

    // 4. If interacting with a contract requiring SEP-43 auth entry:
    if (authEntryXdr) {
      const { signedAuthEntry } = await signAuthEntry({
        authEntryXdr,
      });
      console.log('Signed Auth Entry:', signedAuthEntry);
    }

    // 5. Sign the main transaction envelope
    const { signedXdr } = await signTransaction({
      xdr: unsignedTxXdr,
      submitViaRelayer: false,
    });

    return signedXdr;
  } catch (err) {
    const parsed = parseWalletError(err);
    if (parsed.kind === 'USER_REJECTED') {
      console.log('User cancelled signing.');
      return null;
    }

    console.error(`Wallet operation failed (${parsed.kind}):`, parsed.message);
    throw err;
  }
}
```
