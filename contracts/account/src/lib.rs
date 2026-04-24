      #![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    Symbol, Vec,
};

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
    /// Invalid expiration provided for session key
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
pub struct SessionKey {
    pub public_key: BytesN<32>,
    pub expires_at: u64,
    pub permissions: Vec<u32>,
}

const OWNER: Symbol = symbol_short!("OWNER");
const NONCE: Symbol = symbol_short!("NONCE");
const VERSION: Symbol = symbol_short!("VERSION");

pub struct AccountContract;

#[contractimpl]
impl AccountContract {
    pub fn initialize(env: Env, owner: Address) {
        if env.storage().persistent().has(&OWNER) {
            panic!("already initialized")
        }
        env.storage().persistent().set(&OWNER, &owner);
        env.storage().persistent().set(&NONCE, &0u64);
        env.storage().persistent().set(&VERSION, &0u32);
        
        env.events().publish((symbol_short!("initialized"),), owner);
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

        // Check authentication
        let is_authorized = if let (Some(session_pk), Some(sig)) = (session_pub_key, signature) {
            // Session key authentication - compute payload on-chain and verify
            Self::verify_session_key_signature(&env, &to, &function, &args, expected_nonce, &session_pk, &sig)?
        } else {
            // Owner authentication
            env.invoker() == owner
        };

        if !is_authorized {
            return Err(ContractError::Unauthorized);
        }

        // Increment nonce
        env.storage().persistent().set(&NONCE, &(current_nonce + 1));

        // Execute the function call
        let result = env.invoke_contract(&to, &function, args);

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

        // Compute the expected payload on-chain (no redundant signature_payload parameter)
        let expected_payload = Self::create_signature_payload(env, to, function, args, expected_nonce);

        // Verify the signature using the computed payload instead of caller-provided
        let is_valid = env.crypto().ed25519_verify(session_pk, &expected_payload, sig);

        if !is_valid {
            return Err(ContractError::InvalidSignature);
        }

        Ok(true)
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
        client.initialize(&owner);

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
        client.initialize(&owner);

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

        // Sign the payload
        let signature_bytes: [u8; 64] = signing_key.sign(&payload.to_bytes()).to_bytes();
        let signature = BytesN::from_array(&env, &signature_bytes);

        // Execute with session key
        let result = client.execute(
            &callee_id,
            &function,
            args,
            &new_nonce,
            &Some(session_pk),
            &Some(signature),
        );
        assert_eq!(result, Ok(true));

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
        client.initialize(&owner);

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
        client.initialize(&owner);

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
        client.initialize(&owner);

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
        client.initialize(&owner);

        // Try to migrate as non-owner (default invoker is not the owner)
        let result = client.migrate(&1u32);
        assert_eq!(result, Err(ContractError::Unauthorized));

        // Version should remain unchanged
        assert_eq!(client.get_version(), 0);
    }

    #[test]
    fn test_migrate_not_initialized_fails() {
        let env = Env::default();
        let contract_id = env.register_contract(None, AccountContract);
        let client = AccountContractClient::new(&env, &contract_id);

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
        client.initialize(&owner);

        // Migrate from 0 to 2
        client.migrate(&2u32).unwrap();

        // Check that the migrated event was emitted
        let events = env.events().all();
        assert_eq!(events.len(), 2); // initialized + migrated events
        
        let migrated_event = &events[1];
        assert_eq!(migrated_event.topics[0], symbol_short!("migrated"));
        assert_eq!(migrated_event.data[0], 0u32.into()); // old_version
        assert_eq!(migrated_event.data[1], 2u32.into()); // new_version
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
}
}
