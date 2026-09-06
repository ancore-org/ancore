#![no_std]
#![allow(clippy::too_many_arguments)]

//! # Ancore Upgrade Governor
//!
//! Governance contract for smart account WASM upgrades with timelock enforcement.
//!
//! ## Features
//! - Timelocked upgrade proposals
//! - Proposal lifecycle (propose → timelock → execute/cancel)
//! - Transparent on-chain upgrade history via events
//! - Owner-controlled proposal and cancellation
//!
//! ## Events
//! - `proposed`: (proposal_id, wasm_hash, execute_after)
//! - `executed`: (proposal_id, wasm_hash)
//! - `cancelled`: (proposal_id)
//! - `timelock_updated`: (new_delay_seconds)

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String, Symbol, Val,
    Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum UpgradeError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidWasmHash = 4,
    ProposalNotFound = 5,
    InvalidProposalId = 6,
    ProposalAlreadyExecuted = 7,
    ProposalAlreadyCancelled = 8,
    TimelockNotElapsed = 9,
    ArithmeticOverflow = 10,
    WasmTooSmall = 11,
    WasmTooLarge = 12,
    MissingRequiredExport = 13,
    ForbiddenImportDetected = 14,
    InvalidThreshold = 15,
    InvalidSigner = 16,
    InsufficientSignatures = 17,
    DuplicateSignature = 18,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u32,
    pub wasm_hash: BytesN<32>,
    pub proposed_at: u64,
    pub execute_after: u64,
    pub executed: bool,
    pub cancelled: bool,
}

/// Maximum number of multisig signers.
pub const MAX_SIGNERS: u32 = 50;

/// Multisig governance policy: the number of signer approvals required to
/// execute a timelocked upgrade, and the addresses eligible to sign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MultisigConfig {
    pub threshold: u32,
    pub signers: Vec<Address>,
}

#[contracttype]
pub enum DataKey {
    Owner,
    TimelockDelay,
    NextProposalId,
    TargetAccount,
    Proposal(u32),
    ContractValidation,
    MultisigConfig,
    SignatureRecord(u32, Address),
}

/// Policy rules checked against the proposer's WASM metadata attestation.
///
/// All fields default to permissive (0 / empty) when not explicitly configured:
/// - `min_wasm_size = 0` disables the lower bound
/// - `max_wasm_size = 0` disables the upper bound
/// - empty `required_exports` skips the export whitelist check
/// - empty `forbidden_imports` skips the import blacklist check
#[contracttype]
#[derive(Clone, Debug)]
pub struct ContractValidation {
    pub min_wasm_size: u32,
    pub max_wasm_size: u32,
    pub required_exports: Vec<String>,
    pub forbidden_imports: Vec<String>,
}

/// Caller-supplied attestation about the proposed WASM blob.
///
/// Because Soroban contracts cannot parse raw WASM bytes from a hash at
/// execution time, the proposer attests to the size, exports, and imports
/// of the WASM they intend to deploy. Off-chain tooling (CI, multisig
/// verification scripts) must independently verify that these values match
/// the actual WASM referenced by `new_wasm_hash` before signing off.
#[contracttype]
#[derive(Clone, Debug)]
pub struct WasmAttestation {
    pub wasm_size: u32,
    pub exports: Vec<String>,
    pub imports: Vec<String>,
}

pub mod factory;
mod multisig;
mod validation;

mod events {
    use soroban_sdk::{Env, Symbol};

    pub fn proposed(env: &Env) -> Symbol {
        Symbol::new(env, "proposed")
    }

    pub fn executed(env: &Env) -> Symbol {
        Symbol::new(env, "executed")
    }

    pub fn cancelled(env: &Env) -> Symbol {
        Symbol::new(env, "cancelled")
    }

    pub fn timelock_updated(env: &Env) -> Symbol {
        Symbol::new(env, "timelock_updated")
    }
}

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17280; // 30 days in ledgers
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * 17280; // 15 days

#[contract]
pub struct UpgradeGovernor;

