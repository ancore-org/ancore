# Ancore Architecture Overview

This document provides a high-level overview of the Ancore system architecture.

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      User Applications                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Extension   │  │    Mobile    │  │     Web      │      │
│  │    Wallet    │  │    Wallet    │  │  Dashboard   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Ancore SDK
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Core SDK Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Account    │  │   Session    │  │     TX       │      │
│  │     Mgmt     │  │     Keys     │  │   Builder    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Stellar/Soroban Layer                       │
│  ┌──────────────┐                                            │
│  │   Account    │                                            │
│  │   Contract   │                                            │
│  └──────────────┘                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │
                    Stellar Network
```

## Repository Module Map

The main architecture modules are organized as a monorepo. This tree intentionally lists only the top-level product, package, contract, service, and documentation modules that contributors are expected to navigate directly.

<!-- repo-structure-check:start -->

```
ancore/
├── apps/                     # User-facing applications
│   ├── extension-wallet/     # Browser extension wallet
│   ├── mobile-wallet/        # React Native mobile library
│   ├── mobile-app/           # RN host app scaffold (ios/android)
│   └── web-dashboard/        # Web-based account management
│
├── packages/                 # Public SDKs and libraries
│   ├── core-sdk/             # Main SDK for developers
│   ├── account-abstraction/  # Account abstraction primitives
│   ├── stellar/              # Stellar/Soroban utilities
│   ├── crypto/               # Cryptographic utilities
│   ├── ui-kit/               # Shared UI components
│   ├── types/                # Shared TypeScript types
│   ├── wallet-shared/        # dApp protocol, networks, allowlist keys
│   ├── wallet-api/           # npm SDK for dApps (@ancore/wallet-api)
│   └── test-fixtures/        # Shared test fixtures for apps and services
│
├── contracts/                # Soroban smart contracts
│   ├── account/              # Core account contract
│   ├── validation-modules/   # Planned pluggable validation module scaffolds
│   ├── invoice/              # Planned invoice contract scaffolds
│   └── upgrade/              # Planned upgrade contract scaffolds
│
├── services/                 # Optional infrastructure
│   ├── relayer/              # Transaction relay service
│   ├── indexer/              # Blockchain indexer
│   └── ai-agent/             # AI agent MVP (draft-only intents)
│
└── docs/                     # Documentation
    ├── architecture/         # System architecture
    ├── security/             # Security model & audits
    └── user-guide/           # End-user guides
