#![no_std]

//! Pluggable validation module primitives for Ancore accounts.
//!
//! The MVP defines a stable validation boundary and implements one concrete
//! policy module: an O(1) target allowlist. Account contracts can invoke
//! `validate` before dispatching an execution request.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, Address, BytesN, Env,
    Symbol,
};

const INSTANCE_BUMP_AMOUNT: u32 = 30 * 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * 17_280;
const ALLOWLIST_BUMP_AMOUNT: u32 = 30 * 17_280;
const ALLOWLIST_BUMP_THRESHOLD: u32 = 15 * 17_280;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ValidationModuleError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Disabled = 3,
    TargetNotAllowed = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidationContext {
    pub account: Address,
    pub authorizer: Address,
    pub target: Address,
    pub function: Symbol,
    pub args_hash: BytesN<32>,
    pub nonce: u64,
}

#[contractclient(name = "ValidationModuleClient")]
pub trait ValidationModuleInterface {
    fn validate(env: Env, context: ValidationContext) -> Result<(), ValidationModuleError>;
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Enabled,
    AllowedTarget(Address),
}

mod events {
    use soroban_sdk::{Env, Symbol};

    pub fn initialized(env: &Env) -> Symbol {
        Symbol::new(env, "initialized")
    }

    pub fn enabled_set(env: &Env) -> Symbol {
        Symbol::new(env, "enabled_set")
    }

    pub fn target_set(env: &Env) -> Symbol {
        Symbol::new(env, "target_set")
    }
}

#[contract]
pub struct TargetAllowlistModule;

#[contractimpl]
impl TargetAllowlistModule {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ValidationModuleError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ValidationModuleError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Enabled, &true);
        extend_instance_ttl(&env);

        env.events().publish((events::initialized(&env),), admin);

        Ok(())
    }

    pub fn set_enabled(env: Env, enabled: bool) -> Result<(), ValidationModuleError> {
        require_admin(&env)?;

        env.storage().instance().set(&DataKey::Enabled, &enabled);
        extend_instance_ttl(&env);

        env.events().publish((events::enabled_set(&env),), enabled);

        Ok(())
    }

    pub fn set_allowed_target(
        env: Env,
        target: Address,
        allowed: bool,
    ) -> Result<(), ValidationModuleError> {
        require_admin(&env)?;

        let key = DataKey::AllowedTarget(target.clone());
        if allowed {
            env.storage().persistent().set(&key, &true);
            env.storage().persistent().extend_ttl(
                &key,
                ALLOWLIST_BUMP_THRESHOLD,
                ALLOWLIST_BUMP_AMOUNT,
            );
        } else {
            env.storage().persistent().remove(&key);
        }
        extend_instance_ttl(&env);

        env.events()
            .publish((events::target_set(&env),), (target, allowed));

        Ok(())
    }

    pub fn is_allowed_target(env: Env, target: Address) -> Result<bool, ValidationModuleError> {
        ensure_initialized(&env)?;

        Ok(env
            .storage()
            .persistent()
            .has(&DataKey::AllowedTarget(target)))
    }

    pub fn admin(env: Env) -> Result<Address, ValidationModuleError> {
        admin(&env)
    }
}

#[contractimpl]
impl ValidationModuleInterface for TargetAllowlistModule {
    fn validate(env: Env, context: ValidationContext) -> Result<(), ValidationModuleError> {
        ensure_initialized(&env)?;

        let enabled = env
            .storage()
            .instance()
            .get(&DataKey::Enabled)
            .unwrap_or(false);
        if !enabled {
            return Err(ValidationModuleError::Disabled);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::AllowedTarget(context.target))
        {
            Ok(())
        } else {
            Err(ValidationModuleError::TargetNotAllowed)
        }
    }
}

fn ensure_initialized(env: &Env) -> Result<(), ValidationModuleError> {
    if env.storage().instance().has(&DataKey::Admin) {
        Ok(())
    } else {
        Err(ValidationModuleError::NotInitialized)
    }
}

fn admin(env: &Env) -> Result<Address, ValidationModuleError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ValidationModuleError::NotInitialized)
}

fn require_admin(env: &Env) -> Result<Address, ValidationModuleError> {
    let admin = admin(env)?;
    admin.require_auth();
    Ok(admin)
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{symbol_short, testutils::Address as _, Env};

    fn context(env: &Env, target: Address) -> ValidationContext {
        ValidationContext {
            account: Address::generate(env),
            authorizer: Address::generate(env),
            target,
            function: symbol_short!("execute"),
            args_hash: BytesN::from_array(env, &[0; 32]),
            nonce: 0,
        }
    }

    #[test]
    fn initialize_sets_admin_and_enabled_state() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.initialize(&admin);

        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn initialize_rejects_second_initialization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.initialize(&admin);

        let result = client.try_initialize(&admin);
        assert_eq!(result, Err(Ok(ValidationModuleError::AlreadyInitialized)));
    }

    #[test]
    fn validate_allows_configured_target() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let target = Address::generate(&env);

        client.initialize(&admin);
        client.set_allowed_target(&target, &true);

        assert!(client.is_allowed_target(&target));
        assert_eq!(client.try_validate(&context(&env, target)), Ok(Ok(())));
    }

    #[test]
    fn validate_rejects_unconfigured_target() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let target = Address::generate(&env);

        client.initialize(&admin);

        let result = client.try_validate(&context(&env, target));
        assert_eq!(result, Err(Ok(ValidationModuleError::TargetNotAllowed)));
    }

    #[test]
    fn validate_rejects_when_disabled() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let target = Address::generate(&env);

        client.initialize(&admin);
        client.set_allowed_target(&target, &true);
        client.set_enabled(&false);

        let result = client.try_validate(&context(&env, target));
        assert_eq!(result, Err(Ok(ValidationModuleError::Disabled)));
    }

    #[test]
    fn removing_target_revokes_validation() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let target = Address::generate(&env);

        client.initialize(&admin);
        client.set_allowed_target(&target, &true);
        client.set_allowed_target(&target, &false);

        assert!(!client.is_allowed_target(&target));
        let result = client.try_validate(&context(&env, target));
        assert_eq!(result, Err(Ok(ValidationModuleError::TargetNotAllowed)));
    }

    #[test]
    fn read_paths_reject_before_initialization() {
        let env = Env::default();
        let contract_id = env.register_contract(None, TargetAllowlistModule);
        let client = TargetAllowlistModuleClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        assert_eq!(
            client.try_is_allowed_target(&target),
            Err(Ok(ValidationModuleError::NotInitialized))
        );
        assert_eq!(
            client.try_validate(&context(&env, target)),
            Err(Ok(ValidationModuleError::NotInitialized))
        );
    }
}
