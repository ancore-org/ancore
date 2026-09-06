# WASM Validation Architecture

## Decision: Off-chain attestation with on-chain enforcement

### Problem

`ContractValidation` exposes `min_wasm_size`, `max_wasm_size`, `required_exports`, and
`forbidden_imports` as configurable policy fields, but Soroban contracts run inside a
constrained WASM VM and **cannot retrieve or parse WASM bytes from a hash at execution
time**. The contract has access to a hash (a `BytesN<32>`) — not the binary it commits to.

### Considered approaches

| Approach | Feasible? | Notes |
|---|---|---|
| Parse WASM section headers inside the contract | No | Soroban execution environment does not expose raw WASM bytes for a given hash; no host function exists to read arbitrary contract code at runtime |
| Require the proposer to pass raw WASM bytes as a contract argument | Impractical | Transaction size limits make passing full WASM binaries infeasible; the bytes would also need re-hashing to verify integrity |
| Off-chain enforcement only (CI/deploy tooling) | Partial | Correct for export/import checking, but provides no on-chain auditability or governance enforcement |
| **Attestation model** (chosen) | **Yes** | Proposer supplies `WasmAttestation { wasm_size, exports, imports }`; contract enforces the attestation against stored policy on-chain; off-chain tooling independently verifies the attestation matches the actual WASM before signing |

### Chosen approach

The `propose_upgrade` entry point accepts a `WasmAttestation` alongside the WASM hash.
The contract enforces that the attestation satisfies the stored `ContractValidation` policy:

- `wasm_size < min_wasm_size` → `WasmTooSmall`
- `wasm_size > max_wasm_size` → `WasmTooLarge`
- any name in `required_exports` absent from `attestation.exports` → `MissingRequiredExport`
- any name in `forbidden_imports` present in `attestation.imports` → `ForbiddenImportDetected`

### Security model

The on-chain contract enforces *what the proposer claims*. The trust assumption is:

1. **Multisig signers** independently verify (via CI, deploy tooling, or manual inspection)
   that the attestation values match the actual WASM at `new_wasm_hash` before submitting
   their approval via `submit_multisig_signature`.
2. **Governance** sets a meaningful `ContractValidation` policy via `set_contract_validation`.
3. A proposer who lies in the attestation is detectable off-chain before execution. Even if
   a bad attestation reaches the chain, the WASM hash is immutable — the upgrade will deploy
   exactly the bytes at that hash, whose real properties any observer can verify.

### Rationale for not parsing WASM on-chain

Soroban contracts are limited to the host functions exposed by the Stellar host. No host
function provides access to the bytecode of an arbitrary contract identified by hash. Parsing
WASM section headers would require passing the entire binary as a transaction argument, which
is infeasible for typical WASM binaries (tens to hundreds of kilobytes) given Stellar
transaction size limits. The attestation model achieves equivalent security properties at
zero on-chain compute cost by shifting the cryptographic verification burden to the signers.

### Future considerations

If Soroban adds a host function to introspect contract metadata (e.g. an export list
derivable from a hash), this module can be upgraded to remove the attestation parameter and
perform direct on-chain checks. The `ContractValidation` storage schema and error codes are
designed to remain compatible with such a change.
