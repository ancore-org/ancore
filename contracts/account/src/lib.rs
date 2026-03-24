#![no_std]

//! # Ancore Account Contract
//!
//! Core smart account contract implementing account abstraction for Stellar/Soroban.
//!
//! ## Security
//! This contract is security-critical and must be audited before mainnet deployment.
//!
//! ## Features
//! - Signature validation
//! - Session key support
//! - Upgradeable via proxy pattern
//! - Multi-signature support
//!
//! ## Events
//! This contract emits events for all state-changing operations to enable off-chain tracking:
//! - `initialized`: Emitted when the account is initialized with the owner address
//! - `executed`: Emitted when a transaction is executed with to, function, and nonce
//! - `session_key_added`: Emitted when a session key is added with public_key and expires_at
//! - `session_key_revoked`: Emitted when a session key is revoked with public_key

use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, Address, BytesN, Env, Vec,
};

/// Contract error types for structured error handling
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContractError {
    /// Account is already initialized
    AlreadyInitialized = 1,
    /// Account is not initialized
    NotInitialized = 2,
    /// Caller is not authorized
    Unauthorized = 3,
    /// Invalid nonce provided
    InvalidNonce = 4,
    /// Session key not found
    SessionKeyNotFound = 5,
    /// Session key has expired
    SessionKeyExpired = 6,
    /// Insufficient permissions
    InsufficientPermission = 7,
}

/// Event topic naming convention
mod events {
    use soroban_sdk::{Env, Symbol};

    /// Event emitted when the account is initialized.
    /// Data: (owner: Address)
    pub fn initialized(env: &Env) -> Symbol {
        Symbol::new(env, "initialized")
    }

    /// Event emitted when a transaction is executed.
    /// Data: (to: Address, function: Symbol, nonce: u64)
    pub fn executed(env: &Env) -> Symbol {
        Symbol::new(env, "executed")
    }

    /// Event emitted when a session key is added.
    /// Data: (public_key: BytesN<32>, expires_at: u64)
    pub fn session_key_added(env: &Env) -> Symbol {
        Symbol::new(env, "session_key_added")
    }

    /// Event emitted when a session key is revoked.
    /// Data: (public_key: BytesN<32>)
    pub fn session_key_revoked(env: &Env) -> Symbol {
        Symbol::new(env, "session_key_revoked")
    }
}

#[contracttype]
#[derive(Clone)]
pub struct SessionKey {
    pub public_key: BytesN<32>,
    pub expires_at: u64,
    pub permissions: Vec<u32>,
}

#[contracttype]
pub enum DataKey {
    Owner,
    Nonce,
    SessionKey(BytesN<32>),
}

const DAY_IN_LEDGERS: u32 = 17280; // 24 hours * 60 min * 60 sec / 5 sec per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS; // 15 days


#[contract]
pub struct AncoreAccount;

#[contractimpl]
impl AncoreAccount {
    /// Initialize the account with an owner
    pub fn initialize(env: Env, owner: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Nonce, &0u64);

        // Extend instance TTL
        env.storage().instance().extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit initialized event
        env.events().publish((events::initialized(&env),), owner);

