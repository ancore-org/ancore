# Ancore dApp API Reference & Message Protocol

> Canonical specification for dApp communication with the Ancore wallet extension.  
> Covers message envelopes, request/response schemas, all external API methods, Soroban-specific account abstraction behaviors, and Freighter compatibility.

---

## 1. Architecture & Communication Protocol

dApps communicate with the Ancore wallet extension via an asynchronous bidirectional bridge using `window.postMessage`, mediated by an isolated content script and background service worker.

### 1.1 Bridge Topology

```
┌─────────────────┐       window.postMessage        ┌────────────────────────┐
│    dApp Page    │ ◄─────────────────────────────► │ Content Script Bridge  │
│ (@ancore/       │  ANCORE_WALLET_REQUEST          │ (Origin Filter &       │
│  wallet-api)    │  ANCORE_WALLET_RESPONSE         │  Method Allowlist)     │
└─────────────────┘                                 └──────────┬─────────────┘
                                                               │ chrome.runtime
                                                               │ .sendMessage
                                                    ┌──────────▼─────────────┐
                                                    │ Background Service     │
                                                    │ Worker & Allowlist     │
                                                    └──────────┬─────────────┘
                                                               │ Enqueue / Popup
                                                    ┌──────────▼─────────────┐
                                                    │ User Approval UI       │
                                                    │ (Popup / Side Panel)   │
                                                    └────────────────────────┘
```

### 1.2 Two-Layer Security Model

1. **Layer 1 — Content Script Prefilter (`content-script/index.ts`)**:
   - Validates `event.origin` against permitted protocols (`http:`, `https:`).
   - Rejects blacklisted prefixes (`chrome-extension://`, `chrome://`, `file://`, `blob:`, `data:`).
   - Verifies that `event.origin === window.location.origin`.
   - Enforces an authoritative whitelist of `ExternalApiMethodName`. Unknown methods are dropped before reaching background.
2. **Layer 2 — Background Allowlist (`background/handlers/external/allowlist.ts`)**:
   - Authoritative security boundary running in the isolated extension service worker.
   - Verifies sender origin and maintains a persistent allowlist keyed by `(network, smartAccountId, origin)`.
   - Privileged methods require prior authorization via `requestAccess` / `connect`.

### 1.3 Message Envelopes

#### Request Envelope (`ANCORE_WALLET_REQUEST`)

Sent from the dApp page to the content script:

```typescript
interface ExternalRequestEnvelope {
  /** Identifier constant: 'ANCORE_WALLET_REQUEST' */
  type: 'ANCORE_WALLET_REQUEST';
  /** Source tag identifying SDK version: 'ancore-wallet-api@1' */
  source: 'ancore-wallet-api@1';
  /** Unique UUID for correlating async responses (response queue pattern) */
  requestId: string;
  /** API method name */
  method: ExternalApiMethodName;
  /** Method-specific parameters */
  params?: Record<string, unknown>;
}
```

#### Response Envelope (`ANCORE_WALLET_RESPONSE`)

Returned from the content script to the dApp page:

```typescript
interface ExternalResponseEnvelope {
  /** Identifier constant: 'ANCORE_WALLET_RESPONSE' */
  type: 'ANCORE_WALLET_RESPONSE';
  /** Source tag identifying content script: 'ancore-content-script@1' */
  source: 'ancore-content-script@1';
  /** Correlation UUID matching the request */
  requestId: string;
  /** Whether the operation succeeded */
  ok: boolean;
  /** Result payload on success */
  result?: unknown;
  /** Error message on failure */
  error?: string;
}
```

---

## 2. External API Methods

### Summary Matrix

