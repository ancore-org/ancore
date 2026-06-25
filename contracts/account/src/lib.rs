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
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Symbol, Val, Vec,
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
    /// Arithmetic overflow occurred
    ArithmeticOverflow = 16,
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
    /// Optional contract allowlist — None means unrestricted (any contract may be called).
    /// When Some, the `to` address in execute() must be in this list.
    pub allowed_contracts: Option<Vec<Address>>,
}

#[contracttype]
pub enum DataKey {
    Owner,
    Nonce,
    SessionKey(BytesN<32>),
    Version,
}

/// Caller authorization path for [`AncoreAccount::execute`].
///
/// `Owner` requires the registered owner address signature; `SessionKey`
/// carries the public key the caller claims to be acting on behalf of, which
/// must match a stored, unexpired session key with `PERMISSION_EXECUTE`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CallerIdentity {
    Owner,
    SessionKey(BytesN<32>),
}

const DAY_IN_LEDGERS: u32 = 17280; // 24 hours * 60 min * 60 sec / 5 sec per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS; // 15 days
const MIN_MILLISECONDS_TIMESTAMP: u64 = 100_000_000_000;

/// Permission bit for send payment operations
pub const PERMISSION_SEND_PAYMENT: u32 = 0;
/// Permission bit for execute operations
/// Permission bit for session-key execute authorization.
/// Issue #188: Session keys must have this permission to invoke transactions.
/// Without this bit set, execute() returns InsufficientPermission error.
pub const PERMISSION_EXECUTE: u32 = 1;
/// Permission bit for invoke contract operations
pub const PERMISSION_INVOKE_CONTRACT: u32 = 2;

