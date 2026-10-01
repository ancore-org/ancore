# Ancore dApp API Reference

This document outlines the standard message types and response formats for interacting with the Ancore dApp ecosystem, primarily through wallet extensions or similar interfaces.

All requests and responses follow a JSON-RPC-like structure, typically including a `method` and `params` for requests, and a `result` or `error` for responses.

## Common Message Structure

### Request
```json
{
  "id": "unique-request-id",
  "method": "methodName",
  "params": {
    // Method-specific parameters
  }
}
```

### Response (Success)
```json
{
  "id": "unique-request-id",
  "result": {
    // Method-specific result data
  }
}
```

### Response (Error)
```json
{
  "id": "unique-request-id",
  "error": {
    "code": -32000, // Standard JSON-RPC error code or custom
    "message": "Error description",
    "data": {
      // Optional additional error data
    }
  }
}
```

## dApp Message Types

### 1. `requestAccess`

Requests access to the user's public key and account ID. This method typically prompts the user for permission to connect their wallet.

#### Request
- **Method**: `requestAccess`
- **Params**: None

```json
{
  "id": "1",
  "method": "requestAccess",
  "params": {}
}
```

#### Response
- **Result**: An object containing the `publicKey` (Stellar account ID) of the connected wallet.

```json
{
  "id": "1",
  "result": {
    "publicKey": "G...YOUR_PUBLIC_KEY...Z"
  }
}
```

### 2. `signTransaction`

Requests the user to sign a Stellar transaction.

#### Request
- **Method**: `signTransaction`
- **Params**:
    - `xdr`: (string) The base64-encoded XDR of the transaction to sign.
    - `network`: (string) The Stellar network to sign for. Valid values: `"public"`, `"testnet"`, or a custom passphrase.
    - `accountToSign`: (string, optional) The public key of the account that is expected to sign the transaction. If not provided, the wallet will attempt to sign with the currently connected account.

```json
{
  "id": "2",
  "method": "signTransaction",
  "params": {
    "xdr": "AAAA...base64XDR...",
    "network": "testnet",
    "accountToSign": "G...SIGNING_ACCOUNT_PUBLIC_KEY...Z"
  }
}
```

#### Response
- **Result**: An object containing the `signedXDR` (base64-encoded XDR of the signed transaction).

```json
{
  "id": "2",
  "result": {
    "signedXDR": "AAAA...base64SignedXDR..."
  }
}
```

#### Soroban-specific Notes for `signTransaction`

When dealing with Soroban transactions (e.g., `invokeHostFunction`), the `xdr` provided will typically be a `Transaction` or `FeeBumpTransaction` containing the Soroban operations. The signing process remains the same, but developers should be aware of:

-   **Pre-flight simulation**: It's highly recommended to simulate Soroban transactions using RPC endpoints (e.g., `simulateTransaction`) before prompting the user to sign, to estimate resources and identify potential errors.
-   **Fee Bump Transactions**: Soroban transactions often involve `FeeBumpTransaction`s to cover resource fees. The wallet should correctly handle signing the inner transaction and then the outer fee bump transaction if applicable. The `xdr` parameter can contain either a simple `Transaction` or a `FeeBumpTransaction`.

### 3. `signAuthEntry`

Requests the user to sign a Soroban `AuthEntry`. This is used for authorizing contract invocations on behalf of an account.

#### Request
- **Method**: `signAuthEntry`
- **Params**:
    - `authEntryXdr`: (string) The base64-encoded XDR of the `AuthEntry` to sign.
    - `network`: (string) The Stellar network. Valid values: `"public"`, `"testnet"`, or a custom passphrase.

```json
{
  "id": "3",
  "method": "signAuthEntry",
  "params": {
    "authEntryXdr": "AAAA...base64AuthEntryXDR...",
    "network": "testnet"
  }
}
```

#### Response
- **Result**: An object containing the `signedAuthEntryXdr` (base64-encoded XDR of the signed `AuthEntry`).

```json
{
  "id": "3",
  "result": {
    "signedAuthEntryXdr": "AAAA...base64SignedAuthEntryXDR..."
  }
}
```

### 4. `addToken`

Requests the user to add a custom asset (token) to their wallet's display list. This does not create a trustline but helps the wallet track and display the asset.

#### Request
- **Method**: `addToken`
- **Params**:
    - `assetCode`: (string) The asset code (e.g., "USDC", "XLM").
    - `issuer`: (string) The public key of the asset issuer. For native XLM, this parameter is omitted or can be an empty string.
    - `network`: (string) The Stellar network. Valid values: `"public"`, `"testnet"`, or a custom passphrase.

```json
{
  "id": "4",
  "method": "addToken",
  "params": {
    "assetCode": "USDC",
    "issuer": "G...ISSUER_PUBLIC_KEY...Z",
    "network": "public"
  }
}
```

#### Response
- **Result**: An object indicating success. Typically, a boolean `success` field.

```json
{
  "id": "4",
  "result": {
    "success": true
  }
}
```

## Soroban-specific Considerations

Beyond the specific `signAuthEntry` method and `signTransaction` notes, developers building Soroban dApps should be aware of:

-   **Resource Fees**: Soroban transactions consume resources (CPU, memory, ledger entries). These are paid for by the transaction's fee, often via `FeeBumpTransaction`s.
-   **Contract IDs**: Soroban contracts are identified by `Contract ID`s, which are distinct from Stellar account IDs.
-   **Invocation Flow**: The typical flow involves:
    1.  Constructing an `invokeHostFunction` operation.
    2.  Simulating the transaction to estimate resources and get `AuthEntry`s.
    3.  Requesting `signAuthEntry` for any required authorizations.
    4.  Building the final `Transaction` (potentially a `FeeBumpTransaction`).
    5.  Requesting `signTransaction`.
    6.  Submitting the signed transaction to the network.
