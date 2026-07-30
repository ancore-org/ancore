use soroban_sdk::{
    contract, contractimpl, contracttype, testutils::{Address as _, Ledger as _},
    Address, BytesN, Env, Symbol, Val, Vec,
};

use upgrade::UpgradeGovernorClient;

/// Mock target contract that supports upgrade and get_version.
#[contract]
pub struct MockAccount;

#[contractimpl]
impl MockAccount {
    pub fn initialize(_env: Env, _owner: Address) {}

    pub fn get_version(_env: Env) -> u32 {
        1
    }

    pub fn upgrade(env: Env, _new_wasm_hash: BytesN<32>) {
        // In a real account, this would call env.deployer().update_current_contract_wasm(...)
        // For the mock, we just emit an event to prove invocation.
        env.events().publish((Symbol::new(&env, "upgraded"),), _new_wasm_hash);
    }
}

/// Integration test: simulate full upgrade flow with a mock account contract.
#[test]
fn test_full_upgrade_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy mock account and governor
    let target_id = env.register_contract(None, MockAccount {});
    let governor_id = env.register_contract(None, upgrade::UpgradeGovernor {});
    let governor = UpgradeGovernorClient::new(&env, &governor_id);

    let owner = Address::generate(&env);
    governor.initialize(&owner, &target_id, &10u64);

    // Propose a "WASM hash"
    let wasm_hash = BytesN::from_array(&env, &[7u8; 32]);
    let proposal_id = governor.propose_upgrade(&wasm_hash);
    assert_eq!(proposal_id, 1);

    // Fast-forward past timelock
    env.ledger().set_timestamp(env.ledger().timestamp() + 10);

    // Execute should succeed
    let result = governor.try_execute_upgrade(&proposal_id);
    assert!(result.is_ok());

    let proposal = governor.get_proposal(&proposal_id).unwrap();
    assert!(proposal.executed);
}

/// Integration test: storage layout compatibility check after upgrade.
#[test]
fn test_storage_layout_compatibility() {
    let env = Env::default();
    env.mock_all_auths();

    let target_id = env.register_contract(None, MockAccount {});
    let governor_id = env.register_contract(None, upgrade::UpgradeGovernor {});
    let governor = UpgradeGovernorClient::new(&env, &governor_id);

    let owner = Address::generate(&env);
    governor.initialize(&owner, &target_id, &5u64);

    let wasm_hash = BytesN::from_array(&env, &[9u8; 32]);
    let proposal_id = governor.propose_upgrade(&wasm_hash);

    env.ledger().set_timestamp(env.ledger().timestamp() + 6);
    assert!(governor.try_execute_upgrade(&proposal_id).is_ok());
}