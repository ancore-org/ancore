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

<!-- repo-structure-check:start -->

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
│   ├── validation-modules/   # Planned pluggable validation module scaffolds
│   ├── invoice/              # Planned invoice contract scaffolds
│   └── upgrade/              # Planned upgrade contract scaffolds
│
├── services/                 # Optional infrastructure
│   ├── relayer/              # Transaction relay service
│   ├── indexer/              # Blockchain indexer
│   └── ai-agent/             # Planned AI orchestration service scaffold
│
└── docs/                     # Documentation
    ├── architecture/         # System architecture
    ├── security/             # Security model & audits
    └── user-guide/           # End-user guides
```

<!-- repo-structure-check:end -->

### Repository Structure Drift Check

The repository tree above is guarded by a lightweight drift check so contributor-facing docs do not reference renamed or removed modules. Run it locally with:

```bash
pnpm docs:check-structure
```

When adding, renaming, or removing documented modules, update the tree inside the `repo-structure-check` markers in this README and in `docs/architecture/OVERVIEW.md`. If the checked documentation set changes, update `scripts/check-docs-repo-structure.mjs` and the docs structure workflow together.

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

### Updating WASM Size Budgets

WASM contract sizes are monitored in CI to prevent regression. The budget for each contract is defined in `contracts/budgets/wasm-budgets.json`. 

If your changes intentionally increase the contract size beyond the current budget:
1. Ensure your contract builds locally: `pnpm contracts:build`
2. Check the new size of the optimized `.wasm` files in `contracts/target/wasm32-unknown-unknown/release/`.
3. You can run the local size check with: `node scripts/check-wasm-size.js`
4. Update `contracts/budgets/wasm-budgets.json` with the new size budget, and commit the changes.


## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.
Please also review our [Code of Conduct](CODE_OF_CONDUCT.md) before engaging in community discussions.

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

### In progress (active)

- [x] Core account abstraction contracts
- [x] Session key primitives (contract + SDK foundation)
- [x] Browser extension wallet foundation
- [x] Web dashboard foundation
- [ ] Production-ready relayer security path
- [ ] Production-ready account contract hardening and audit
- [ ] MVP release gate completion

### Planned (post-MVP)

- [ ] Mobile wallet productionization
- [ ] Social recovery
- [ ] Invoice system
- [ ] AI agent integration
- [ ] Mainnet launch

### Planned module scaffolds (intentionally preserved)

- `contracts/validation-modules/` - reserved for modular auth/policy contracts
- `contracts/invoice/` - reserved for invoice/request-to-pay contracts
- `contracts/upgrade/` - reserved for upgrade governance contracts
- `services/ai-agent/` - reserved for AI workflow orchestration

These directories are intentionally kept as scaffolds to preserve architecture direction and contributor workflow without implying production completeness.

For execution waves (2-3 features at a time), see `docs/product/FINANCIAL_OS_ROADMAP.md`.

## Community

- **Telegram**: [Ancore TG](https://t.me/+OqlAx-gQx3M4YzJk)

## Acknowledgments

Built with:

- [Stellar](https://stellar.org/) & [Soroban](https://soroban.stellar.org/)
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) (inspiration)
- [Safe](https://safe.global/) (design patterns)

---

**License**: Apache-2.0 OR MIT
