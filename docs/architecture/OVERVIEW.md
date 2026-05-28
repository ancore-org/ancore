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

### Transaction Flow

```
1. User initiates transaction
   ↓
2. Wallet creates UserOp
   ↓
3. Session key signs (if available)
   ↓
4. Submit to relayer (optional)
   ↓
5. Relayer submits to network
   ↓
6. Account contract validates
   ↓
7. Transaction executes
   ↓
8. Events emitted
```

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

## Future Architecture

### Planned Enhancements

- [ ] Cross-chain support via bridges
- [ ] Privacy features (zk-proofs)
- [ ] Advanced recovery mechanisms
- [ ] Decentralized relayer network
- [ ] AI-powered financial agent

## Related Documents

- [Account Model](./ACCOUNT_MODEL.md)
- [Session Keys](./SESSION_KEYS.md)
- [Security Model](../security/THREAT_MODEL.md)
- [API Reference](../api/REFERENCE.md)

---

> Note: Additional contract modules (validation, invoice, etc.) remain planned
> roadmap items and are not part of the current repository layout.

**Last Updated**: April 2026
