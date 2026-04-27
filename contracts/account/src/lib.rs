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

use soroban_sdk::xdr::ToXdr;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    Symbol, Vec,
};

#[cfg(not(target_family = "wasm"))]
use ed25519_dalek::{Signature as DalekSignature, VerifyingKey};

/// Contract error types for structured error handling
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidNonce = 4,
    SessionKeyNotFound = 5,
    SessionKeyExpired = 6,
    InsufficientPermission = 7,
    InvalidVersion = 8,
    InvalidSignature = 9,
    /// Invalid WASM hash provided for upgrade
    InvalidWasmHash = 10,
    /// Invalid expiration time provided
    InvalidExpiration = 11,
    /// Caller identity does not match provided auth parameters
    InvalidCallerIdentity = 12,
    /// Signature payload does not match the canonical execute() signing payload
    SignaturePayloadMismatch = 13,
    /// Session key registration already exists
    SessionKeyAlreadyExists = 14,
    /// Session key expiration is already in the past
    SessionKeyExpirationInPast = 15,
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
pub struct SessionKey {
    pub public_key: BytesN<32>,
    pub expires_at: u64,
    pub permissions: Vec<u32>,
}

const OWNER: Symbol = symbol_short!("OWNER");
const NONCE: Symbol = symbol_short!("NONCE");
const VERSION: Symbol = symbol_short!("VERSION");

pub struct AccountContract;

fn verify_ed25519_signature(
    _env: &Env,
    public_key: &BytesN<32>,
    message: &soroban_sdk::Bytes,
    signature: &BytesN<64>,
) -> Result<(), ContractError> {
    #[cfg(not(target_family = "wasm"))]
    {
        let verifying_key = VerifyingKey::from_bytes(&public_key.to_array())
            .map_err(|_| ContractError::InvalidSignature)?;
        let dalek_sig = DalekSignature::from_bytes(&signature.to_array());

        // Avoid dynamic allocation by copying into a bounded stack buffer.
        // The execute signing payload is expected to be small.
        let msg_buf = message.to_buffer::<1024>();
        verifying_key
            .verify_strict(msg_buf.as_slice(), &dalek_sig)
            .map_err(|_| ContractError::InvalidSignature)?;
        Ok(())
    }

    #[cfg(target_family = "wasm")]
    {
        _env.crypto().ed25519_verify(public_key, message, signature);
        Ok(())
    }
}