| Method | Description | Requires Allowlist / User Approval | Freighter Equivalent |
|---|---|---|---|
| [`requestAccess`](#requestaccess) | Connect dApp to wallet and request permissions | Yes (User prompt if not allowlisted) | `requestAccess` |
| [`connect`](#connect) | Connect and return smart account address | Yes (User prompt if not allowlisted) | `requestAccess` |
| [`getAddress`](#getaddress) | Get active smart account address without prompt | Yes (Cached allowlist check) | `getAddress` |
| [`getNetwork`](#getnetwork) | Get active Stellar network name | No (Public read) | `getNetwork` |
| [`isConnected`](#isconnected) | Check if origin is allowlisted | No (Public check) | `isConnected` |
| [`getSmartAccount`](#getsmartaccount) | Get smart account metadata and deployment status | Yes (Cached allowlist check) | *(Ancore specific)* |
| [`getPublicKey`](#getpublickey) | Get public identity of the account | Yes (Cached allowlist check) | `getPublicKey` |
| [`signTransaction`](#signtransaction) | Sign transaction XDR (supports AA relayer submit) | Yes (User confirmation UI) | `signTransaction` |
| [`signAuthEntry`](#signauthentry) | Sign Soroban SEP-43 authorization entry | Yes (User confirmation UI) | `signAuthEntry` |
| [`signMessage`](#signmessage) | Sign arbitrary message with owner key | Yes (User confirmation UI) | `signMessage` |
| [`requestSessionKey`](#requestsessionkey) | Request delegated session key with scoped policy | Yes (User confirmation UI) | *(Ancore specific)* |
| [`signRelayPayload`](#signrelaypayload) | Sign canonical gasless meta-transaction payload | Yes (User confirmation UI) | *(Ancore specific)* |
| [`addToken`](#addtoken) | Request adding a SAC token or trustline | Yes (User confirmation UI) | *(Freighter token UI)* |

---

### `requestAccess`

Prompts the user to connect their smart account to the dApp origin. If already allowlisted for the active network and account, resolves immediately.

#### Request

```typescript
// Method: 'requestAccess'
// Params: None (or optional prompt reason)
```

#### Response (`RequestAccessResult`)

```json
{
  "smartAccountId": "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
  "ownerPublicKey": "GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN",
  "network": "testnet"
}
```

- `smartAccountId`: Deployed Soroban smart account contract ID (`C...`).
- `ownerPublicKey`: Owner Ed25519 public key (`G...`), useful for Horizon balance/signer queries.
- `network`: Active network name (`testnet`, `mainnet`, `futurenet`, `local`).

#### TypeScript SDK Example

```typescript
import { requestAccess } from '@ancore/wallet-api';

try {
  const access = await requestAccess();
  console.log('Connected smart account:', access.smartAccountId);
  console.log('Owner public key:', access.ownerPublicKey);
  console.log('Network:', access.network);
} catch (err) {
  console.error('Connection rejected by user:', err);
}
```

---

### `connect`

Convenience wrapper around `requestAccess` that resolves directly to the smart account contract ID string.

#### Request

```typescript
// Method: 'connect'
// Params: None
```

#### Response

```json
"CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE"
```

#### TypeScript SDK Example

```typescript
import { connect } from '@ancore/wallet-api';

const smartAccountId = await connect();
```

---

### `getAddress`

Returns the connected smart account address without opening a prompt if the origin has already been allowlisted. Throws `WalletNotInstalledError` if the extension does not respond within timeout (500ms).

#### Request

```typescript
// Method: 'getAddress'
// Params: None
```

#### Response (`GetAddressResult`)

```json
{
  "smartAccountId": "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
  "ownerPublicKey": "GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN"
}
```

#### TypeScript SDK Example

```typescript
import { getAddress } from '@ancore/wallet-api';

const { smartAccountId, ownerPublicKey } = await getAddress();
```

---

### `getNetwork`

Returns the active Stellar network configured in the wallet. Does not require user approval or prior connection.

#### Request

```typescript
// Method: 'getNetwork'
// Params: None
```

#### Response

```json
"testnet"
```

*Supported values*: `"mainnet" | "testnet" | "futurenet" | "local"`.

#### TypeScript SDK Example

```typescript
import { getNetwork } from '@ancore/wallet-api';

const network = await getNetwork(); // 'mainnet' | 'testnet' | 'futurenet' | 'local'
```

---

### `isConnected`

Checks whether the current origin is allowlisted for the active smart account on the active network.

#### Request

```typescript
// Method: 'isConnected'
// Params: None
```

#### Response

```json
true
```

#### TypeScript SDK Example

```typescript
import { isConnected } from '@ancore/wallet-api';

if (await isConnected()) {
  console.log('dApp is authorized');
}
```

---

### `getSmartAccount`

Returns comprehensive metadata regarding the smart account contract, including on-chain deployment status.

#### Request

```typescript
// Method: 'getSmartAccount'
// Params: None
```

#### Response (`GetSmartAccountResult`)

```json
{
  "contractId": "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
  "deploymentStatus": "deployed",
  "network": "testnet",
  "ownerPublicKey": "GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN"
}
```

- `deploymentStatus`:
  - `"deployed"`: Account contract exists on-chain and responded to RPC probe.
  - `"pending"`: Account deployment transaction has been submitted and is awaiting inclusion.
  - `"not_deployed"`: Counterfactual address derived deterministically, contract has not yet been initialized on-chain.
  - `"unknown"`: RPC check encountered a transient network/infra failure.

#### TypeScript SDK Example

```typescript
import { getSmartAccount } from '@ancore/wallet-api';

const account = await getSmartAccount();
if (account.deploymentStatus === 'not_deployed') {
  console.log('Contract is counterfactual — will deploy on first sponsored call');
}
```

---

### `getPublicKey`

Returns the primary public identity of the account. In Ancore account abstraction, this returns the deployed smart-account `C...` contract identifier.

#### Request

```typescript
// Method: 'getPublicKey'
// Params: None
```

#### Response

```json
{
  "publicKey": "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE"
}
```

---

### `signTransaction`

Requests user signature on a Stellar or Soroban transaction envelope XDR. The extension validates the XDR, parses operations, performs Soroban simulation preview, and prompts the user for approval.

#### Request Parameters (`SignTransactionParams`)

```typescript
interface SignTransactionParams {
  /** Base64-encoded Stellar TransactionEnvelope XDR */
  xdr: string;
  /** Target network passphrase (optional; defaults to wallet active network) */
  networkPassphrase?: string;
  /** When true, submits the transaction via the Ancore Relayer after signing */
  submitViaRelayer?: boolean;
}
```

#### Response (`SignTransactionResult`)

```json
{
  "signedXdr": "AAAAAgAAAAA...",
  "txHash": "a1b2c3d4e5f6..."
}
```

#### TypeScript SDK Example

```typescript
import { signTransaction } from '@ancore/wallet-api';

const result = await signTransaction({
  xdr: 'AAAAAgAAAAB...',
  networkPassphrase: 'Test SDF Network ; September 2015',
  submitViaRelayer: false,
});
console.log('Signed XDR:', result.signedXdr);
```

---

### `signAuthEntry`

Signs a Soroban `SorobanAuthorizationEntry` (SEP-43). Used for cross-contract authorizations, SAC token approvals, and meta-invocations without submitting a full transaction envelope.

#### Request Parameters

```typescript
interface SignAuthEntryParams {
  /** Base64-encoded SorobanAuthorizationEntry XDR */
  authEntryXdr: string;
  /** Network passphrase */
  networkPassphrase?: string;
}
```

#### Response

```json
{
  "signedAuthEntry": "AAAAAgAAAAC..."
}
```

#### TypeScript SDK Example

```typescript
import { signAuthEntry } from '@ancore/wallet-api';

const { signedAuthEntry } = await signAuthEntry({
  authEntryXdr: rawAuthEntryXdr,
});
```

---

### `signMessage`

Signs an arbitrary binary or text payload using the account's signing key (SEP-53 format).

#### Request Parameters

```typescript
interface SignMessageParams {
  /** Plaintext message or hex-encoded string to sign */
  message: string;
  /** Network passphrase */
  networkPassphrase?: string;
}
```

#### Response

```json
{
  "signedMessage": "9a8b7c6d5e4f..."
}
```

*Note: Returns hex-encoded Ed25519 signature string.*

#### TypeScript SDK Example

```typescript
import { signMessage } from '@ancore/wallet-api';

const { signedMessage } = await signMessage({
  message: 'Authenticate session for dApp xyz at timestamp 1714000000',
});
```

---

### `requestSessionKey`

Requests the user to grant a delegated, scoped session key on their smart account. The extension prompts the user with permission scopes, allowed contract targets, duration, and maximum spend limits.

#### Request Parameters (`SessionKeyPolicy`)

```typescript
interface SessionKeyPolicy {
  /** Unix timestamp in seconds when the session key must expire */
  expiresAt: number;
  /** Additive permission flags (0 = SEND_PAYMENT, 1 = MANAGE_DATA, 2 = INVOKE_CONTRACT) */
  permissions: number | number[];
  /** Allowed target contract C... addresses (optional; empty = unrestricted) */
  allowedContracts?: string[];
  /** Maximum payment amount authorized per call in decimal format (e.g. "50.0") */
  maxAmountPerCall?: string;
  /** Total spend budget authorized across the lifetime of the session key */
  spendLimit?: {
    asset: string;
    maxAmount: string;
  };
}
```

#### Response (`RequestSessionKeyResult`)

```json
{
  "sessionKey": {
    "publicKey": "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTOO",
    "permissions": [0, 2],
    "expiresAt": 1714003600,
    "label": "Swap Bot Key"
  },
  "transactionHash": "8f3b..."
}
```

#### TypeScript SDK Example

```typescript
import { requestSessionKey } from '@ancore/wallet-api';

const session = await requestSessionKey({
  expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  permissions: [0, 2], // SEND_PAYMENT and INVOKE_CONTRACT
  allowedContracts: ['CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'],
  maxAmountPerCall: '10.0',
});

console.log('Delegated session key public key:', session.sessionKey.publicKey);
```

---

### `signRelayPayload`

Generates and signs a canonical gasless meta-transaction payload for execution via the Ancore platform relayer (`/relay/execute`). Atomically computes the required session key and returns the signature and public key together.

#### Request Parameters

```typescript
interface SignRelayPayloadParams {
  /** Contract operation name (e.g. 'transfer') */
  operation: string;
  /** Current account nonce for replay protection */
  nonce: number;
  /** Destination address (G... or C...) */
  to: string;
  /** Decimal transfer amount (e.g. '25.5000000') */
  amount: string;
  /** Asset identifier ('native' or 'CODE:ISSUER' or SAC C-address) */
  asset: string;
}
```

#### Response (`SignRelayPayloadResult`)

```json
{
  "sessionKey": "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTOO",
  "signature": "c4d5e6f7a8b9..."
}
```

#### TypeScript SDK Example

```typescript
import { signRelayPayload } from '@ancore/wallet-api';

const relayPayload = await signRelayPayload({
  operation: 'transfer',
  nonce: 4,
  to: 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN',
  amount: '50.0000000',
  asset: 'native',
});

// Submit to platform relayer endpoint:
// POST /relay/execute with { ...relayPayload }
```

---

### `addToken`

Requests the wallet to track or establish a trustline / Soroban SAC token entry for a specific asset.

#### Request Parameters

```typescript
interface AddTokenParams {
  /** Token type: 'soroban' for SAC contracts, or classic 'credit_alphanum4' / 'credit_alphanum12' */
  type: 'soroban' | 'credit_alphanum4' | 'credit_alphanum12';
  /** Asset code (e.g. 'USDC', 'EURC') */
  code: string;
  /** Issuer G-address (for classic Stellar assets) */
  issuer?: string;
  /** Soroban contract C-address (for SAC / SEP-41 tokens) */
  contractId?: string;
}
```

#### Response

```json
{
  "success": true,
  "asset": "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
}
```

---

## 3. Soroban-Specific Account Abstraction Details

### 3.1 Smart Account Identity (`C...`) vs Owner Key (`G...`)

Classic Stellar wallets represent identity via an Ed25519 public key starting with `G...`. In Ancore:
- The **Smart Account Address** is a Soroban Contract ID (`C...`).
- The **Owner Key** (`G...`) holds administrative keys and passes signatures to the contract.
- Invocations to protocols (e.g. Soroswap, Blend) identify the user by their `C...` address.

```
Smart Account Identity: C... (Passed to Soroban contracts as Address)
  └── Owner Key: G... (Used to sign SorobanAuthorizationEntries & admin ops)
  └── Session Keys: [G1..., G2...] (Delegated keys with scoped policies)
```

### 3.2 CREATE2-Style Counterfactual Address Derivation

Smart account addresses are deterministically pre-computed offline before contract deployment:

$$\text{Preimage} = \text{HashIdPreimage::ContractId}(\text{NetworkId}, \text{FromAddress}(\text{Deployer: } \text{Owner}, \text{Salt: } 0^{32}))$$

$$\text{ContractId} = \text{StrKey::encodeContract}(\text{SHA256}(\text{Preimage}))$$

This allows dApps to:
1. Receive incoming payments to the `C...` address immediately.
2. Deploy the smart contract lazily on the first outgoing transaction or gasless relay call.

### 3.3 Nonce Management & Replay Protection

Smart account contract execution uses an on-chain monotonic `nonce` stored in the contract's persistent storage, separate from Stellar account sequence numbers:
- Reading current nonce: `client.getNonce()`
- When executing transactions with session keys, the nonce must match `expected_nonce` in `execute(to, function, args, expected_nonce, ...)`.
- The Ancore SDK and Relayer handle nonce synchronization and automatic retry on nonce drift (`NONCE_DRIFT_RETRY_GUIDANCE`).

### 3.4 Soroban Storage TTL Management

Soroban contract state entries have a time-to-live (TTL) measured in ledgers. Active session keys and account data entries must have their TTL refreshed periodically:
- `refresh_session_key_ttl(public_key)`: Extends the Soroban persistent storage TTL without altering the logical expiry timestamp (`expires_at`).
- If an account state entry expires, the wallet or relayer issues a `RestoreFootprintOp` before invoking the contract.

---

## 4. Error Hierarchy & Codes

When a request fails, the response envelope contains `ok: false` and a descriptive `error` message or canonical error code.

```
WalletApiError
├── WalletNotInstalledError     (Extension not found or timeout > 500ms)
├── UserRejectedError           (User rejected approval window)
├── UnauthorizedError           (Origin not in allowlist)
├── InvalidParamsError          (Zod schema validation failed)
├── UnsupportedMethodError      (Method not in content-script whitelist)
├── AccountLockedError          (Wallet is locked)
├── SimulationFailedError       (Soroban transaction simulation returned error)
└── NonceMismatchError          (Contract nonce drift detected)
```

### Error Code Reference

| Code | HTTP / RPC Status | Description | Recommended Recovery |
|---|---|---|---|
| `WALLET_NOT_INSTALLED` | — | Content script not injected or extension unresponsive | Prompt user to install Ancore extension |
| `USER_REJECTED` | `4001` | User dismissed approval modal or clicked "Reject" | Notify user and allow retry |
| `UNAUTHORIZED` | `4100` | Origin not permitted to call privileged method | Call `requestAccess()` first |
| `INVALID_PARAMS` | `-32602` | Request payload failed schema validation | Verify parameters match TypeScript interfaces |
| `UNSUPPORTED_METHOD` | `-32601` | Method name unrecognized by content script bridge | Check method spelling against `ExternalApiMethod` |
| `LOCKED` | `4900` | Wallet is locked; user must enter password | Open extension unlock prompt |
| `SIMULATION_FAILED` | `-32000` | Soroban RPC transaction simulation reverted | Check contract preconditions and account balance |
| `NONCE_MISMATCH` | `-32001` | Contract nonce changed between simulation and submit | Re-fetch `getNonce()` and rebuild transaction |

---

## 5. Migration from `@stellar/freighter-api`

`@ancore/wallet-api` maintains drop-in compatibility for standard Stellar operations while extending support for Soroban Smart Accounts.

### Comparison Table

| Feature | `@stellar/freighter-api` | `@ancore/wallet-api` |
|---|---|---|
| Connect | `requestAccess()` → `string` (G-address) | `requestAccess()` → `{ smartAccountId, ownerPublicKey, network }` |
| Address | `getAddress()` → `{ address: 'G...' }` | `getAddress()` → `{ smartAccountId: 'C...', ownerPublicKey: 'G...' }` |
| Sign Transaction | `signTransaction(xdr, opts)` | `signTransaction({ xdr, networkPassphrase, submitViaRelayer })` |
| Sign Auth Entry | `signAuthEntry(entryXdr)` | `signAuthEntry({ authEntryXdr, networkPassphrase })` |
| Session Keys | ❌ Unsupported | ✅ `requestSessionKey(policy)` |
| Gasless Meta-Tx | ❌ Unsupported | ✅ `signRelayPayload(params)` |
| Deployment Status | ❌ N/A | ✅ `getSmartAccount()` (`deployed`, `not_deployed`) |

### Example: Migrating a dApp Connection

```typescript
// ── Before (Freighter): ──────────────────────────────────────────────────────
import { getAddress, isConnected, requestAccess } from '@stellar/freighter-api';

if (!(await isConnected())) {
  await requestAccess();
}
const { address } = await getAddress(); // G...

// ── After (Ancore): ──────────────────────────────────────────────────────────
import { getAddress, isConnected, requestAccess } from '@ancore/wallet-api';

if (!(await isConnected())) {
  const { smartAccountId, ownerPublicKey } = await requestAccess();
  console.log('Contract Account:', smartAccountId); // C...
} else {
  const { smartAccountId } = await getAddress();
  console.log('Contract Account:', smartAccountId); // C...
}
```
