#![no_main]

use ancore_account::{AncoreAccount, AncoreAccountClient};
use arbitrary::Arbitrary;
use ed25519_dalek::SigningKey;
use libfuzzer_sys::fuzz_target;
use rand::rngs::OsRng;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, Vec,
};

#[derive(Arbitrary, Debug)]
struct Registration {
    expires_at: u64,
    permissions: std::vec::Vec<u32>,
    max_amount_per_call: Option<i128>,
    cumulative_limit: Option<i128>,
    spend_window_seconds: u64,
    start_timestamp: u32,
}

// Feeds arbitrary session-key registrations into add_session_key().
// Invariants: the call either succeeds (and the stored key matches the
// normalized inputs) or fails with a typed ContractError — never a host
// error, never a panic.
fuzz_target!(|input: Registration| {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger()
        .set_timestamp((input.start_timestamp % 10_000) as u64);

    let contract_id = env.register_contract(None, AncoreAccount);
    let client = AncoreAccountClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    client.initialize(&owner);

    let signing_key = SigningKey::generate(&mut OsRng);
    let pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

    let mut permissions = Vec::new(&env);
    for p in input.permissions.iter().take(8) {
        permissions.push_back(*p);
    }

    let now = env.ledger().timestamp();
    let res = client.try_add_session_key(
        &pk,
        &input.expires_at,
        &permissions,
        &None,
        &input.max_amount_per_call,
        &input.cumulative_limit,
        &input.spend_window_seconds,
    );

    match res {
        Ok(_) => {
            let stored = client.get_session_key(&pk).expect("stored key must exist");
            let normalized = if input.expires_at >= 100_000_000_000 {
                input.expires_at / 1000
            } else {
                input.expires_at
            };
            assert!(normalized > now, "stored expiry must be in the future");
            assert_eq!(stored.expires_at, normalized);
            assert_eq!(stored.max_amount_per_call, input.max_amount_per_call);
            assert_eq!(stored.cumulative_limit, input.cumulative_limit);
            assert_eq!(stored.spend_window_seconds, input.spend_window_seconds);
            assert_eq!(stored.spent_in_window, 0);
        }
        Err(Ok(_contract_error)) => {
            assert!(
                client.get_session_key(&pk).is_none(),
                "rejected registration must not persist a key"
            );
        }
        Err(Err(host_error)) => {
            panic!(
                "add_session_key surfaced a host error instead of a typed error: {:?}",
                host_error
            );
        }
    }
});