```

<!-- repo-structure-check:end -->

Run `pnpm docs:check-structure` before merging README or architecture changes that add, rename, or remove entries in this tree. Keep this block and the README repository tree in sync; if the check should cover a different set of docs, update `scripts/check-docs-repo-structure.mjs` and the CI workflow in the same change.

## Financial OS Positioning

Ancore is designed as a financial operating system on top of Stellar:

- **Stellar (on-chain)**: settlement, assets, programmable transfer authorization
- **Ancore apps/services (off-chain)**: UX, identity, analytics, compliance workflows, notifications, support tooling

Decision rule:

- If blockchain adds trust/settlement/interoperability value -> use Stellar.
- If traditional software is faster/safer for user experience or operations -> keep it off-chain.

## Core Concepts

### Smart Accounts

Smart accounts are the foundation of Ancore. Unlike traditional accounts that use a single private key for all operations, smart accounts are programmable contracts that can implement custom validation logic.

**Key Features:**

- Custom signature validation
- Multi-signature support
- Session keys for seamless UX
- Upgradeability
- Recovery mechanisms

### Account Abstraction

Ancore brings ERC-4337-style account abstraction to Stellar/Soroban:

1. **Validation**: Custom logic determines if a transaction is valid
2. **Execution**: Transactions are executed on behalf of the account
3. **Paymaster**: Optional third-party fee payment
4. **Bundling**: Multiple operations in a single transaction

### Session Keys

Session keys enable seamless UX by allowing time-limited, permission-scoped signing keys:

- User signs once to create a session
- Session key signs subsequent transactions
- Automatic expiration
- Granular permissions
- Revocable at any time

## Data Flow

### Send Flow {#send-flow}

End-to-end path for an extension wallet payment authorized by a **session key** and submitted through the **relayer**. This matches the production integration shape: build and sign in the client, validate and broadcast via `@ancore/relayer`, enforce rules on the **account contract**, settle on **Horizon**.

| Step | Component | Responsibility |
|------|-----------|----------------|
| 1 | Extension wallet | UX, validation, handle resolution, fee estimate |
| 2 | Core SDK | Build `Operation.payment`, wrap in `execute`, simulate via Soroban RPC, assemble XDR |
| 3 | Extension (background) | Session key signs Soroban auth entry; never exposes owner key |
| 4 | Relayer | `POST /relay/validate` (optional), `POST /relay/execute` — signature + nonce checks |
| 5 | Horizon | Accepts signed envelope from relayer (`StellarClient.submitTransaction`) |
| 6 | Account contract | `execute` verifies session key permissions and nonce, runs inner ops |
| 7 | Extension | Polls relayer/indexer or Horizon for confirmation |

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Ext as Extension Wallet
  participant SDK as Core SDK
  participant RPC as Soroban RPC
  participant Rel as Relayer
  participant Hor as Horizon
  participant Acct as Account Contract

  User->>Ext: Confirm send (to, amount)
  Ext->>Ext: Validate inputs, resolve @handle
  Ext->>RPC: get_nonce (AccountContract)
  RPC-->>Ext: nonce
  Ext->>SDK: AccountTransactionBuilder<br/>payment + execute()
  SDK->>RPC: simulateTransaction
  RPC-->>SDK: footprint and fees
  SDK-->>Ext: transaction XDR
  Ext->>Ext: Session key signs auth entry
  Ext->>Rel: POST /relay/execute<br/>sessionKey, nonce, signature,<br/>signedTransactionXdr
  opt Pre-flight
    Ext->>Rel: POST /relay/validate
    Rel-->>Ext: valid / error
  end
  Rel->>Rel: validateRelay (Ed25519, nonce)
  Rel->>Hor: submitSignedTransaction(XDR)
  Hor->>Acct: execute(sessionKey, operations)
  Acct->>Acct: Check permissions and nonce,<br/>invoke payment operation
  Acct-->>Hor: ledger result
  Hor-->>Rel: transaction hash
  Rel-->>Ext: success + transactionId
  Ext->>Ext: Show confirmed / failed status
```

**Code references**

- Extension send UI: `apps/extension-wallet/src/hooks/useSendTransaction.ts`, `apps/extension-wallet/src/screens/Send/`
- SDK builders: `packages/core-sdk/src/account-transaction-builder.ts`, `packages/core-sdk/src/execute-with-session-key.ts`, `packages/core-sdk/src/send-payment.ts`
- Relayer API: `services/relayer/README.md` (`POST /relay/execute`, `POST /relay/validate`)
- On-chain entrypoint: `contracts/account` — `execute(address, Vec<bytes>)`
- Network submission: `services/relayer/src/services/stellarSubmitter.ts` → `@ancore/stellar` → Horizon

**Alternate path (no relayer):** When the owner key signs directly, `sendPayment()` in `@ancore/core-sdk` can submit through `StellarClient.submitTransaction` without calling the relayer. Session-key sends in the extension are expected to use the relay path above so the owner key stays offline.

### Transaction Flow (summary)

For other operation types (session-key management, contract calls), the same pattern applies: SDK builds the Soroban invocation → client signs → relayer validates and submits → account contract enforces policy → Horizon settles.

### Account Creation

```
1. Generate key pair
   ↓
2. Deploy account contract
   ↓
3. Initialize with owner
   ↓
4. Set up validation modules
   ↓
5. (Optional) Configure recovery
```

## Security Architecture

### Trust Boundaries

1. **User's Private Key**: Ultimate source of authority
2. **Account Contract**: Enforces validation rules
3. **Validation Modules**: Pluggable validation logic
4. **Session Keys**: Limited, scoped permissions
5. **Relayers**: Untrusted transaction submitters

### Security Layers

- **Contract Level**: Validation, access control, nonce management
- **SDK Level**: Transaction building, signing, encryption
- **Application Level**: UI security, phishing protection

## Scalability

### Gas Optimization