#[contractimpl]
impl UpgradeGovernor {
    /// Initialize the governor with an owner, target account, and timelock delay.
    pub fn initialize(
        env: Env,
        owner: Address,
        target_account: Address,
        timelock_delay_seconds: u64,
    ) -> Result<(), UpgradeError> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(UpgradeError::AlreadyInitialized);
        }

        owner.require_auth();

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage()
            .instance()
            .set(&DataKey::TargetAccount, &target_account);
        env.storage()
            .instance()
            .set(&DataKey::TimelockDelay, &timelock_delay_seconds);
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &1u32);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events()
            .publish((events::timelock_updated(&env),), timelock_delay_seconds);

        Ok(())
    }

    /// Propose a new WASM upgrade for the target account.
    ///
    /// `attestation` carries the proposer's claim about the WASM's size,
    /// exports, and imports. These are validated on-chain against the stored
    /// `ContractValidation` policy. Off-chain tooling must independently verify
    /// that the attestation matches the actual WASM at `new_wasm_hash`.
    ///
    /// Returns the proposal ID for tracking. The upgrade may only be executed
    /// after the configured timelock delay has elapsed.
    pub fn propose_upgrade(
        env: Env,
        new_wasm_hash: BytesN<32>,
        attestation: WasmAttestation,
    ) -> Result<u32, UpgradeError> {
        let owner = Self::require_owner(env.clone())?;
        owner.require_auth();

        let policy: ContractValidation = env
            .storage()
            .instance()
            .get(&DataKey::ContractValidation)
            .unwrap_or(ContractValidation {
                min_wasm_size: 0,
                max_wasm_size: 0,
                required_exports: Vec::new(&env),
                forbidden_imports: Vec::new(&env),
            });

        validation::validate_wasm_metadata(&env, &new_wasm_hash, &policy, &attestation)?;

        let timelock_delay: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TimelockDelay)
            .unwrap_or(0);
        let proposal_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(1);

        let current_timestamp = env.ledger().timestamp();
        let execute_after = current_timestamp
            .checked_add(timelock_delay)
            .ok_or(UpgradeError::ArithmeticOverflow)?;

        let proposal = Proposal {
            id: proposal_id,
            wasm_hash: new_wasm_hash.clone(),
            proposed_at: current_timestamp,
            execute_after,
            executed: false,
            cancelled: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        let next_id = proposal_id
            .checked_add(1)
            .ok_or(UpgradeError::ArithmeticOverflow)?;
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &next_id);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events().publish(
            (events::proposed(&env),),
            (proposal_id, new_wasm_hash, execute_after),
        );

        Ok(proposal_id)
    }

    /// Execute a pending upgrade after the timelock has elapsed.
    ///
    /// This calls `upgrade(new_wasm_hash)` on the target account contract.
    pub fn execute_upgrade(env: Env, proposal_id: u32) -> Result<(), UpgradeError> {
        let proposal =
            Self::get_proposal(env.clone(), proposal_id).ok_or(UpgradeError::ProposalNotFound)?;

        if proposal.executed {
            return Err(UpgradeError::ProposalAlreadyExecuted);
        }
        if proposal.cancelled {
            return Err(UpgradeError::ProposalAlreadyCancelled);
        }

        let current_timestamp = env.ledger().timestamp();
        if current_timestamp < proposal.execute_after {
            return Err(UpgradeError::TimelockNotElapsed);
        }

        let target_account: Address = env
            .storage()
            .instance()
            .get(&DataKey::TargetAccount)
            .ok_or(UpgradeError::NotInitialized)?;

        let upgrade_fn = Symbol::new(&env, "upgrade");
        let mut args: Vec<Val> = Vec::new(&env);
        args.push_back(proposal.wasm_hash.to_val());

        let _: Val = env.invoke_contract(&target_account, &upgrade_fn, args);

        // Mark proposal as executed by writing it back; idempotent on panic-free envs.
        let executed_proposal = Proposal {
            id: proposal.id,
            wasm_hash: proposal.wasm_hash.clone(),
            proposed_at: proposal.proposed_at,
            execute_after: proposal.execute_after,
            executed: true,
            cancelled: proposal.cancelled,
        };
        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &executed_proposal);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events()
            .publish((events::executed(&env),), (proposal_id, proposal.wasm_hash));

        Ok(())
    }

    /// Cancel a pending upgrade before it executes.
    pub fn cancel_upgrade(env: Env, proposal_id: u32) -> Result<(), UpgradeError> {
        let owner = Self::require_owner(env.clone())?;
        owner.require_auth();

        let mut proposal =
            Self::get_proposal(env.clone(), proposal_id).ok_or(UpgradeError::ProposalNotFound)?;

        if proposal.executed {
            return Err(UpgradeError::ProposalAlreadyExecuted);
        }
        if proposal.cancelled {
            return Err(UpgradeError::ProposalAlreadyCancelled);
        }

        proposal.cancelled = true;
        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events()
            .publish((events::cancelled(&env),), proposal_id);

        Ok(())
    }

    /// Update the timelock delay (applies to new proposals).
    pub fn set_timelock_delay(env: Env, new_delay_seconds: u64) -> Result<(), UpgradeError> {
        let owner = Self::require_owner(env.clone())?;
        owner.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::TimelockDelay, &new_delay_seconds);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events()
            .publish((events::timelock_updated(&env),), new_delay_seconds);

        Ok(())
    }

    /// View a proposal by ID.
    pub fn get_proposal(env: Env, proposal_id: u32) -> Option<Proposal> {
        env.storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
    }

    /// View the current timelock delay.
    pub fn get_timelock_delay(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TimelockDelay)
            .unwrap_or(0)
    }

    /// View the target account address.
    pub fn get_target_account(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::TargetAccount)
    }

    /// Configure the multisig governance policy (owner-only).
    ///
    /// `threshold` must be ≥ 1 and ≤ `signers.len()`. At most `MAX_SIGNERS`
    /// addresses may be registered. The new policy applies immediately to any
    /// proposal that has not yet been executed.
    pub fn update_multisig_config(
        env: Env,
        threshold: u32,
        signers: Vec<Address>,
    ) -> Result<(), UpgradeError> {
        let owner = Self::require_owner(env.clone())?;
        owner.require_auth();

        if threshold == 0 {
            return Err(UpgradeError::InvalidThreshold);
        }
        if signers.len() > MAX_SIGNERS || threshold > signers.len() {
            return Err(UpgradeError::InvalidSigner);
        }

        let config = MultisigConfig { threshold, signers };
        env.storage()
            .instance()
            .set(&DataKey::MultisigConfig, &config);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events()
            .publish((multisig::events::multisig_updated(&env),), threshold);

        Ok(())
    }

    /// View the current multisig configuration.
    pub fn get_multisig_config(env: Env) -> Option<MultisigConfig> {
        env.storage().instance().get(&DataKey::MultisigConfig)
    }

    /// Record the caller's approval for a pending upgrade proposal.
    ///
    /// `caller` must be a registered signer in the multisig config and must
    /// authorize the call. Each signer may approve each proposal at most once;
    /// a second call from the same address returns `DuplicateSignature`.
    pub fn submit_multisig_signature(
        env: Env,
        caller: Address,
        proposal_id: u32,
    ) -> Result<(), UpgradeError> {
        caller.require_auth();

        let config: MultisigConfig = env
            .storage()
            .instance()
            .get(&DataKey::MultisigConfig)
            .ok_or(UpgradeError::NotInitialized)?;

        if !config.signers.contains(&caller) {
            return Err(UpgradeError::InvalidSigner);
        }

        let proposal =
            Self::get_proposal(env.clone(), proposal_id).ok_or(UpgradeError::ProposalNotFound)?;

        if proposal.executed {
            return Err(UpgradeError::ProposalAlreadyExecuted);
        }
        if proposal.cancelled {
            return Err(UpgradeError::ProposalAlreadyCancelled);
        }

        let sig_key = DataKey::SignatureRecord(proposal_id, caller.clone());
        if env.storage().persistent().has(&sig_key) {
            return Err(UpgradeError::DuplicateSignature);
        }
        env.storage().persistent().set(&sig_key, &true);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events().publish(
            (multisig::events::signature_submitted(&env),),
            (proposal_id, caller),
        );

        Ok(())
    }

    /// Execute a timelocked upgrade once the configured threshold of signers
    /// have approved it via `submit_multisig_signature`.
    ///
    /// Anyone may call this once both the signature threshold and the timelock
    /// delay are satisfied.
    pub fn execute_multisig_upgrade(env: Env, proposal_id: u32) -> Result<(), UpgradeError> {
        let proposal =
            Self::get_proposal(env.clone(), proposal_id).ok_or(UpgradeError::ProposalNotFound)?;

        if proposal.executed {
            return Err(UpgradeError::ProposalAlreadyExecuted);
        }
        if proposal.cancelled {
            return Err(UpgradeError::ProposalAlreadyCancelled);
        }

        let current_timestamp = env.ledger().timestamp();
        if current_timestamp < proposal.execute_after {
            return Err(UpgradeError::TimelockNotElapsed);
        }

        let config: MultisigConfig = env
            .storage()
            .instance()
            .get(&DataKey::MultisigConfig)
            .ok_or(UpgradeError::NotInitialized)?;

        // Count unique signer approvals recorded in persistent storage.
        let mut sig_count: u32 = 0;
        for signer in config.signers.iter() {
            if env
                .storage()
                .persistent()
                .has(&DataKey::SignatureRecord(proposal_id, signer))
            {
                sig_count += 1;
            }
        }

        if sig_count < config.threshold {
            return Err(UpgradeError::InsufficientSignatures);
        }

        let target_account: Address = env
            .storage()
            .instance()
            .get(&DataKey::TargetAccount)
            .ok_or(UpgradeError::NotInitialized)?;

        let upgrade_fn = Symbol::new(&env, "upgrade");
        let mut args: Vec<Val> = Vec::new(&env);
        args.push_back(proposal.wasm_hash.to_val());
        let _: Val = env.invoke_contract(&target_account, &upgrade_fn, args);

        let executed_proposal = Proposal {
            id: proposal.id,
            wasm_hash: proposal.wasm_hash.clone(),
            proposed_at: proposal.proposed_at,
            execute_after: proposal.execute_after,
            executed: true,
            cancelled: proposal.cancelled,
        };
        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &executed_proposal);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        env.events()
            .publish((events::executed(&env),), (proposal_id, proposal.wasm_hash));

        Ok(())
    }

    /// View the current owner address.
    pub fn get_owner(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Owner)
    }

    /// Replace the WASM validation policy (owner-only).
    ///
    /// Policy takes effect for all proposals submitted after this call.
    pub fn set_contract_validation(
        env: Env,
        validation: ContractValidation,
    ) -> Result<(), UpgradeError> {
        let owner = Self::require_owner(env.clone())?;
        owner.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::ContractValidation, &validation);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        Ok(())
    }

    /// View the current WASM validation policy.
    ///
    /// Returns the permissive default if no policy has been configured.
    pub fn get_contract_validation(env: Env) -> ContractValidation {
        env.storage()
            .instance()
            .get(&DataKey::ContractValidation)
            .unwrap_or(ContractValidation {
                min_wasm_size: 0,
                max_wasm_size: 0,
                required_exports: Vec::new(&env),
                forbidden_imports: Vec::new(&env),
            })
    }

    fn require_owner(env: Env) -> Result<Address, UpgradeError> {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(UpgradeError::NotInitialized)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger},
        Address, BytesN, Env,
    };

    fn init(env: &Env, client: &UpgradeGovernorClient, owner: &Address, target: &Address) {
        env.mock_all_auths();
        client.initialize(owner, target, &10u64);
    }

    fn default_attestation(env: &Env) -> WasmAttestation {
        WasmAttestation {
            wasm_size: 4096,
            exports: Vec::new(env),
            imports: Vec::new(env),
        }
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        assert_eq!(client.get_owner().unwrap(), owner);
        assert_eq!(client.get_timelock_delay(), 10u64);
        assert_eq!(client.get_target_account(), Some(target));
    }

    #[test]
    fn test_propose_upgrade_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        env.ledger().set_timestamp(1000);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let attestation = default_attestation(&env);
        let proposal_id = client.propose_upgrade(&wasm_hash, &attestation);

        assert_eq!(proposal_id, 1);

        let events_list = env.events().all();
        assert!(events_list.len() >= 2); // initialized + proposed
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        assert_eq!(topics.len(), 1);

        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::proposed(&env));

        let data_tuple: (u32, BytesN<32>, u64) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(data_tuple.0, proposal_id);
        assert_eq!(data_tuple.1, wasm_hash);
        assert_eq!(data_tuple.2, 1010u64); // 1000 + 10
    }

    #[test]
    fn test_execute_upgrade_before_timelock_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        env.ledger().set_timestamp(1000);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let attestation = default_attestation(&env);
        let proposal_id = client.propose_upgrade(&wasm_hash, &attestation);

        // Attempt execution before timelock elapsed (1010) must fail
        let result = client.try_execute_upgrade(&proposal_id);
        assert!(matches!(result, Err(Ok(UpgradeError::TimelockNotElapsed))));
    }

    #[test]
    fn test_cancel_upgrade() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        env.ledger().set_timestamp(1000);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let attestation = default_attestation(&env);
        let proposal_id = client.propose_upgrade(&wasm_hash, &attestation);

        client.cancel_upgrade(&proposal_id);

        let proposal = client.get_proposal(&proposal_id).unwrap();
        assert!(proposal.cancelled);
        assert!(!proposal.executed);

        let events_list = env.events().all();
        assert!(events_list.len() >= 3); // initialized, proposed, cancelled
        let (_contract, topics, _data) = events_list.get_unchecked(2).clone();
        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::cancelled(&env));
    }

    #[test]
    fn test_set_timelock_delay() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        client.set_timelock_delay(&3600u64);

        assert_eq!(client.get_timelock_delay(), 3600u64);
    }

    #[test]
    fn test_get_proposal_not_found() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        assert!(client.get_proposal(&999u32).is_none());
    }

    #[test]
    fn test_propose_rejects_zero_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);
        let attestation = default_attestation(&env);

        let result = client.try_propose_upgrade(&zero_hash, &attestation);
        assert!(matches!(result, Err(Ok(UpgradeError::InvalidWasmHash))));
    }

    #[test]
    fn test_propose_rejects_wasm_below_min_size() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let policy = ContractValidation {
            min_wasm_size: 1024,
            max_wasm_size: 0,
            required_exports: Vec::new(&env),
            forbidden_imports: Vec::new(&env),
        };
        client.set_contract_validation(&policy);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let attestation = WasmAttestation {
            wasm_size: 512,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };

        let result = client.try_propose_upgrade(&wasm_hash, &attestation);
        assert!(matches!(result, Err(Ok(UpgradeError::WasmTooSmall))));
    }

    #[test]
    fn test_propose_rejects_wasm_above_max_size() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let policy = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 1024,
            required_exports: Vec::new(&env),
            forbidden_imports: Vec::new(&env),
        };
        client.set_contract_validation(&policy);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let attestation = WasmAttestation {
            wasm_size: 2048,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };

        let result = client.try_propose_upgrade(&wasm_hash, &attestation);
        assert!(matches!(result, Err(Ok(UpgradeError::WasmTooLarge))));
    }

    #[test]
    fn test_propose_rejects_missing_required_export() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let mut required = Vec::new(&env);
        required.push_back(String::from_str(&env, "upgrade"));
        let policy = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 0,
            required_exports: required,
            forbidden_imports: Vec::new(&env),
        };
        client.set_contract_validation(&policy);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        // attestation exports are empty — "upgrade" is missing
        let attestation = WasmAttestation {
            wasm_size: 4096,
            exports: Vec::new(&env),
            imports: Vec::new(&env),
        };

        let result = client.try_propose_upgrade(&wasm_hash, &attestation);
        assert!(matches!(
            result,
            Err(Ok(UpgradeError::MissingRequiredExport))
        ));
    }

    #[test]
    fn test_propose_rejects_forbidden_import() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let mut forbidden = Vec::new(&env);
        forbidden.push_back(String::from_str(&env, "dangerous_host_fn"));
        let policy = ContractValidation {
            min_wasm_size: 0,
            max_wasm_size: 0,
            required_exports: Vec::new(&env),
            forbidden_imports: forbidden,
        };
        client.set_contract_validation(&policy);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let mut imports = Vec::new(&env);
        imports.push_back(String::from_str(&env, "dangerous_host_fn"));
        let attestation = WasmAttestation {
            wasm_size: 4096,
            exports: Vec::new(&env),
            imports,
        };

        let result = client.try_propose_upgrade(&wasm_hash, &attestation);
        assert!(matches!(
            result,
            Err(Ok(UpgradeError::ForbiddenImportDetected))
        ));
    }

    #[test]
    fn test_propose_passes_with_all_constraints_met() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let mut required = Vec::new(&env);
        required.push_back(String::from_str(&env, "upgrade"));
        let mut forbidden = Vec::new(&env);
        forbidden.push_back(String::from_str(&env, "dangerous_host_fn"));
        let policy = ContractValidation {
            min_wasm_size: 1024,
            max_wasm_size: 1024 * 1024,
            required_exports: required,
            forbidden_imports: forbidden,
        };
        client.set_contract_validation(&policy);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let mut exports = Vec::new(&env);
        exports.push_back(String::from_str(&env, "upgrade"));
        exports.push_back(String::from_str(&env, "get_version"));
        let attestation = WasmAttestation {
            wasm_size: 8192,
            exports,
            imports: Vec::new(&env),
        };

        let proposal_id = client.propose_upgrade(&wasm_hash, &attestation);
        assert_eq!(proposal_id, 1);
    }

    #[test]
    fn test_get_contract_validation_returns_permissive_default() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let v = client.get_contract_validation();
        assert_eq!(v.min_wasm_size, 0);
        assert_eq!(v.max_wasm_size, 0);
        assert_eq!(v.required_exports.len(), 0);
        assert_eq!(v.forbidden_imports.len(), 0);
    }

    // ── Multisig tests ─────────────────────────────────────────────────────────

    fn setup_multisig(
        env: &Env,
        client: &UpgradeGovernorClient,
        threshold: u32,
        signers: &[&Address],
    ) {
        let mut signer_vec: Vec<Address> = Vec::new(env);
        for s in signers {
            signer_vec.push_back((*s).clone());
        }
        client.update_multisig_config(&threshold, &signer_vec);
    }

    #[test]
    fn test_update_multisig_config_stores_correctly() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        let signer_b = Address::generate(&env);
        setup_multisig(&env, &client, 2, &[&signer_a, &signer_b]);

        let cfg = client.get_multisig_config().unwrap();
        assert_eq!(cfg.threshold, 2);
        assert_eq!(cfg.signers.len(), 2);
    }

    #[test]
    fn test_update_multisig_config_rejects_zero_threshold() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        let mut signers: Vec<Address> = Vec::new(&env);
        signers.push_back(signer_a);

        let result = client.try_update_multisig_config(&0, &signers);
        assert!(matches!(result, Err(Ok(UpgradeError::InvalidThreshold))));
    }

    #[test]
    fn test_update_multisig_config_rejects_threshold_exceeding_signers() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        let mut signers: Vec<Address> = Vec::new(&env);
        signers.push_back(signer_a);

        // threshold=3 but only 1 signer
        let result = client.try_update_multisig_config(&3, &signers);
        assert!(matches!(result, Err(Ok(UpgradeError::InvalidSigner))));
    }

    #[test]
    fn test_submit_signature_rejects_non_signer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        setup_multisig(&env, &client, 1, &[&signer_a]);

        // propose a valid upgrade
        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let proposal_id = client.propose_upgrade(&wasm_hash, &default_attestation(&env));

        // an address that is NOT a registered signer
        let outsider = Address::generate(&env);
        let result = client.try_submit_multisig_signature(&outsider, &proposal_id);
        assert!(matches!(result, Err(Ok(UpgradeError::InvalidSigner))));
    }

    #[test]
    fn test_submit_signature_rejects_duplicate() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        setup_multisig(&env, &client, 1, &[&signer_a]);

        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let proposal_id = client.propose_upgrade(&wasm_hash, &default_attestation(&env));

        client.submit_multisig_signature(&signer_a, &proposal_id);

        // second submission from same signer must fail
        let result = client.try_submit_multisig_signature(&signer_a, &proposal_id);
        assert!(matches!(result, Err(Ok(UpgradeError::DuplicateSignature))));
    }

    #[test]
    fn test_execute_multisig_rejects_below_threshold() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        let signer_b = Address::generate(&env);
        // threshold = 2, but only signer_a will sign
        setup_multisig(&env, &client, 2, &[&signer_a, &signer_b]);

        env.ledger().set_timestamp(1000);
        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let proposal_id = client.propose_upgrade(&wasm_hash, &default_attestation(&env));

        client.submit_multisig_signature(&signer_a, &proposal_id);

        // advance past timelock
        env.ledger().set_timestamp(1011);

        let result = client.try_execute_multisig_upgrade(&proposal_id);
        assert!(matches!(
            result,
            Err(Ok(UpgradeError::InsufficientSignatures))
        ));
    }

    #[test]
    fn test_execute_multisig_rejects_before_timelock() {
        let env = Env::default();
        let contract_id = env.register_contract(None, UpgradeGovernor);
        let client = UpgradeGovernorClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let target = Address::generate(&env);
        init(&env, &client, &owner, &target);

        let signer_a = Address::generate(&env);
        setup_multisig(&env, &client, 1, &[&signer_a]);

        env.ledger().set_timestamp(1000);
        let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
        let proposal_id = client.propose_upgrade(&wasm_hash, &default_attestation(&env));

        client.submit_multisig_signature(&signer_a, &proposal_id);

        // timelock not elapsed (execute_after = 1010)
        let result = client.try_execute_multisig_upgrade(&proposal_id);
        assert!(matches!(result, Err(Ok(UpgradeError::TimelockNotElapsed))));
    }
}