#[contract]
pub struct AncoreAccount;

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
        caller: CallerIdentity,
        to: Address,
        function: Symbol,
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

                // Enforce contract allowlist if set
                if let Some(ref allowed) = session.allowed_contracts {
                    if !allowed.contains(&to) {
                        return Err(ContractError::InsufficientPermission);
                    }
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

        // Increment nonce before invocation (checks-effects-interactions)
        let next_nonce = current_nonce
            .checked_add(1)
            .ok_or(ContractError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::Nonce, &next_nonce);

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
        allowed_contracts: Option<Vec<Address>>,
    ) -> Result<(), ContractError> {
        if expires_at == 0 {
            return Err(ContractError::InvalidExpiration);
        }

        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        // Validate permission vector contains only valid/known permissions and no duplicates
        let mut seen = Vec::new(&env);
        for permission in permissions.iter() {
            if permission != PERMISSION_SEND_PAYMENT
                && permission != PERMISSION_EXECUTE
                && permission != PERMISSION_INVOKE_CONTRACT
            {
                return Err(ContractError::InsufficientPermission);
            }
            if seen.contains(permission) {
                return Err(ContractError::InsufficientPermission);
            }
            seen.push_back(permission);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::SessionKey(public_key.clone()))
        {
            return Err(ContractError::SessionKeyAlreadyExists);
        }

        let expires_at_secs = Self::normalize_expiry_timestamp(expires_at)?;
        let current_timestamp = env.ledger().timestamp();
        if expires_at_secs <= current_timestamp {
            return Err(ContractError::SessionKeyExpirationInPast);
        }

        let session_key = SessionKey {
            public_key: public_key.clone(),
            expires_at: expires_at_secs,
            permissions,
            allowed_contracts,
        };

        env.storage()
            .persistent()
            .set(&DataKey::SessionKey(public_key.clone()), &session_key);

        Self::extend_session_key_ttl(&env, &public_key, expires_at_secs);

        // Issue #212: Consistently bump instance TTL in write paths
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Emit session_key_added event
        env.events().publish(
            (events::session_key_added(&env),),
            (public_key, expires_at_secs),
        );

        Ok(())
    }

    /// Revoke a session key
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

    /// Update the contract allowlist for an existing session key (owner only).
    ///
    /// Pass `None` to remove the restriction and allow all contracts.
    pub fn set_allowed_contracts(
        env: Env,
        public_key: BytesN<32>,
        allowed_contracts: Option<Vec<Address>>,
    ) -> Result<(), ContractError> {
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        let mut session_key = Self::get_session_key(env.clone(), public_key.clone())
            .ok_or(ContractError::SessionKeyNotFound)?;

        session_key.allowed_contracts = allowed_contracts;

        env.storage()
            .persistent()
            .set(&DataKey::SessionKey(public_key), &session_key);

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

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
        let next_version = current_version
            .checked_add(1)
            .ok_or(ContractError::ArithmeticOverflow)?;
        env.storage()
            .instance()
            .set(&DataKey::Version, &next_version);

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
        let owner = Self::get_owner(env.clone())?;
        owner.require_auth();

        let mut session_key = Self::get_session_key(env.clone(), public_key.clone())
            .ok_or(ContractError::SessionKeyNotFound)?;

        let current_timestamp = env.ledger().timestamp();
        if session_key.expires_at <= current_timestamp {
            return Err(ContractError::SessionKeyExpirationInPast);
        }

        // Normalize once at refresh entry point to remove legacy ambiguity.
        let normalized_expiry = Self::normalize_expiry_timestamp(session_key.expires_at)?;
        if normalized_expiry != session_key.expires_at {
            session_key.expires_at = normalized_expiry;
            env.storage()
                .persistent()
                .set(&DataKey::SessionKey(public_key.clone()), &session_key);
        }

        Self::extend_session_key_ttl(&env, &public_key, normalized_expiry);

        // Issue #212: Consistently bump instance TTL in write paths
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        // Issue #195: Emit event on session key TTL refresh
        env.events().publish(
            (events::session_key_ttl_refreshed(&env),),
            (public_key, normalized_expiry),
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
        // expires_at is always normalized to seconds before this helper is called.
        let expires_at_secs = expires_at;

        let ledgers_to_live = if expires_at_secs > current_timestamp {
            // Using 4 seconds-per-ledger + 1 day buffer to guarantee it outlives expiry
            let diff_seconds = expires_at_secs.saturating_sub(current_timestamp);
            let calculated_ledgers = (diff_seconds / 4).try_into().unwrap_or(u32::MAX);
            calculated_ledgers.saturating_add(DAY_IN_LEDGERS)
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

    /// Normalize supported expiry input units into unix seconds.
    ///
    /// Accepted contract:
    /// - Seconds: unix timestamp in seconds
    /// - Milliseconds: unix timestamp in milliseconds (>= MIN_MILLISECONDS_TIMESTAMP)
    fn normalize_expiry_timestamp(expires_at: u64) -> Result<u64, ContractError> {
        if expires_at == 0 {
            return Err(ContractError::InvalidExpiration);
        }

        if expires_at >= MIN_MILLISECONDS_TIMESTAMP {
            return Ok(expires_at / 1000);
        }

        Ok(expires_at)
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
        testutils::{Address as _, Events, Ledger},
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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);
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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);
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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);
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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);
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

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

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

        env.ledger().set_timestamp(1_000);
        let expires_at = env.ledger().timestamp() + 100;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

        env.ledger().set_timestamp(expires_at + 1);

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

    // ── migrate monotonicity tests ─────────────────────────────────────────────

    #[test]
    fn test_migrate_1_to_2_succeeds() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        assert_eq!(client.get_version(), 1);

        env.mock_all_auths();
        client.migrate(&2u32);

        assert_eq!(client.get_version(), 2);
    }

    #[test]
    fn test_migrate_emits_migrated_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        env.mock_all_auths();
        client.migrate(&2u32);

        let events_list = env.events().all();
        let migrated_event = events_list.iter().find(|(_, topics, _)| {
            topics.iter().any(|t| {
                let sym: soroban_sdk::Symbol = soroban_sdk::FromVal::from_val(&env, &t);
                sym == events::migrated(&env)
            })
        });

        assert!(migrated_event.is_some(), "migrated event must be emitted");

        let (_, _, data) = migrated_event.unwrap();
        let (old_ver, new_ver): (u32, u32) = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(old_ver, 1);
        assert_eq!(new_ver, 2);
    }

    #[test]
    fn test_migrate_rejects_non_increasing_version() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        env.mock_all_auths();
        // Advance to version 2
        client.migrate(&2u32);

        // Attempt to go back to version 1 — must fail with InvalidVersion (#8)
        let result = client.try_migrate(&1u32);
        assert_eq!(result, Err(Ok(ContractError::InvalidVersion)));

        // Version must remain at 2
        assert_eq!(client.get_version(), 2);
    }

    #[test]
    fn test_migrate_rejects_equal_version() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        env.mock_all_auths();
        // Advance to version 2
        client.migrate(&2u32);

        // Attempt to migrate to the same version — must fail with InvalidVersion (#8)
        let result = client.try_migrate(&2u32);
        assert_eq!(result, Err(Ok(ContractError::InvalidVersion)));

        // Version must remain at 2
        assert_eq!(client.get_version(), 2);
    }

    /// Integration test for execute() via a session-key signature.
    ///
    /// Covers the three acceptance criteria from issue #680:
    /// 1. Happy path: session key signs the canonical payload and the contract accepts,
    ///    bumping the nonce in the snapshot.
    /// 2. Wrong signature: the contract returns `InvalidSignature` and the nonce is not
    ///    advanced.
    /// 3. Expired key: advancing the ledger past `expires_at` causes execute to return
    ///    `SessionKeyExpired` and the nonce is not advanced.
    #[test]
    fn test_execute_session_key_end_to_end() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        env.ledger().set_timestamp(1_000);

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let session_pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

        let expires_at = env.ledger().timestamp() + 10_000;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);
        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

        let callee_id = env.register_contract(None, AncoreAccount);
        let function = soroban_sdk::symbol_short!("get_nonce");
        let args = Vec::new(&env);

        // 1. Happy path — session key signs the canonical payload for nonce=0.
        let (sig, payload) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 0);
        let result = client.execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &0u64,
            &Some(session_pk.clone()),
            &Some(sig),
            &Some(payload),
        );
        let nonce_result: u64 = soroban_sdk::FromVal::from_val(&env, &result);
        assert_eq!(nonce_result, 0);
        // Snapshot side-effect: the account's nonce has been incremented.
        assert_eq!(client.get_nonce(), 1);

        // 2. Wrong signature — tamper one byte; the contract must reject and the nonce
        //    must not advance.
        let (good_sig, good_payload) =
            sign_payload(&env, &signing_key, &callee_id, &function, &args, 1);
        let mut tampered = good_sig.to_array();
        tampered[0] ^= 0xFF;
        let bad_sig = BytesN::from_array(&env, &tampered);
        let bad_result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &1u64,
            &Some(session_pk.clone()),
            &Some(bad_sig),
            &Some(good_payload),
        );
        assert!(matches!(
            bad_result,
            Err(Ok(ContractError::InvalidSignature))
        ));
        assert_eq!(client.get_nonce(), 1);

        // 3. Expired key — advance the ledger past `expires_at`; execute must return
        //    SessionKeyExpired before invoking the callee, leaving the nonce unchanged.
        env.ledger().set_timestamp(expires_at + 1);
        let (sig2, payload2) = sign_payload(&env, &signing_key, &callee_id, &function, &args, 1);
        let expired_result = client.try_execute(
            &CallerIdentity::SessionKey(session_pk.clone()),
            &callee_id,
            &function,
            &args,
            &1u64,
            &Some(session_pk),
            &Some(sig2),
            &Some(payload2),
        );
        assert!(matches!(
            expired_result,
            Err(Ok(ContractError::SessionKeyExpired))
        ));
        assert_eq!(client.get_nonce(), 1);
    }

    /// Confirm PERMISSION_EXECUTE equals the value documented in
    /// contracts/account/README.md and docs/contract-methods.md.
    /// If this test fails, update the documentation tables to match the new value.
    #[test]
    fn test_permission_execute_constant_value() {
        assert_eq!(
            PERMISSION_EXECUTE, 1u32,
            "PERMISSION_EXECUTE value changed — update permission bit tables in \
             contracts/account/README.md and docs/contract-methods.md"
        );
    }

    #[test]
    fn test_upgrade_accepts_current_wasm_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        // SHA-256 of the empty WASM blob registered by default in the test environment.
        let current_wasm_hash = BytesN::from_array(
            &env,
            &[
                0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14, 0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f,
                0xb9, 0x24, 0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c, 0xa4, 0x95, 0x99, 0x1b,
                0x78, 0x52, 0xb8, 0x55,
            ],
        );

        let result = client.try_upgrade(&current_wasm_hash);
        assert!(
            result.is_ok(),
            "re-upgrading to the already-deployed wasm hash is allowed as a no-op"
        );
    }

    #[test]
    fn test_add_session_key_rejects_invalid_permissions() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = 1000u64;

        // Permission value 3 is invalid (only 0, 1, 2 are valid)
        let mut permissions = Vec::new(&env);
        permissions.push_back(3);

        let result = client.try_add_session_key(&session_pk, &expires_at, &permissions, &None);
        assert_eq!(result, Err(Ok(ContractError::InsufficientPermission)));
    }

    #[test]
    fn test_add_session_key_rejects_duplicate_permissions() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);
        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = 1000u64;

        // Duplicate permission execution (1)
        let mut permissions = Vec::new(&env);
        permissions.push_back(1);
        permissions.push_back(1);

        let result = client.try_add_session_key(&session_pk, &expires_at, &permissions, &None);
        assert_eq!(result, Err(Ok(ContractError::InsufficientPermission)));
    }

    #[test]
    fn test_allowed_contracts_none_permits_any_contract() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[11u8; 32]);
        let expires_at = 9999999999u64;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);

        // allowed_contracts = None means unrestricted
        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

        let key = client.get_session_key(&session_pk).unwrap();
        assert!(key.allowed_contracts.is_none());
    }

    #[test]
    fn test_set_allowed_contracts_restricts_execute() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[12u8; 32]);
        let expires_at = 9999999999u64;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);

        let allowed_addr = Address::generate(&env);
        let mut allowlist = Vec::new(&env);
        allowlist.push_back(allowed_addr.clone());

        client.add_session_key(&session_pk, &expires_at, &permissions, &Some(allowlist));

        let key = client.get_session_key(&session_pk).unwrap();
        assert!(key.allowed_contracts.is_some());
        let contracts = key.allowed_contracts.unwrap();
        assert_eq!(contracts.len(), 1);
        assert_eq!(contracts.get_unchecked(0), allowed_addr);
    }

    #[test]
    fn test_set_allowed_contracts_update() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AncoreAccount);
        let client = AncoreAccountClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        init(&env, &client, &owner);

        env.mock_all_auths();

        let session_pk = BytesN::from_array(&env, &[13u8; 32]);
        let expires_at = 9999999999u64;
        let mut permissions = Vec::new(&env);
        permissions.push_back(PERMISSION_EXECUTE);

        client.add_session_key(&session_pk, &expires_at, &permissions, &None);

        // Update allowlist post-creation
        let new_addr = Address::generate(&env);
        let mut new_list = Vec::new(&env);
        new_list.push_back(new_addr.clone());
        client.set_allowed_contracts(&session_pk, &Some(new_list));

        let key = client.get_session_key(&session_pk).unwrap();
        assert!(key.allowed_contracts.is_some());

        // Remove restriction
        client.set_allowed_contracts(&session_pk, &None);
        let key = client.get_session_key(&session_pk).unwrap();
        assert!(key.allowed_contracts.is_none());
    }
}
