# Ancore Smart Contracts

Soroban smart contracts for the Ancore account abstraction system.

## Structure

```
contracts/
├── account/              # Core account contract
├── validation-modules/   # Pluggable validation logic
├── invoice/              # Invoice system contracts
└── upgrade/              # Upgrade mechanisms
```

> `validation-modules`, `invoice`, and `upgrade` are currently scaffold directories.
> They are intentionally preserved for planned features and contributor onboarding.

## End-to-End Deploy & Initialize Walkthrough

This section provides a verified, copy-paste-ready sequence for deploying and
initializing the Ancore Account contract on Soroban testnet. Each step maps to
a script or CLI command in this directory.

### Prerequisites

| Tool                                     | Minimum version | Install                                                                               |
| ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `stellar` CLI                            | 22.0.1          | `cargo install --locked stellar-cli`                                                  |
| `rustup` target `wasm32-unknown-unknown` | any             | `rustup target add wasm32-unknown-unknown`                                            |
| A funded testnet account                 | —               | [Stellar Lab Friendbot](https://laboratory.stellar.org/#account-creator?network=test) |

### Step 1 — Fund a testnet identity

```bash
# Create a local keypair called "deployer" (skip if you already have one)
stellar keys generate --global deployer --network testnet

# Fund via Friendbot (testnet only; ~10 000 XLM granted)
stellar keys fund deployer --network testnet
```

> **Cost note**: Deploying a Soroban contract on testnet currently consumes
> approximately 50–500 XLM in resource fees depending on WASM size and ledger
> congestion. Friendbot provides sufficient funds for multiple test deployments.

### Step 2 — Build and validate the contract

```bash
cd contracts

# Compile to WASM
cargo build --target wasm32-unknown-unknown --release -p ancore-account

# Run tests before deploying
cargo test -p ancore-account
```

To run the full dry-run (build → optimize → size check → inspect) without
broadcasting to the network:

```bash
bash scripts/dry-run.sh
# Produces dry-run-report.json — review before proceeding
```

### Step 3 — Deploy

```bash
export DEPLOYER_SECRET=$(stellar keys show deployer --secret)

bash scripts/deploy.sh \
  account/target/wasm32-unknown-unknown/release/ancore_account.wasm
```

On success, `contract-deployment.json` will contain:

```json
{
  "network": "testnet",
  "contract_id": "CABC...XYZ"
}
```

### Step 4 — Initialize the account

After deployment, call `initialize` with the owner's Stellar address:

```bash
CONTRACT_ID=$(jq -r .contract_id contract-deployment.json)
OWNER_ADDRESS=$(stellar keys address deployer)

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --owner "$OWNER_ADDRESS"
```

Expected output: no error, and the ledger now contains the `Owner` storage key.

### Step 5 — Verify deployment

```bash
# Confirm the owner is stored correctly
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source deployer \
  --network testnet \
  -- \
  get_owner
```

Returns the owner address set in Step 4.

### Verifying docs stay in sync with scripts

Run the verification helper to confirm all commands referenced in this walkthrough
are present in the scripts directory and that the dry-run passes:

```bash
bash scripts/verify-deploy-docs.sh
```

### Troubleshooting

| Symptom                              | Likely cause                            | Fix                                                             |
| ------------------------------------ | --------------------------------------- | --------------------------------------------------------------- |
| `DEPLOYER_SECRET not set`            | Environment variable missing            | `export DEPLOYER_SECRET=$(stellar keys show deployer --secret)` |
| `Contract deployment failed`         | CLI output format changed               | Upgrade `stellar-cli` to ≥ 22.0.1                               |
| `insufficient balance`               | Account not funded                      | Re-run `stellar keys fund deployer --network testnet`           |
| `invalid wasm hash`                  | All-zero hash in `upgrade()`            | Ensure `--wasm` points to a built artifact, not a placeholder   |
| WASM too large (> 128 KiB)           | Contract grew past Soroban limit        | Run `stellar contract optimize` before deploying                |
| `AlreadyInitialized` on `initialize` | Contract deployed but init called twice | Deploy a fresh instance or use a new identity                   |

---

## Security

⚠️ **CRITICAL**: All contracts in this directory are security-critical.

### Review Requirements

Changes to contracts require:

1. Core team approval
2. Security team review
3. Comprehensive test coverage
4. Security audit before mainnet deployment

See [SECURITY.md](../SECURITY.md) for the vulnerability disclosure process.

## Development

### Prerequisites

- Rust toolchain (1.74.0+)
- Soroban CLI: `cargo install --locked soroban-cli`
- wasm32-unknown-unknown target: `rustup target add wasm32-unknown-unknown`

### Building All Contracts

From the workspace root:

```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

Or using soroban-cli:

```bash
soroban contract build
```

### Testing

```bash
cargo test
```

Run tests with output:

```bash
cargo test -- --nocapture
```

### Prerequisites

- Rust toolchain (1.74.0+)
- Soroban CLI: `cargo install --locked soroban-cli`
- wasm32-unknown-unknown target: `rustup target add wasm32-unknown-unknown`

### Tooling & Automation

#### Makefile Targets

Run all contract operations from the `contracts` directory:

```bash
make build           # Compile contract WASM
make test            # Run contract tests
make optimize        # Optimize WASM for deployment
make fmt             # Format Rust code
make clippy          # Lint contract code
make deploy-testnet  # Deploy contract to Soroban testnet
```

#### Scripts

- `scripts/deploy.sh`: Deploys contract to Soroban testnet, funds account, outputs contract ID to `contract-deployment.json`.
- `scripts/setup-local.sh`: Sets up local Soroban sandbox and funds deployer account.

#### Example Workflow

1. Build and optimize contract:

```bash
make build
make optimize
```

2. Setup local sandbox (optional):

```bash
bash scripts/setup-local.sh
```

3. Deploy to testnet:

```bash
make deploy-testnet
```

- Contract ID will be written to `contract-deployment.json`.

#### Environment Variables

- `DEPLOYER_SECRET`: Set your deployer account secret for deployment scripts.

#### Manual Steps (for reference)

You can still use Soroban CLI directly for custom deployments:

```bash
soroban contract build
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/ancore_account.wasm
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/ancore_account.optimized.wasm --source <deployer> --network testnet
```

- Ed25519 validation (native Stellar)
- Multi-signature
- WebAuthn support
- Custom validation logic

### Invoice System

Request-to-pay functionality:

- Create invoices
- Pay invoices
- Recurring payments
- QR code generation

### Upgrade Mechanisms

Safe upgrade patterns:

- Proxy pattern
- Data migration
- Backwards compatibility

## Testing Strategy

### Unit Tests

Each contract has comprehensive unit tests using `soroban-sdk` test utilities.

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, testutils::Address as _};

    #[test]
    fn test_initialize() {
        // Test implementation
    }
}
```

### Integration Tests

Cross-contract integration tests in workspace root.

### Fuzzing

Use `cargo-fuzz` for fuzzing critical validation logic.

## Deployment

### Testnet

Deploy to Stellar Testnet using soroban-cli:

```bash
# Install CLI
cargo install --locked soroban-cli

# Configure network
soroban network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Generate identity
soroban keys generate --global alice --network testnet

# Fund account
soroban keys fund alice --network testnet

# Build contract
cd contracts/account
soroban contract build

# Deploy
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/ancore_account.wasm \
  --source alice \
  --network testnet
```

### Mainnet

⚠️ Mainnet deployment requires:

- External security audit
- Bug bounty program
- Comprehensive testing
- Community review period

See `docs/contracts/DEPLOYMENT.md` for detailed mainnet procedures.

## Gas Optimization

Contracts are optimized for efficiency:

- Minimal storage usage
- Efficient data structures
- Optimized WASM compilation
- Batch operations where possible

## Soroban SDK Version

Current SDK version: **21.7.0**

Update all contracts when upgrading:

```bash
cargo update -p soroban-sdk
```

## Resources

- [Soroban Documentation](https://soroban.stellar.org/)
- [Soroban SDK Docs](https://docs.rs/soroban-sdk/)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Examples](https://github.com/stellar/soroban-examples)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

**Important**: Contract changes require RFC and security review.

## License

Apache-2.0

---

**Audit Status**: Not yet audited - DO NOT use in production
