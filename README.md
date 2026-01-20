# Ancore

**Ancore** is an open-source account abstraction and financial UX layer for the Stellar network.

## Overview

Ancore brings advanced account abstraction capabilities to Stellar/Soroban, enabling:

- **Smart Accounts**: Programmable accounts with custom validation logic
- **Session Keys**: Secure, time-limited signing permissions for seamless UX
- **Social Recovery**: Decentralized account recovery without seed phrases
- **Multi-Signature**: Flexible approval policies for teams and organizations
- **Invoice System**: Native request-to-pay functionality with QR codes
- **AI Agent Integration**: Natural language financial operations

## Repository Structure

This is a monorepo containing:

```
ancore/
├── apps/                     # User-facing applications
│   ├── extension-wallet/     # Browser extension wallet
│   ├── mobile-wallet/        # React Native mobile app
│   └── web-dashboard/        # Web-based account management
│
├── packages/                 # Public SDKs and libraries
│   ├── core-sdk/             # Main SDK for developers
│   ├── account-abstraction/  # Account abstraction primitives
│   ├── stellar/              # Stellar/Soroban utilities
│   ├── crypto/               # Cryptographic utilities
│   ├── ui-kit/               # Shared UI components
│   └── types/                # Shared TypeScript types
│
├── contracts/                # Soroban smart contracts
│   ├── account/              # Core account contract
│   ├── validation-modules/   # Pluggable validation logic
│   ├── invoice/              # Invoice system
│   └── upgrade/              # Upgrade mechanisms
│
├── services/                 # Optional infrastructure
│   ├── relayer/              # Transaction relay service
│   ├── indexer/              # Blockchain indexer
│   └── ai-agent/             # AI-powered financial agent
│
└── docs/                     # Documentation
    ├── architecture/         # System architecture
    ├── security/             # Security model & audits
    └── guides/               # Developer guides
```

## Security Boundaries

Ancore maintains strict security controls:

- 🔒 **High Security** (requires core team approval):
  - `contracts/**`
  - `packages/crypto/**`
  - `packages/account-abstraction/**`

- ⚠️ **Medium Risk**:
  - `packages/core-sdk/**`
  - `services/**`

- 🟢 **Low Risk** (community contributions welcome):
  - `apps/**`
  - `packages/ui-kit/**`
  - `docs/**`

See [CODEOWNERS](.github/CODEOWNERS) for details.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Rust toolchain (1.74.0+)
- wasm32-unknown-unknown target
- Soroban CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/ancore-org/ancore.git
cd ancore

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build contracts
rustup target add wasm32-unknown-unknown
pnpm contracts:build

# Run tests
pnpm test
```

### Development

```bash
# Start development mode
pnpm dev

# Build contracts
pnpm contracts:build

# Test contracts
pnpm contracts:test
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

**Quick guidelines:**

- Follow the security boundaries outlined above
- Write tests for new features
- Ensure code compiles and passes linting
- Sign your commits

For security-sensitive code, please read our [Security Policy](SECURITY.md) first.

## API Stability

### Public APIs (SemVer enforced)

- `core-sdk`
- `account-abstraction`
- `types`

Breaking changes require a major version bump and RFC.

### Internal APIs

- `crypto`
- Contract internals

No stability guarantees. May change between minor versions.

## Licensing

- **Contracts & Core SDK**: Apache 2.0 (see [LICENSE-APACHE](LICENSE-APACHE))
- **Applications & UI**: MIT (see [LICENSE-MIT](LICENSE-MIT))
- **Documentation**: CC BY 4.0

## Security

For security disclosures, please see [SECURITY.md](SECURITY.md).

**Do not** open public issues for security vulnerabilities.

## Maintainers

See [MAINTAINERS.md](MAINTAINERS.md) for the list of maintainers and their responsibilities.

## RFCs

Major changes are proposed via RFCs in the `docs/rfcs/` directory. See [RFC.md](RFC.md) for the process.

## Architecture

For a deep dive into Ancore's architecture, see:

- [System Architecture](docs/architecture/OVERVIEW.md)
- [Account Model](docs/architecture/ACCOUNT_MODEL.md)
- [Security Model](docs/security/THREAT_MODEL.md)

## Roadmap

- [x] Core account abstraction contracts
- [x] Session key implementation
- [ ] Browser extension wallet (v1)
- [ ] Mobile wallet
- [ ] Social recovery
- [ ] Invoice system
- [ ] AI agent integration
- [ ] Mainnet launch

## Community

- **Telegram**: [Ancore TG](https://t.me/+OqlAx-gQx3M4YzJk)

## Acknowledgments

Built with:

- [Stellar](https://stellar.org/) & [Soroban](https://soroban.stellar.org/)
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) (inspiration)
- [Safe](https://safe.global/) (design patterns)

---

**License**: Apache-2.0 OR MIT