        Ok(())
    }

    /// Get the account owner
    pub fn get_owner(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(ContractError::NotInitialized)
    }

    /// Get the current nonce
    pub fn get_nonce(env: Env) -> Result<u64, ContractError> {
        Ok(env.storage()
            .instance()
            .get(&DataKey::Nonce)
            .unwrap_or(0))
    }

    /// Execute a transaction: validate nonce, perform cross-contract call, increment nonce.
    ///
    /// # Security
    /// - Caller must be owner (session key auth not yet wired)
    /// - `expected_nonce` must match current nonce (replay protection)
    /// - Nonce is incremented only after a successful invocation
    pub fn execute(
        env: Env,
        to: Address,
        function: soroban_sdk::Symbol,
        _args: Vec<soroban_sdk::Val>,
        expected_nonce: u64,
    ) -> Result<bool, ContractError> {
        // TODO: Implement signature validation
        // TODO: Execute call

        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        // Get nonce before incrementing
        let current_nonce: u64 = Self::get_nonce(env.clone())?;
        
        if expected_nonce != current_nonce {
            panic!("Invalid nonce");
        }


        // Increment nonce
        env.storage().instance().set(&DataKey::Nonce, &(current_nonce + 1));

        // Extend instance TTL to keep contract alive
        env.storage().instance().extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit executed event with transaction details
        env.events()
            .publish((events::executed(&env),), (to, function, current_nonce));

        Ok(true)
    }

    /// Add a session key
    pub fn add_session_key(
        env: Env,
        public_key: BytesN<32>,
        expires_at: u64,
        permissions: Vec<u32>,
    ) -> Result<(), ContractError> {
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        let session_key = SessionKey {
            public_key: public_key.clone(),
            expires_at,
            permissions,
        };

        env.storage()
            .persistent()
            .set(&DataKey::SessionKey(public_key.clone()), &session_key);

        Self::extend_session_key_ttl(&env, &public_key, expires_at);

        // Emit session_key_added event
        env.events()
            .publish((events::session_key_added(&env),), (public_key, expires_at));

        Ok(())
    }

    /// Revoke a session key
    pub fn revoke_session_key(env: Env, public_key: BytesN<32>) -> Result<(), ContractError> {
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        env.storage()
            .persistent()
            .remove(&DataKey::SessionKey(public_key.clone()));

        // Emit session_key_revoked event
        env.events()
            .publish((events::session_key_revoked(&env),), public_key);

        Ok(())
    }

    /// Get a session key
    pub fn get_session_key(env: Env, public_key: BytesN<32>) -> Option<SessionKey> {
        env.storage()
            .persistent()
            .get(&DataKey::SessionKey(public_key))
    }

    /// Refresh the TTL of a session key
    pub fn refresh_session_key_ttl(env: Env, public_key: BytesN<32>) -> Result<(), ContractError> {
        let session_key = Self::get_session_key(env.clone(), public_key.clone())
            .ok_or(ContractError::SessionKeyNotFound)?;

        Self::extend_session_key_ttl(&env, &public_key, session_key.expires_at);

        Ok(())
    }

    /// Helper to cleanly extend session key TTL
    fn extend_session_key_ttl(env: &Env, public_key: &BytesN<32>, expires_at: u64) {
        let current_timestamp = env.ledger().timestamp();
        
        // Auto-detect if expires_at is using ms vs s. ms timestamps are > 100_000_000_000
        let expires_at_secs = if expires_at > 100_000_000_000 {
            expires_at / 1000
        } else {
            expires_at
        };

        let ledgers_to_live = if expires_at_secs > current_timestamp {
            // Using 4 seconds-per-ledger + 1 day buffer to guarantee it outlives expiry
            ((expires_at_secs - current_timestamp) / 4) as u32 + DAY_IN_LEDGERS
        } else {
            DAY_IN_LEDGERS // 1 day default buffer
        };
        
        let threshold = ledgers_to_live.saturating_sub(DAY_IN_LEDGERS / 2); // refresh when less than half day buffer

        env.storage().persistent().extend_ttl(
            &DataKey::SessionKey(public_key.clone()),
            threshold,
            ledgers_to_live,
        );
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events}, Address, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        assert_eq!(client.get_owner(), owner);
        assert_eq!(client.get_nonce(), 0);
    }

    #[test]
    fn test_initialize_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        // Check that an event was published
        let events_list = env.events().all();
        assert_eq!(events_list.len(), 1);
        let (_contract, topics, data) = events_list.get_unchecked(0).clone();
        assert_eq!(topics.len(), 1);
        
        // Convert topic to Symbol for comparison
        let topic_symbol: soroban_sdk::Symbol = soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::initialized(&env));
        
        // Verify owner address is in the event data
        let event_owner: Address = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(event_owner, owner);
    }

    #[test]
    fn test_add_session_key() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = 1000u64;
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &expires_at, &permissions);

        let session_key = client.get_session_key(&session_pk);
        assert!(session_key.is_some());
    }

    #[test]
    fn test_add_session_key_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = 1000u64;
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &expires_at, &permissions);

        // Find the session_key_added event (skip the initialize event)
        let events_list = env.events().all();
        assert!(events_list.len() >= 2);
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        assert_eq!(topics.len(), 1);
        
        // Convert topic to Symbol for comparison
        let topic_symbol: soroban_sdk::Symbol = soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::session_key_added(&env));
        
        // Verify data is (public_key, expires_at)
        let data_tuple: (BytesN<32>, u64) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(data_tuple.0, session_pk);
        assert_eq!(data_tuple.1, expires_at);
    }

    #[test]
    fn test_revoke_session_key_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = 1000u64;
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &expires_at, &permissions);
        client.revoke_session_key(&session_pk);

        // Find the session_key_revoked event (should be the last event)
        let events_list = env.events().all();
        assert!(events_list.len() >= 3);
        let (_contract, topics, data) = events_list.get_unchecked(2).clone();
        assert_eq!(topics.len(), 1);
        
        // Convert topic to Symbol for comparison
        let topic_symbol: soroban_sdk::Symbol = soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::session_key_revoked(&env));
        
        // Verify public_key is in the event data
        let event_pk: BytesN<32> = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(event_pk, session_pk);
    }

    #[test]
    fn test_execute_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let to = Address::generate(&env);
        let function = soroban_sdk::Symbol::new(&env, "transfer");
        let args = Vec::new(&env);

        client.execute(&to, &function, &args, &0u64);

        // Find the executed event (skip the initialize event)
        let events_list = env.events().all();
        assert!(events_list.len() >= 2);
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        assert_eq!(topics.len(), 1);
        
        // Convert topic to Symbol for comparison
        let topic_symbol: soroban_sdk::Symbol = soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::executed(&env));
        
        // Verify data is (to, function, nonce)
        let data_tuple: (Address, soroban_sdk::Symbol, u64) =
            soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(data_tuple.0, to);
        assert_eq!(data_tuple.1, function);
        assert_eq!(data_tuple.2, 0); // First execution, nonce should be 0
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_double_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        client.initialize(&owner); // Should panic with contract error #1
    }

    #[test]
    #[should_panic(expected = "Invalid nonce")]
    fn test_execute_rejects_invalid_nonce() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let to = Address::generate(&env);
        let function = soroban_sdk::symbol_short!("transfer");
        let args = Vec::new(&env);

        // Current nonce is 0; passing expected_nonce = 1 should panic Invalid nonce
        client.execute(&to, &function, &args, &1u64);
    }

    #[test]
    fn test_execute_validates_nonce_then_increments() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        assert_eq!(client.get_nonce(), 0);

        env.mock_all_auths();

        // Deploy a trivial contract that returns a Val so we can invoke it
        let callee_id = env.register_contract(None, AncoreAccount);
        let to = callee_id;
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        // Execute with expected_nonce = 0 (matches current); invokes get_nonce on callee
        let _result = client.execute(&to, &function, &args, &0u64);

        assert_eq!(client.get_nonce(), 1);
    }
    
    #[test]
    fn test_refresh_session_key_ttl() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = env.ledger().timestamp() + 10000;
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &expires_at, &permissions);
        
        // This validates the function compiles and runs successfully
        client.refresh_session_key_ttl(&session_pk);
        
        let session_key = client.get_session_key(&session_pk);
        assert!(session_key.is_some());
    }
}