#[contractimpl]
impl AccountContract {
    pub fn initialize(env: Env, owner: Address) {
        if env.storage().persistent().has(&OWNER) {
            panic!("already initialized")
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
        caller: CallerIdentity,
        to: Address,
        function: Symbol,
        args: Vec< soroban_sdk::Val >,
        expected_nonce: u64,
        session_pub_key: Option<BytesN<32>>,
        signature: Option<BytesN<64>>,
    ) -> Result<bool, ContractError> {
        // Check if initialized
        if !env.storage().persistent().has(&OWNER) {
            return Err(ContractError::NotInitialized);
        }

        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        let current_nonce: u64 = env.storage().persistent().get(&NONCE).unwrap();

        // Validate nonce
        if expected_nonce != current_nonce {
            return Err(ContractError::InvalidNonce);
        }

        match caller {
            // Owner auth path: reject any session-key auth parameters.
            CallerIdentity::Owner => {
                if session_pub_key.is_some() || signature.is_some() || signature_payload.is_some() {
                    return Err(ContractError::InvalidCallerIdentity);
                }
                let owner = Self::get_owner(env.clone())?;
                owner.require_auth();
            }
            CallerIdentity::SessionKey(expected_session_pk) => {
                let session_pk = session_pub_key.ok_or(ContractError::InvalidCallerIdentity)?;
                if session_pk != expected_session_pk {
                    return Err(ContractError::InvalidCallerIdentity);
                }

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
                let expected_payload = Self::canonical_execute_signing_payload(
                    &env,
                    &to,
                    &function,
                    &args,
                    expected_nonce,
                );
                if payload != expected_payload {
                    return Err(ContractError::SignaturePayloadMismatch);
                }

                verify_ed25519_signature(&env, &session_pk, &payload, &sig)?;
            }
        }

        // Increment nonce
        env.storage().persistent().set(&NONCE, &(current_nonce + 1));

        // Execute the function call
        let result = env.invoke_contract(&to, &function, args);

        // Emit event
        env.events().publish(
            (symbol_short!("executed"),),
            (to, function, expected_nonce),
        );

        Ok(result.into_bool())
    }

    fn create_signature_payload(
        env: &Env,
        to: &Address,
        function: &Symbol,
        args: &Vec< soroban_sdk::Val >,
        nonce: u64,
    ) -> BytesN<32> {
        let mut payload = Vec::new(env);
        payload.push_back(to.to_val());
        payload.push_back(function.to_val());
        payload.push_back(args.to_val());
        payload.push_back(nonce.to_val());
        
        env.crypto().sha256(&payload.to_val())
    }

    pub fn add_session_key(
        env: Env,
        public_key: BytesN<32>,
        expires_at: u64,
        permissions: Vec<u32>,
    ) -> Result<(), ContractError> {
        // Check if initialized
        if !env.storage().persistent().has(&OWNER) {
            return Err(ContractError::NotInitialized);
        }

        // Only owner can add session keys
        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        if env.invoker() != owner {
            return Err(ContractError::Unauthorized);
        }

        // Validate expires_at is in the future
        if expires_at <= env.ledger().timestamp() {
            panic!("expires_at must be in the future");
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::SessionKey(public_key.clone()))
        {
            return Err(ContractError::SessionKeyAlreadyExists);
        }

        let current_timestamp = env.ledger().timestamp();
        let expires_at_secs = if expires_at > 100_000_000_000 {
            expires_at / 1000
        } else {
            expires_at
        };
        if expires_at_secs <= current_timestamp {
            return Err(ContractError::SessionKeyExpirationInPast);
        }

        let session_key = SessionKey {
            public_key: public_key.clone(),
            expires_at,
            permissions,
        };

        env.storage().persistent().set(&public_key, &session_key);

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

    pub fn revoke_session_key(env: Env, public_key: BytesN<32>) -> Result<(), ContractError> {
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        if !env
            .storage()
            .persistent()
            .has(&DataKey::SessionKey(public_key.clone()))
        {
            return Err(ContractError::SessionKeyNotFound);
        }

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

        // Only owner can revoke session keys
        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        if env.invoker() != owner {
            return Err(ContractError::Unauthorized);
        }

        // Check if session key exists
        if !env.storage().persistent().has(&public_key) {
            return Err(ContractError::SessionKeyNotFound);
        }

        env.storage().persistent().remove(&public_key);

        env.events().publish(
            (symbol_short!("session_key_revoked"),),
            public_key,
        );

        Ok(())
    }

    pub fn get_session_key(env: Env, public_key: BytesN<32>) -> Option<SessionKey> {
        env.storage().persistent().get(&public_key)
    }

    pub fn get_owner(env: Env) -> Result<Address, ContractError> {
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
    fn canonical_execute_signing_payload(
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
        testutils::{Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
        Address, Bytes, Env, IntoVal,
    };

    fn sign_payload(
        env: &Env,
        signing_key: &SigningKey,
        to: &Address,
        function: &soroban_sdk::Symbol,
        args: &Vec<Val>,
        nonce: u64,
    ) -> (BytesN<64>, Bytes) {
        let payload =
            AncoreAccount::canonical_execute_signing_payload(env, to, function, args, nonce);

        let mut payload_bytes = [0u8; 1024];
        let len = payload.len() as usize;
        payload.copy_into_slice(&mut payload_bytes[..len]);

        let signature = signing_key.sign(&payload_bytes[..len]);
        (BytesN::from_array(env, &signature.to_bytes()), payload)
    }

    fn init(env: &Env, client: &AncoreAccountClient, owner: &Address) {
        env.mock_all_auths();
        client.initialize(owner);
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);
        init(&env, &client, &owner);
    }

    /// Passing expected_nonce = 1 when current nonce is 0 must be rejected.
    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn test_execute_rejects_invalid_nonce() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
    fn test_add_session_key() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);

        // Never added: should be false
        assert!(!client.has_session_key(&session_pk));
    }

    pub fn get_nonce(env: Env) -> Result<u64, ContractError> {
        env.storage()
            .persistent()
            .get(&NONCE)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_version(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&VERSION)
            .unwrap_or(0)
    }

    pub fn migrate(env: Env, new_version: u32) -> Result<(), ContractError> {
        // Check if initialized
        if !env.storage().persistent().has(&OWNER) {
            return Err(ContractError::NotInitialized);
        }

        // Only owner can migrate
        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        if env.invoker() != owner {
            return Err(ContractError::Unauthorized);
        }

        let current_version: u32 = env.storage().persistent().get(&VERSION).unwrap_or(0);

        // Enforce version monotonicity - new version must be greater than current
        if new_version <= current_version {
            return Err(ContractError::InvalidVersion);
        }

        // Update version
        env.storage().persistent().set(&VERSION, &new_version);

        // Emit migration event
        env.events().publish(
            (symbol_short!("migrated"),),
            (current_version, new_version),
        );

        Ok(())
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        // Check if initialized
        if !env.storage().persistent().has(&OWNER) {
            return Err(ContractError::NotInitialized);
        }

        // Only owner can upgrade
        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        if env.invoker() != owner {
            return Err(ContractError::Unauthorized);
        }

        // Validate new_wasm_hash is not zero
        if new_wasm_hash == BytesN::from_array(&env, &[0u8; 32]) {
            panic!("invalid wasm hash");
        }

        env.deployer().update_current_contract_wasm(new_wasm_hash);

        env.events().publish(
            (symbol_short!("upgraded"),),
            new_wasm_hash,
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::BytesN as _, symbol_short, vec};

    #[test]
    fn test_add_session_key_zero_expiry_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        let signing_key = ed25519_dalek::SigningKey::generate(&mut rand::thread_rng());
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());
        let expires_at = 0u64; // Zero expiry should be rejected
        let permissions = vec![&env, 1u32];

        let result = client.add_session_key(&session_pk, &expires_at, &permissions);
        
        // This should panic due to the validation check in the contract
        // The contract has: if expires_at <= env.ledger().timestamp() { panic!("expires_at must be in the future"); }
    }

