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
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Symbol, Val, Vec,
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

#[contracttype]
pub enum DataKey {
    Owner,
    TimelockDelay,
    NextProposalId,
    TargetAccount,
    Proposal(u32),
}

pub mod factory;

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
    /// Returns the proposal ID for tracking. The upgrade may only be executed
    /// after the configured timelock delay has elapsed.
    pub fn propose_upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<u32, UpgradeError> {
        let owner = Self::require_owner(env.clone())?;
        owner.require_auth();

        if new_wasm_hash == BytesN::from_array(&env, &[0u8; 32]) {
            return Err(UpgradeError::InvalidWasmHash);
        }

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
        let proposal = Self::get_proposal(env.clone(), proposal_id)
            .ok_or(UpgradeError::ProposalNotFound)?;

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

        let mut proposal = Self::get_proposal(env.clone(), proposal_id)
            .ok_or(UpgradeError::ProposalNotFound)?;

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
        env.storage().instance().get(&DataKey::Proposal(proposal_id))
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

    /// View the current owner address.
    pub fn get_owner(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Owner)
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

    fn init(
        env: &Env,
        client: &UpgradeGovernorClient,
        owner: &Address,
        target: &Address,
    ) {
        env.mock_all_auths();
        client.initialize(owner, target, &10u64);
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
        let proposal_id = client.propose_upgrade(&wasm_hash);

        assert_eq!(proposal_id, 1);

        let events_list = env.events().all();
        assert!(events_list.len() >= 2); // initialized + proposed
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        assert_eq!(topics.len(), 1);

        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::proposed(&env));

        let data_tuple: (u32, BytesN<32>, u64) =
            soroban_sdk::FromVal::from_val(&env, &data);
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
        let proposal_id = client.propose_upgrade(&wasm_hash);

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
        let proposal_id = client.propose_upgrade(&wasm_hash);

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

        let result = client.try_propose_upgrade(&zero_hash);
        assert!(matches!(result, Err(Ok(UpgradeError::InvalidWasmHash))));
    }
}
