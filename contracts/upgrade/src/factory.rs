#![allow(dead_code)]

//! Optional factory helper: deploy new account contracts pointing at latest implementation.
//!
//! This is not a standalone contract; it is a Rust helper that callers (deploy scripts,
//! SDKs, or a future factory contract) can use to create new account contracts with
//! the correct WASM hash.

use soroban_sdk::{Address, BytesN, Env};

/// Deploy a new AncoreAccount contract, configured with the given owner and the
/// latest known WASM hash for the account implementation.
///
/// Returns the newly deployed contract ID.
///
/// # Security
/// - The `owner` address is set as the account owner at initialization.
/// - The `wasm_hash` should correspond to the audited account contract WASM.
pub fn deploy_new_account(
    env: Env,
    owner: Address,
    wasm_hash: BytesN<32>,
) -> Result<Address, &'static str> {
    // In a real deployment, this would use env.deployer().with_current_contract_wasm(wasm_hash)
    // or similar. For now, this is a placeholder to document the intended API.
    let _ = (env, owner, wasm_hash);
    Err("factory not yet wired to deployer API")
}

/// Upgrade an existing account contract to a new WASM hash via the upgrade governor.
///
/// This is a convenience wrapper that constructs the governor client call.
/// In practice, the caller should wait for the timelock and then execute.
pub fn upgrade_existing_account(
    _env: Env,
    _governor: Address,
    _proposal_id: u32,
) -> Result<(), &'static str> {
    // Placeholder: real implementation would create UpgradeGovernorClient and call execute.
    Err("factory helper not yet implemented")
}