    #[test]
    fn test_add_session_key_nonzero_expiry_succeeds() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        client.initialize(&owner);

        let signing_key = ed25519_dalek::SigningKey::generate(&mut rand::thread_rng());
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());
        let expires_at = env.ledger().timestamp() + 1000; // Non-zero expiry
        let permissions = vec![&env, 1u32]; // Basic permission

        client.add_session_key(&session_pk, &expires_at, &permissions);

        let retrieved_key = client.get_session_key(&session_pk);
        assert!(retrieved_key.is_some());
        let key = retrieved_key.unwrap();
        assert_eq!(key.public_key, session_pk);
        assert_eq!(key.expires_at, expires_at);
        assert_eq!(key.permissions, permissions);
    }

    #[test]
    fn test_nonce_replay_protection_owner_and_session_key() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        // Setup
        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        // Create session key
        let signing_key = ed25519_dalek::SigningKey::generate(&mut rand::thread_rng());
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());
        let expires_at = env.ledger().timestamp() + 1000; // Non-zero expiry
        let permissions = vec![&env, 1u32]; // Basic permission

        client.add_session_key(&session_pk, &expires_at, &permissions);

        // Register a callee contract
        let callee_id = env.register_contract(None, MockContract);
        let callee_client = MockContractClient::new(&env, &callee_id);

        // Define function and args
        let function = symbol_short!("test_function");
        let args = vec![&env, 42u32.into(), symbol_short!("hello").into()];

        // Test owner execution
        let initial_nonce = client.get_nonce().unwrap();
        assert_eq!(initial_nonce, 0);

        // Owner should be able to execute without session key
        let result = client.execute(
            &callee_id,
            &function,
            args.clone(),
            &initial_nonce,
            &None::<BytesN<32>>,
            &None::<BytesN<64>>,
        );
        assert_eq!(result, Ok(true));

        // Nonce should increment
        let new_nonce = client.get_nonce().unwrap();
        assert_eq!(new_nonce, 1);

        // Test session key execution
        // Create signature payload
        let payload = AccountContract::create_signature_payload(
            &env,
            &callee_id,
            &function,
            &args,
            new_nonce,
        );

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        // Nonce should increment again
        let final_nonce = client.get_nonce().unwrap();
        assert_eq!(final_nonce, 2);

        // Test replay protection - using same nonce should fail
        let result = client.execute(
            &callee_id,
            &function,
            vec![&env],
            &new_nonce, // Reusing old nonce
            &Some(session_pk),
            &Some(signature),
        );
        assert_eq!(result, Err(ContractError::InvalidNonce));
    }

    #[test]
    fn test_migrate_invalid_version_equal_to_current() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        // Initial version should be 0
        assert_eq!(client.get_version(), 0);

        // Try to migrate to same version (0) - should fail
        let result = client.migrate(&0u32);
        assert_eq!(result, Err(ContractError::InvalidVersion));

        // Version should remain unchanged
        assert_eq!(client.get_version(), 0);
    }

    #[test]
    fn test_migrate_invalid_version_less_than_current() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        // First, migrate to version 2
        client.migrate(&2u32).unwrap();
        assert_eq!(client.get_version(), 2);

        // Try to migrate to version 1 (less than current) - should fail
        let result = client.migrate(&1u32);
        assert_eq!(result, Err(ContractError::InvalidVersion));

        // Version should remain unchanged
        assert_eq!(client.get_version(), 2);
    }

    #[test]
    fn test_migrate_valid_higher_version_succeeds() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        // Initial version should be 0
        assert_eq!(client.get_version(), 0);

        // Migrate to version 1 - should succeed
        client.migrate(&1u32).unwrap();
        assert_eq!(client.get_version(), 1);

        // Migrate to version 3 - should succeed
        client.migrate(&3u32).unwrap();
        assert_eq!(client.get_version(), 3);

        // Migrate to version 10 - should succeed
        client.migrate(&10u32).unwrap();
        assert_eq!(client.get_version(), 10);
    }

    #[test]
    fn test_migrate_unauthorized_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        // No mock_all_auths: owner auth NOT satisfied

        // Try to migrate as non-owner (default invoker is not the owner)
        let result = client.migrate(&1u32);
        assert_eq!(result, Err(ContractError::Unauthorized));

        // Version should remain unchanged
        assert_eq!(client.get_version(), 0);
    }

    #[test]
    fn test_migrate_not_initialized_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
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

        // Try to migrate without initialization - should fail
        let result = client.migrate(&1u32);
        assert_eq!(result, Err(ContractError::NotInitialized));
    }

    #[test]
    fn test_migrate_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[2u8; 32]);
        let permissions = Vec::new(&env);

    #[contractimpl]
    impl MockContract {
        pub fn test_function(env: Env, arg1: u32, arg2: Symbol) -> bool {
            env.storage().instance().set(&symbol_short!("test_called"), &true);
            env.storage().instance().set(&symbol_short!("arg1"), &arg1);
            env.storage().instance().set(&symbol_short!("arg2"), &arg2);
            true
        }
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);

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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        let non_owner = Address::generate(&env);
        init(&env, &client, &owner);

        let dummy_hash = BytesN::from_array(&env, &[0u8; 32]);

        env.mock_auths(&[MockAuth {
            address: &non_owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: (dummy_hash.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let result = client.try_upgrade(&dummy_hash);
        assert!(result.is_err(), "non-owner upgrade must be rejected");
    }

    #[test]
    fn test_upgrade_state_consistent_after_auth() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
        env.set_auths(&[] as &[soroban_sdk::xdr::SorobanAuthorizationEntry]);

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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        init(&env, &client, &owner);
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
        assert!(
            result.is_err(),
            "initialize must fail when owner has not authorized"
        );
    }
}
}