- Minimal on-chain storage
- Efficient validation algorithms
- Batch operations
- Off-chain computation where possible

### Relayer Network

Optional relayer network for:

- Meta-transactions
- Gasless transactions
- Transaction batching
- Network fee abstraction

## Integration Points

### For Developers

1. **Core SDK**: JavaScript/TypeScript SDK for building applications
2. **Contract ABIs**: Direct contract interaction
3. **REST API**: Optional backend services
4. **WebSocket**: Real-time updates

### For Users

1. **Browser Extension**: Web3 wallet extension
2. **Mobile Apps**: iOS/Android wallets
3. **Web Dashboard**: Account management interface

## Implementation Status

> **Last verified:** 2026-07-16 against current `main`. Prefer this table over older roadmap checkmarks until `docs/ROADMAP.md` is fully re-synced.

| Component | Status | Notes |
|-----------|--------|-------|
| Smart account contract | ✅ Implemented | Core account + session keys; external audit still required for mainnet |
| Session keys (contract) | ✅ Implemented | `allowed_contracts` / spend limits / validation-module hooks landed; UI wiring still partial |
| AA SDK (TypeScript) | ✅ Implemented | AccountContract, execute, relay-payload, transaction-builder, PasskeyModule |
| Extension vault + lock | ✅ Implemented | AES-GCM, PBKDF2, inactivity lock, unlock rate limit |
| Extension onboarding | 🔄 Partial | Vault-backed `OnboardingFlow` + deploy path exist; dual/demo unlock residual remains |
| Extension send flow | 🔄 Partial | Production `SendService` + background `SIGN_TRANSACTION`; fee estimate simplified; e2e testnet path not fully gated |
| Extension dApp API | 🔄 Partial | Content script, `@ancore/wallet-api`, allowlist, grant-access, sign handlers present; some MVP mocks remain |
| Approval UX routes | ✅ Implemented | grant-access / sign / session-key approval + side panel setting |
| WebAuthn / Passkey | 🔄 SDK present | `PasskeyModule` in account-abstraction; full onboarding UX not productized |
| Relayer security | 🔄 Partial | Real submit path + optional mock via `RELAYER_USE_MOCK_SUBMISSION`; rate limiting present |
| AI agent LLM | ⚠️ Draft MVP | Health + draft-intent only; no autonomous execution |
| Mobile WalletConnect | 🔄 Partial | Deep link / handlers scaffolded; mobile sign service still mock |
| Mobile native apps | 🔄 Scaffold | `mobile-wallet` library + `mobile-app` RN host (ios/android); not store-ready |
| Indexer contract events | 🔄 Partial | Contract events API / activity endpoints present; keep hardening vs product docs |

## Roadmap Summary

See [ROADMAP.md](../ROADMAP.md) for the full 5-phase plan. Short version:

- **Phase 1** — Extension real-money path: onboarding, background signing, send flow, session persistence
- **Phase 2** — dApp connectivity: wallet-api, content script, allowlist, signAuthEntry, side panel
- **Phase 3** — Security parity: Blockaid, memo checks, expanded e2e
- **Phase 4** — Mobile productionization: vault unify, keychain, WalletConnect, Fastlane
- **Phase 5** — AA differentiation: session key scoping, passkey onboarding, relayer meta-tx, indexer AA events

## Long-Term Architecture (Post-MVP)

- WebAuthn/Passkey as primary auth (no seed phrase for users)
- Session key policy scoping: contract allowlists, spend limits, time windows
- Decentralized relayer network for censorship resistance
- Cross-chain support via Stellar bridges
- zk-proof validation modules for privacy-preserving auth
- AI-powered financial agent with autonomous execution (after human-confirmation MVP)

## Related Documents

- [ROADMAP.md](../ROADMAP.md)
- [Integration guide](../integration-guide.md)
- [Account Contract](../../contracts/account/README.md)
- [Security Model](../security/THREAT_MODEL.md)
- [Freighter Comparison](../wallets/FREIGHTER_COMPARISON.md)

---

> Note: Planned contract and service scaffolds are intentionally present in the repository layout so contributors can preserve the architecture direction without implying production completeness.

**Last Updated**: June 2026
