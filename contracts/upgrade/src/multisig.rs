//! Multisig governance support for the UpgradeGovernor contract.
//!
//! The contract entrypoints (`submit_multisig_signature`, `execute_multisig_upgrade`,
//! `update_multisig_config`) live on `UpgradeGovernor` in `lib.rs`. This module
//! provides the well-known event symbol constructors used by those entrypoints.
//!
//! ## Flow
//!
//! 1. Owner calls `update_multisig_config(threshold, signers)` to configure policy.
//! 2. Owner proposes an upgrade with `propose_upgrade(hash, attestation)` — this
//!    creates the proposal subject to the timelock.
//! 3. Each registered signer calls `submit_multisig_signature(caller, proposal_id)`.
//!    Signatures are stored on-chain; duplicates are rejected.
//! 4. Once `threshold` unique approvals are recorded AND the timelock has elapsed,
//!    anyone may call `execute_multisig_upgrade(proposal_id)`.

pub mod events {
    use soroban_sdk::{Env, Symbol};

    pub fn signature_submitted(env: &Env) -> Symbol {
        Symbol::new(env, "sig_submitted")
    }

    pub fn multisig_updated(env: &Env) -> Symbol {
        Symbol::new(env, "multisig_updated")
    }
}
