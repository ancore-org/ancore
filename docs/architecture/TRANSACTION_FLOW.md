# Transaction Flow: dApp to Stellar

This diagram shows the normal transaction path when a dApp asks the Ancore
browser extension to send a transaction. The vault and the relayer have
different jobs: the vault authorizes a request locally, while the relayer can
submit it but cannot access the owner's secret.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant App as dApp
  participant Extension as Ancore extension
  participant Vault as Encrypted vault
  participant Session as Session key
  participant Relayer as Relayer
  participant Stellar as Stellar / Soroban
  participant Contract as Smart account contract

  User->>App: Approve transaction
  App->>Extension: Request transaction
  Extension->>Extension: Check account, network, and request details
  alt Session key is active and permitted
    Extension->>Session: Sign scoped authorization
    Note over Session: Time-limited permissions;<br/>owner key stays in vault
  else Owner approval is required
    Extension->>Vault: Unlock locally and sign
    Note over Vault: Owner key never leaves<br/>the user's device
  end
  Extension->>Relayer: Signed transaction and authorization
  Relayer->>Relayer: Validate signature and nonce
  Relayer->>Stellar: Submit transaction
  Stellar->>Contract: Execute requested operation
  Contract->>Contract: Enforce owner/session-key policy
  Contract-->>Stellar: Result
  Stellar-->>Relayer: Transaction status
  Relayer-->>Extension: Transaction ID and status
  Extension-->>App: Result for the user
```

## Where each responsibility lives

| Component | What it does | What it does not do |
| --- | --- | --- |
| dApp | Requests a transaction and displays the result. | Access the vault or private keys. |
| Extension | Presents the request, applies wallet checks, and coordinates signing. | Send the owner key to the dApp or relayer. |
| Vault | Stores the owner's signing material encrypted on the user's device. | Sign without a local unlock or approval. |
| Session key | Signs only actions covered by its permissions and expiry. | Replace the owner key for unrestricted actions. |
| Relayer | Verifies relay inputs and submits the signed transaction. | Read the owner's private key or bypass contract policy. |
| Smart account contract | Verifies authorization, nonce, and session-key permissions on-chain. | Store an unencrypted user vault. |

For the implementation-level sequence, including simulation and Horizon
submission, see the [send flow](OVERVIEW.md#send-flow). For how to create and
revoke a scoped authorization, see the [session-key lifecycle example](../examples/session-key-lifecycle.md).
