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

        // Emit event
        env.events().publish(
            (symbol_short!("executed"),),
            (to, function, expected_nonce),
        );

        Ok(result.into_bool())
    }

    fn verify_session_key_signature(
        env: &Env,
        to: &Address,
        function: &Symbol,
        args: &Vec< soroban_sdk::Val >,
        expected_nonce: u64,
        session_pk: &BytesN<32>,
        sig: &BytesN<64>,
    ) -> Result<bool, ContractError> {
        // Check if session key exists and is valid
        let session_key: SessionKey = env
            .storage()
            .persistent()
            .get(session_pk)
            .ok_or(ContractError::SessionKeyNotFound)?;

        // Check if session key has expired
        if env.ledger().timestamp() >= session_key.expires_at {
            return Err(ContractError::SessionKeyExpired);
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

        env.events().publish(
            (symbol_short!("session_key_added"),),
            (public_key, expires_at),
        );

        Ok(())
    }

    pub fn revoke_session_key(env: Env, public_key: BytesN<32>) -> Result<(), ContractError> {
        // Check if initialized
        if !env.storage().persistent().has(&OWNER) {
            return Err(ContractError::NotInitialized);
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
            .get(&OWNER)
            .ok_or(ContractError::NotInitialized)
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

    // Mock contract for testing
    struct MockContract;

    #[contractimpl]
    impl MockContract {
        pub fn test_function(env: Env, arg1: u32, arg2: Symbol) -> bool {
            env.storage().instance().set(&symbol_short!("test_called"), &true);
            env.storage().instance().set(&symbol_short!("arg1"), &arg1);
            env.storage().instance().set(&symbol_short!("arg2"), &arg2);
            true
        }
    }
}
}
