#![no_std]
#![allow(clippy::too_many_arguments)]

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
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Val, Vec,
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
    /// Invalid version provided for migration
    InvalidVersion = 8,
    /// Signature is missing or invalid
    InvalidSignature = 9,
    /// Invalid WASM hash provided for upgrade
    InvalidWasmHash = 10,
    /// Invalid expiration time provided
    InvalidExpiration = 11,
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

    /// Event emitted when the contract is upgraded.
    /// Data: (new_wasm_hash: BytesN<32>)
    pub fn upgraded(env: &Env) -> Symbol {
        Symbol::new(env, "upgraded")
    }

    /// Event emitted when a migration is completed.
    /// Data: (old_version: u32, new_version: u32)
    pub fn migrated(env: &Env) -> Symbol {
        Symbol::new(env, "migrated")
    }

    /// Event emitted when a session key TTL is refreshed.
    /// Data: (public_key: BytesN<32>, expires_at: u64)
    pub fn session_key_ttl_refreshed(env: &Env) -> Symbol {
        Symbol::new(env, "session_key_ttl_refreshed")
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CallerIdentity {
    Owner,
    SessionKey(BytesN<32>),
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
    Version,
}

const DAY_IN_LEDGERS: u32 = 17280; // 24 hours * 60 min * 60 sec / 5 sec per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS; // 15 days

/// Permission bit for execute operations
/// Permission bit for session-key execute authorization.
/// Issue #188: Session keys must have this permission to invoke transactions.
/// Without this bit set, execute() returns InsufficientPermission error.
pub const PERMISSION_EXECUTE: u32 = 1;

#[contract]
pub struct AncoreAccount;

#[contractimpl]
impl AncoreAccount {
    /// Initialize the account with an owner
    pub fn initialize(env: Env, owner: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(ContractError::AlreadyInitialized);
        }

        owner.require_auth();

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Nonce, &0u64);
        env.storage().instance().set(&DataKey::Version, &1u32);

        // Extend instance TTL
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

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
        Ok(env.storage().instance().get(&DataKey::Nonce).unwrap_or(0))
    }

    /// Get the current contract version
    pub fn get_version(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Version).unwrap_or(0)
    }

    /// Execute a transaction with nonce replay-protection and dual auth paths.
    ///
    /// # Security
    /// - Caller must be owner OR provide a valid session key signature
    /// - `expected_nonce` must match current nonce (replay protection)
    /// - Session key signatures are bound to exact call parameters (to, function, args, nonce)
    /// - Nonce is incremented before invocation (checks-effects-interactions)
    pub fn execute(
        env: Env,
        _caller: CallerIdentity,
        to: Address,
        function: soroban_sdk::Symbol,
        args: Vec<Val>,
        expected_nonce: u64,
        session_pub_key: Option<BytesN<32>>,
        signature: Option<BytesN<64>>,
        signature_payload: Option<soroban_sdk::Bytes>,
    ) -> Result<Val, ContractError> {
        let current_nonce: u64 = Self::get_nonce(env.clone())?;

        if expected_nonce != current_nonce {
            return Err(ContractError::InvalidNonce);
        }

        // Validate session key or enforce owner auth
        if let Some(session_pk) = session_pub_key {
            let session = Self::get_session_key(env.clone(), session_pk.clone())
                .ok_or(ContractError::SessionKeyNotFound)?;

            // Check session key has not expired
            if env.ledger().timestamp() >= session.expires_at {
                return Err(ContractError::SessionKeyExpired);
            }

            // Issue #188: Enforce explicit execute permission for session-key path
            // Session keys must have PERMISSION_EXECUTE bit set to authorize transactions.
            // This prevents unauthorized transaction invocation via scoped session keys.
            if !session.permissions.contains(PERMISSION_EXECUTE) {
                return Err(ContractError::InsufficientPermission);
            }

            let sig = signature.ok_or(ContractError::InvalidSignature)?;
            let payload = signature_payload.ok_or(ContractError::InvalidSignature)?;

            // CRITICAL: Bind signature to actual call parameters to prevent replay attacks
            // The signature must be for the exact (to, function, args, nonce) tuple being executed
            let expected_payload = Self::create_signature_payload(&env, &to, &function, &args, expected_nonce);
            if payload != expected_payload {
                return Err(ContractError::InvalidSignature);
            }

            // Verify signature using ed25519
            env.crypto().ed25519_verify(&session_pk, &payload, &sig);
        } else {
            // Fallback: require owner direct authorization
            let owner = Self::get_owner(env.clone())?;
            owner.require_auth();
        }

        // Increment nonce before invocation (checks-effects-interactions)
        env.storage()
            .instance()
            .set(&DataKey::Nonce, &(current_nonce + 1));

        // Extend instance TTL to keep contract alive
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit executed event with transaction details
        env.events().publish(
            (events::executed(&env),),
            (to.clone(), function.clone(), current_nonce),
        );

        let result: Val = env.invoke_contract(&to, &function, args);

        Ok(result)
    }

    /// Add a session key
    pub fn add_session_key(
        env: Env,
        public_key: BytesN<32>,
        expires_at: u64,
        permissions: Vec<u32>,
    ) -> Result<(), ContractError> {
        if expires_at == 0 {
            return Err(ContractError::InvalidExpiration);
        }

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

        // Issue #212: Consistently bump instance TTL in write paths
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

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

        // Issue #212: Consistently bump instance TTL in write paths
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit session_key_revoked event
        env.events()
            .publish((events::session_key_revoked(&env),), public_key);

        Ok(())
    }

    /// Upgrade the contract's WASM logic
    ///
    /// # Security
    /// - Requires owner authorization
    /// - `new_wasm_hash` must be non-zero; an all-zero hash is never a valid WASM hash
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        if new_wasm_hash == BytesN::from_array(&env, &[0u8; 32]) {
            return Err(ContractError::InvalidWasmHash);
        }

        // Increment version number
        let current_version = Self::get_version(env.clone());
        env.storage()
            .instance()
            .set(&DataKey::Version, &(current_version + 1));

        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        // Extend instance TTL to keep contract alive
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit upgraded event
        env.events()
            .publish((events::upgraded(&env),), new_wasm_hash);

        Ok(())
    }

    /// Execute a contract migration for a new version
    ///
    /// # Security
    /// - Requires owner authorization
    /// - Migration version must be strictly increasing
    pub fn migrate(env: Env, new_version: u32) -> Result<(), ContractError> {
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        let current_version = Self::get_version(env.clone());
        if new_version <= current_version {
            return Err(ContractError::InvalidVersion);
        }

        env.storage()
            .instance()
            .set(&DataKey::Version, &new_version);

        // Extend instance TTL to keep contract alive
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit migrated event
        env.events()
            .publish((events::migrated(&env),), (current_version, new_version));

        Ok(())
    }

    /// Get a session key
    pub fn get_session_key(env: Env, public_key: BytesN<32>) -> Option<SessionKey> {
        env.storage()
            .persistent()
            .get(&DataKey::SessionKey(public_key))
    }

    /// Check if a session key exists
    pub fn has_session_key(env: Env, public_key: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::SessionKey(public_key))
    }

    /// Refresh the TTL of a session key
    pub fn refresh_session_key_ttl(env: Env, public_key: BytesN<32>) -> Result<(), ContractError> {
        let session_key = Self::get_session_key(env.clone(), public_key.clone())
            .ok_or(ContractError::SessionKeyNotFound)?;

        Self::extend_session_key_ttl(&env, &public_key, session_key.expires_at);

        // Issue #212: Consistently bump instance TTL in write paths
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Issue #195: Emit event on session key TTL refresh
        env.events().publish(
            (events::session_key_ttl_refreshed(&env),),
            (public_key, session_key.expires_at),
        );

        Ok(())
    }

    /// Check if a session key is active (exists and not expired)
    /// Issue #214: Add is_session_key_active view function
    pub fn is_session_key_active(env: Env, public_key: BytesN<32>) -> bool {
        match Self::get_session_key(env.clone(), public_key) {
            Some(session_key) => env.ledger().timestamp() < session_key.expires_at,
            None => false,
        }
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

    /// Create canonical signature payload for replay protection.
    /// This MUST match the exact format used by test helpers for signature verification.
    /// Critical security: Binds signatures to specific (to, function, args, nonce) tuples.
    fn create_signature_payload(
        env: &Env,
        to: &Address,
        function: &soroban_sdk::Symbol,
        args: &Vec<Val>,
        nonce: u64,
    ) -> soroban_sdk::Bytes {
        let mut payload = soroban_sdk::Bytes::new(env);
        payload.append(&to.clone().to_xdr(env));
        payload.append(&function.clone().to_xdr(env));
        payload.append(&args.clone().to_xdr(env));
        payload.append(&nonce.to_xdr(env));
        payload
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger},
        xdr::ToXdr,
        Address, Bytes, Env,
    };

    fn sign_payload(
        env: &Env,
        signing_key: &SigningKey,
        to: &Address,
        function: &soroban_sdk::Symbol,
        args: &Vec<Val>,
        nonce: u64,
    ) -> (BytesN<64>, Bytes) {
        let mut payload = Bytes::new(env);
        payload.append(&to.clone().to_xdr(env));
        payload.append(&function.clone().to_xdr(env));
        payload.append(&args.clone().to_xdr(env));
        payload.append(&nonce.to_xdr(env));

        let mut payload_bytes = [0u8; 1024];
        let len = payload.len() as usize;
        payload.copy_into_slice(&mut payload_bytes[..len]);

        let signature = signing_key.sign(&payload_bytes[..len]);
        (BytesN::from_array(env, &signature.to_bytes()), payload)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        assert_eq!(client.get_owner(), owner);
        assert_eq!(client.get_nonce(), 0);
        assert_eq!(client.get_version(), 1);
    }

    #[test]
    fn test_get_owner_before_initialize_returns_not_initialized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let result = client.try_get_owner();
        assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
    }

    #[test]
    fn test_get_version_defaults_to_zero_before_initialize_for_compatibility() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        assert_eq!(client.get_version(), 0);
    }

    #[test]
    fn test_initialize_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let events_list = env.events().all();
        assert_eq!(events_list.len(), 1);
        let (_contract, topics, data) = events_list.get_unchecked(0).clone();
        assert_eq!(topics.len(), 1);

        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::initialized(&env));

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

        let events_list = env.events().all();
        assert!(events_list.len() >= 2);
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        assert_eq!(topics.len(), 1);

        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::session_key_added(&env));

        let data_tuple: (BytesN<32>, u64) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(data_tuple.0, session_pk);
        assert_eq!(data_tuple.1, expires_at);
    }

    #[test]
    fn test_has_session_key_present() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = 1000u64;
        let permissions = Vec::new(&env);

        // Before adding: should be false
        assert!(!client.has_session_key(&session_pk));

        client.add_session_key(&session_pk, &expires_at, &permissions);

        // After adding: should be true
        assert!(client.has_session_key(&session_pk));
    }

    #[test]
    fn test_has_session_key_absent() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);

        // Never added: should be false
        assert!(!client.has_session_key(&session_pk));
    }

    #[test]
    fn test_has_session_key_after_revoke() {
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
        assert!(client.has_session_key(&session_pk));

        client.revoke_session_key(&session_pk);
        assert!(!client.has_session_key(&session_pk));
    }

    #[test]
    fn test_revoke_session_key_removes_session_key_storage_entry() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[2u8; 32]);
        let expires_at = 1000u64;
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &expires_at, &permissions);
        assert!(client.get_session_key(&session_pk).is_some());

        client.revoke_session_key(&session_pk);
        assert!(client.get_session_key(&session_pk).is_none());
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

        let events_list = env.events().all();
        assert!(events_list.len() >= 3);
        let (_contract, topics, data) = events_list.get_unchecked(2).clone();
        assert_eq!(topics.len(), 1);

        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::session_key_revoked(&env));

        let event_pk: BytesN<32> = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(event_pk, session_pk);
    }

    /// Owner can execute; event is emitted with correct (to, function, nonce=0).
    #[test]
    fn test_execute_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        // Register a callee contract so invoke_contract succeeds
        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::Symbol::new(&env, "get_nonce");
        let args = Vec::new(&env);

        client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );

        let events_list = env.events().all();
        assert!(events_list.len() >= 2);
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        assert_eq!(topics.len(), 1);

        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::executed(&env));

        let data_tuple: (Address, soroban_sdk::Symbol, u64) =
            soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(data_tuple.0, callee_id);
        assert_eq!(data_tuple.1, function);
        assert_eq!(data_tuple.2, 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_double_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        client.initialize(&owner);
    }

    /// Passing expected_nonce = 1 when current nonce is 0 must be rejected.
    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn test_execute_rejects_invalid_nonce() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let to = Address::generate(&env);
        let function = soroban_sdk::symbol_short!("transfer");
        let args: Vec<soroban_sdk::Val> = Vec::new(&env);

        // Current nonce is 0; passing expected_nonce = 1 must fail with InvalidNonce (#4)
        client.execute(
            &CallerIdentity::Owner,
            &to,
            &function,
            &args,
            &1u64,
            &None,
            &None,
            &None,
        );
    }

    /// Correct nonce is accepted and incremented to 1 afterward.
    #[test]
    fn test_execute_validates_nonce_then_increments() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        assert_eq!(client.get_nonce(), 0);

        env.mock_all_auths();

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args: Vec<soroban_sdk::Val> = Vec::new(&env);

        let _result = client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );

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
        client.refresh_session_key_ttl(&session_pk);

        let session_key = client.get_session_key(&session_pk);
        assert!(session_key.is_some());
    }

    #[test]
    fn test_refresh_session_key_ttl_unknown_key_returns_session_key_not_found() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let unknown_session_pk = BytesN::from_array(&env, &[9u8; 32]);
        let result = client.try_refresh_session_key_ttl(&unknown_session_pk);

        assert_eq!(result, Err(Ok(ContractError::SessionKeyNotFound)));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn test_execute_rejects_duplicate_nonce() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        // First execute succeeds with nonce 0
        client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );

        // Replaying nonce 0 must fail with InvalidNonce (#4)
        client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );
    }

    #[test]
    fn test_execute_cross_contract_invocation() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        let expires_at = env.ledger().timestamp() + 10000;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);

        client.add_session_key(&session_pk, &expires_at, &permissions);

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        let (sig, payload) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);

        let result = client.execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk),
            &Some(sig),
            &Some(payload),
        );
        let result_u64: u64 = soroban_sdk::FromVal::from_val(&env, &result);
        assert_eq!(result_u64, 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn test_execute_session_key_expired() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        env.ledger().set_timestamp(2000);
        let expires_at = 1000; // Expired relative to 2000
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);
        permissions.push_back(1);

        client.add_session_key(&session_pk, &expires_at, &permissions);

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        let (sig, payload) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);

        client.execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk),
            &Some(sig),
            &Some(payload),
        );
    }

    #[test]
    fn test_execute_failed_no_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let initial_event_count = env.events().all().len();

        env.mock_all_auths();

        let to = Address::generate(&env);
        let function = soroban_sdk::symbol_short!("transfer");
        let args = Vec::new(&env);

        // Fail with InvalidNonce (#4)
        let _ = client.try_execute(
            &CallerIdentity::Owner,
            &to,
            &function,
            &args,
            &1u64,
            &None,
            &None,
            &None,
        );

        assert_eq!(env.events().all().len(), initial_event_count);
    }

    #[test]
    fn test_execute_failed_no_nonce_increment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        assert_eq!(client.get_nonce(), 0);

        env.mock_all_auths();

        let to = Address::generate(&env);
        let function = soroban_sdk::symbol_short!("transfer");
        let args = Vec::new(&env);

        // Fail with InvalidNonce (#4)
        let _ = client.try_execute(
            &CallerIdentity::Owner,
            &to,
            &function,
            &args,
            &1u64,
            &None,
            &None,
            &None,
        );

        assert_eq!(client.get_nonce(), 0);
    }

    #[test]
    fn test_execute_event_nonce_is_pre_increment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        env.mock_all_auths();

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::Symbol::new(&env, "get_nonce");
        let args = Vec::new(&env);

        client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );

        let events_list = env.events().all();
        // Index 1 because index 0 is initialized
        let (_contract, _topics, data) = events_list.get_unchecked(1).clone();
        let data_tuple: (Address, soroban_sdk::Symbol, u64) =
            soroban_sdk::FromVal::from_val(&env, &data);

        // Nonce in event matches what was provided (0)
        assert_eq!(data_tuple.2, 0);

        // State nonce is incremented to 1
        assert_eq!(client.get_nonce(), 1);
    }

    #[test]
    fn test_execute_session_key_permissions() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        let expires_at = env.ledger().timestamp() + 10000;
        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        // 1. Failure: No permissions
        let permissions_empty = Vec::new(&env);
        client.add_session_key(&session_pk, &expires_at, &permissions_empty);

        let (sig, payload) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);

        let result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk.clone()),
            &Some(sig),
            &Some(payload),
        );
        assert!(result.is_err()); // InsufficientPermission (#7)

        // 2. Success: With PERMISSION_EXECUTE
        let mut permissions_ok = Vec::new(&env);
        permissions_ok.push_back(PERMISSION_EXECUTE);
        client.add_session_key(&session_pk, &expires_at, &permissions_ok);

        let (sig2, payload2) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);

        let result2 = client.execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk),
            &Some(sig2),
            &Some(payload2),
        );
        let res_u64: u64 = soroban_sdk::FromVal::from_val(&env, &result2);
        assert_eq!(res_u64, 0);
    }

    #[test]
    fn test_execute_session_key_missing_signature_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        let expires_at = env.ledger().timestamp() + 10000;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);
        client.add_session_key(&session_pk, &expires_at, &permissions);

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        // Attempt to execute with session key but missing signature (signature=None)
        let result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk),
            &None, // signature=None
            &None, // signature_payload=None
        );

        // Should fail with InvalidSignature because no signature was provided
        assert!(matches!(result, Err(Ok(ContractError::InvalidSignature))));
    }

    #[test]
    fn test_execute_session_key_missing_payload_returns_invalid_signature() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        let expires_at = env.ledger().timestamp() + 10000;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);
        client.add_session_key(&session_pk, &expires_at, &permissions);

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);
        let (sig, _payload) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);

        // Signature present but payload missing → InvalidSignature
        let result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk),
            &Some(sig),
            &None,
        );

        assert!(matches!(result, Err(Ok(ContractError::InvalidSignature))));
    }

    #[test]
    fn test_upgrade_rejects_zero_wasm_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);
        let result = client.try_upgrade(&zero_hash);

        assert_eq!(result, Err(Ok(ContractError::InvalidWasmHash)));
    }

    #[test]
    fn test_upgrade_rejects_zero_wasm_hash_error_code() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Verify the error discriminant matches the enum ordinal (#9)
        let result = client.try_upgrade(&zero_hash);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(ContractError::InvalidWasmHash));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #10)")]
    fn test_upgrade_zero_hash_panics_with_code_10() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        // Zero hash must panic with contract error #9 (InvalidWasmHash)
        client.upgrade(&BytesN::from_array(&env, &[0u8; 32]));
    }

    #[test]
    fn test_upgrade_version_not_incremented_on_invalid_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let initial_version = client.get_version();

        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);
        let _ = client.try_upgrade(&zero_hash);

        // Version must not have changed — guard fires before state mutation
        assert_eq!(client.get_version(), initial_version);
    }

    #[test]
    fn test_upgrade_owner_auth_required_even_for_invalid_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        // No mock_all_auths: owner auth NOT satisfied

        let zero_hash = BytesN::from_array(&env, &[0u8; 32]);
        // Should panic due to missing owner auth before reaching the hash guard
        // (get_owner() + require_auth() fires first)
        let result = client.try_upgrade(&zero_hash);
        assert!(result.is_err());
    }

    #[test]
    fn test_execute_owner_path_unaffected_by_session_signature_requirements() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        // Owner path should succeed even with None signature params
        let result = client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None, // session_pub_key=None
            &None, // signature=None
            &None, // signature_payload=None
        );

        let res_u64: u64 = soroban_sdk::FromVal::from_val(&env, &result);
        assert_eq!(res_u64, 0);
    }

    #[test]
    fn test_add_session_key_zero_expiry_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let permissions = Vec::new(&env);

        let result = client.try_add_session_key(&session_pk, &0u64, &permissions);

        assert_eq!(result, Err(Ok(ContractError::InvalidExpiration)));
    }

    #[test]
    fn test_add_session_key_nonzero_expiry_succeeds() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();
        client.add_session_key(&session_pk, &expires_at, &permissions);

        // Create valid signatures for different nonces
        let (sig_nonce_0, payload_nonce_0) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);
        let (sig_nonce_1, payload_nonce_1) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 1);

        // 1. SUCCESS: Execute with nonce 0 (owner path)
        env.mock_all_auths();
        let _result = client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );
        assert_eq!(client.get_nonce(), 1);

        // 2. REJECT: Stale nonce 0 replayed with owner auth
        env.mock_all_auths();
        let stale_result = client.try_execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64, // Stale nonce
            &None,
            &None,
            &None,
        );
        assert_eq!(stale_result, Err(Ok(ContractError::InvalidNonce)));

        // 3. SUCCESS: Execute with nonce 1 (session key path)
        let result = client.execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &1u64,
            &Some(session_pk.clone()),
            &Some(sig_nonce_1),
            &Some(payload_nonce_1),
        );
        let res_u64: u64 = soroban_sdk::FromVal::from_val(&env, &result);
        assert_eq!(res_u64, 1);
        assert_eq!(client.get_nonce(), 2);

        // 4. REJECT: Stale nonce 1 replayed with session key (even with valid signature)
        let stale_result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &1u64, // Stale nonce
            &Some(session_pk.clone()),
            &Some(sig_nonce_1.clone()),
            &Some(payload_nonce_1.clone()),
        );
        assert_eq!(stale_result, Err(Ok(ContractError::InvalidNonce)));

        // 5. REJECT: Stale nonce 0 replayed with session key (old signature with stale nonce)
        let stale_result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64, // Stale nonce
            &Some(session_pk.clone()),
            &Some(sig_nonce_0),
            &Some(payload_nonce_0),
        );
        assert_eq!(stale_result, Err(Ok(ContractError::InvalidNonce)));
    }

    #[test]
    fn test_add_session_key_zero_expiry_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let permissions = Vec::new(&env);

        let result = client.try_add_session_key(&session_pk, &0u64, &permissions);

        assert_eq!(result, Err(Ok(ContractError::InvalidExpiration)));
    }

    #[test]
    fn test_add_session_key_nonzero_expiry_succeeds() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[2u8; 32]);
        let permissions = Vec::new(&env);

        // expires_at = 1 is the minimum valid value
        let result = client.try_add_session_key(&session_pk, &1u64, &permissions);
        assert!(result.is_ok());
        assert!(client.has_session_key(&session_pk));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #257 — Session key lifecycle invariant tests
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_add_revoke_readd_same_key() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[10u8; 32]);
        let permissions = Vec::new(&env);

        // add → assert present
        client.add_session_key(&session_pk, &9999u64, &permissions);
        assert!(client.has_session_key(&session_pk));

        // revoke → assert absent
        client.revoke_session_key(&session_pk);
        assert!(!client.has_session_key(&session_pk));

        // re-add same key → assert present again with new expiry
        client.add_session_key(&session_pk, &19999u64, &permissions);
        assert!(client.has_session_key(&session_pk));

        let sk = client.get_session_key(&session_pk).unwrap();
        assert_eq!(sk.expires_at, 19999u64);
    }

    #[test]
    fn test_readd_after_revoke_has_new_expiry() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[11u8; 32]);
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &500u64, &permissions);
        client.revoke_session_key(&session_pk);
        client.add_session_key(&session_pk, &888u64, &permissions);

        let sk = client.get_session_key(&session_pk).unwrap();
        assert_eq!(sk.expires_at, 888u64, "re-added key must carry new expiry");
    }

    #[test]
    fn test_revoked_key_cannot_be_resurrected_implicitly() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[12u8; 32]);
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &5000u64, &permissions);
        client.revoke_session_key(&session_pk);

        // Storage entry must be absent — get_session_key returns None
        let result = client.get_session_key(&session_pk);
        assert!(
            result.is_none(),
            "revoked key must not be implicitly resurrectable"
        );
        assert!(!client.has_session_key(&session_pk));
    }

    #[test]
    fn test_revoked_key_not_refreshable() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[13u8; 32]);
        let permissions = Vec::new(&env);

        client.add_session_key(&session_pk, &7777u64, &permissions);
        client.revoke_session_key(&session_pk);

        // refresh_session_key_ttl on a revoked (missing) key must return SessionKeyNotFound
        let result = client.try_refresh_session_key_ttl(&session_pk);
        assert_eq!(
            result,
            Err(Ok(ContractError::SessionKeyNotFound)),
            "refreshing a revoked key must fail with SessionKeyNotFound"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #258 — Event schema compatibility snapshot tests
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_initialized_event_schema() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let events_list = env.events().all();
        let (_cid, topics, data) = events_list.get_unchecked(0).clone();

        // Schema: topic[0] = Symbol("initialized"), data = Address
        let topic: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(
            topic,
            events::initialized(&env),
            "topic must be 'initialized'"
        );

        // Data field must deserialise as Address without panic
        let _event_owner: Address = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(_event_owner, owner, "data must carry the owner address");
    }

    #[test]
    fn test_session_key_added_event_schema() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[20u8; 32]);
        let expires_at = 42000u64;
        let permissions = Vec::new(&env);
        client.add_session_key(&session_pk, &expires_at, &permissions);

        // Find session_key_added event (event #1 after initialized)
        let events_list = env.events().all();
        let (_cid, topics, data) = events_list.get_unchecked(1).clone();

        let topic: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(
            topic,
            events::session_key_added(&env),
            "topic must be 'session_key_added'"
        );

        // Data schema: (BytesN<32>, u64)
        let (pk, exp): (BytesN<32>, u64) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(pk, session_pk, "event must carry the session public key");
        assert_eq!(exp, expires_at, "event must carry expires_at");
    }

    #[test]
    fn test_session_key_revoked_event_schema() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[21u8; 32]);
        client.add_session_key(&session_pk, &5000u64, &Vec::new(&env));
        client.revoke_session_key(&session_pk);

        // Revoked event is the last one
        let events_list = env.events().all();
        let (_cid, topics, data) = events_list.get_unchecked(2).clone();

        let topic: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(
            topic,
            events::session_key_revoked(&env),
            "topic must be 'session_key_revoked'"
        );

        // Data schema: BytesN<32>
        let pk: BytesN<32> = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(pk, session_pk, "event data must be the revoked public key");
    }

    #[test]
    fn test_executed_event_schema() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        client.execute(
            &CallerIdentity::Owner,
            &callee_id,
            &function,
            &args,
            &0u64,
            &None,
            &None,
            &None,
        );

        let events_list = env.events().all();
        let (_cid, topics, data) = events_list.get_unchecked(1).clone();

        let topic: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic, events::executed(&env), "topic must be 'executed'");

        // Data schema: (Address, Symbol, u64)
        let (to, func, nonce): (Address, soroban_sdk::Symbol, u64) =
            soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(to, callee_id, "event 'to' must match callee");
        assert_eq!(func, function, "event 'function' must match");
        assert_eq!(nonce, 0u64, "event nonce must be 0 for first execution");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #259 — Upgrade safety regression suite
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_unauthorized_caller_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        // Do NOT mock auth — non-owner caller should be rejected before wasm call
        let dummy_hash = BytesN::from_array(&env, &[0u8; 32]);
        // Calling upgrade without owner auth must panic (auth required)
        let result = client.try_upgrade(&dummy_hash);
        assert!(
            result.is_err(),
            "upgrade without owner auth must be rejected"
        );
    }

    #[test]
    fn test_upgrade_state_consistent_after_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let version_before = client.get_version();
        let nonce_before = client.get_nonce();

        // Attempt upgrade with a zero/invalid hash — expect the InvalidWasmHash error
        // The important invariant to test is that state is NOT corrupted
        let dummy_hash = BytesN::from_array(&env, &[0u8; 32]);
        let result = client.try_upgrade(&dummy_hash);
        // Zero hash is invalid per the upstream contract
        assert_eq!(result, Err(Ok(ContractError::InvalidWasmHash)));

        // State must remain unchanged after a failed upgrade attempt
        assert_eq!(
            client.get_version(),
            version_before,
            "version must not change after failed upgrade"
        );
        assert_eq!(
            client.get_nonce(),
            nonce_before,
            "nonce must not change after failed upgrade"
        );
        assert_eq!(
            client.get_owner(),
            owner,
            "owner must not change after failed upgrade"
        );
    }

    #[test]
    fn test_upgrade_version_semantics_on_invalid_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let v0 = client.get_version();

        // First upgrade attempt (invalid hash) — version must NOT bump
        let _ = client.try_upgrade(&BytesN::from_array(&env, &[0u8; 32]));
        let v1 = client.get_version();
        assert_eq!(v1, v0, "version must not increment on failed upgrade");

        // Second upgrade attempt (still invalid) — version must still be unchanged
        let _ = client.try_upgrade(&BytesN::from_array(&env, &[0u8; 32]));
        let v2 = client.get_version();
        assert_eq!(
            v2, v0,
            "version remains stable across multiple failed upgrade attempts"
        );
    }

    #[test]
    fn test_refresh_session_key_ttl_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[30u8; 32]);
        let expires_at = 10000u64;
        client.add_session_key(&session_pk, &expires_at, &Vec::new(&env));

        client.refresh_session_key_ttl(&session_pk);

        let events_list = env.events().all();
        // Events: initialized, session_key_added, session_key_ttl_refreshed
        let (_cid, topics, data) = events_list.get_unchecked(2).clone();

        let topic: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(
            topic,
            events::session_key_ttl_refreshed(&env),
            "topic must be 'session_key_ttl_refreshed'"
        );

        let (pk, exp): (BytesN<32>, u64) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(pk, session_pk);
        assert_eq!(exp, expires_at);
    }

    #[test]
    fn test_is_session_key_active() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[31u8; 32]);

        // Case 1: Missing key
        assert!(!client.is_session_key_active(&session_pk));

        // Case 2: Active key
        let expires_at = env.ledger().timestamp() + 1000;
        client.add_session_key(&session_pk, &expires_at, &Vec::new(&env));
        assert!(client.is_session_key_active(&session_pk));

        // Case 3: Expired key
        env.ledger().set_timestamp(expires_at + 1);
        assert!(!client.is_session_key_active(&session_pk));
    }

    #[test]
    fn test_write_paths_bump_instance_ttl() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[32u8; 32]);

        // We can't directly check the TTL value easily in Soroban tests without host functions,
        // but we can verify the functions execute and don't panic.
        // In a real environment, we'd use ledger snapshots.
        client.add_session_key(&session_pk, &1000u64, &Vec::new(&env));
        client.refresh_session_key_ttl(&session_pk);
        client.revoke_session_key(&session_pk);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #211 — Non-owner migrate rejection tests
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_migrate_unauthorized_caller_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        // Do NOT mock auth — non-owner caller should be rejected
        let result = client.try_migrate(&2u32);
        assert!(
            result.is_err(),
            "migrate without owner auth must be rejected"
        );
    }

    #[test]
    fn test_migrate_owner_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let initial_version = client.get_version();
        assert_eq!(initial_version, 1u32);

        // Successful migration should increment version
        client.migrate(&2u32);
        assert_eq!(client.get_version(), 2u32);

        // Verify migration event was emitted
        let events_list = env.events().all();
        assert!(events_list.len() >= 2); // initialized + migrated
        let (_contract, topics, data) = events_list.get_unchecked(1).clone();
        
        let topic_symbol: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get_unchecked(0));
        assert_eq!(topic_symbol, events::migrated(&env));

        let data_tuple: (u32, u32) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(data_tuple.0, 1u32); // old_version
        assert_eq!(data_tuple.1, 2u32); // new_version
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #8)")]
    fn test_migrate_invalid_version_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        // Attempt to migrate to same version should fail with InvalidVersion (#8)
        client.migrate(&1u32);
    }

    #[test]
    fn test_migrate_version_must_be_strictly_increasing() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);
        env.mock_all_auths();

        let initial_version = client.get_version();

        // Try to migrate to lower version
        let result = client.try_migrate(&0u32);
        assert_eq!(result, Err(Ok(ContractError::InvalidVersion)));
        assert_eq!(client.get_version(), initial_version);

        // Try to migrate to same version
        let result = client.try_migrate(&initial_version);
        assert_eq!(result, Err(Ok(ContractError::InvalidVersion)));
        assert_eq!(client.get_version(), initial_version);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #206 — initialize requires owner auth
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_without_owner_auth_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        // No mock_all_auths: owner has not authorised the call
        let result = client.try_initialize(&owner);
        assert!(result.is_err(), "initialize must fail when owner has not authorized");
    }
}
