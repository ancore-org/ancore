#![no_main]

use ancore_account::{
    AncoreAccount, AncoreAccountClient, CallerIdentity, ContractError, PERMISSION_EXECUTE,
};
use arbitrary::Arbitrary;
use ed25519_dalek::{Signer, SigningKey};
use libfuzzer_sys::fuzz_target;
use rand::rngs::OsRng;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    Address, Bytes, BytesN, Env, IntoVal, Symbol, Val, Vec,
};
use soroban_sdk::xdr::ToXdr;

#[contract]
pub struct Sink;

#[contractimpl]
impl Sink {
    pub fn record(_env: Env, _amount: i128) {}
}

#[derive(Arbitrary, Debug)]
struct SpendOp {
    amount: u16,
    time_advance: u16,
}

#[derive(Arbitrary, Debug)]
struct SpendScenario {
    limit: u16,
    window: u16,
    ops: std::vec::Vec<SpendOp>,
}

// Keep in sync with AncoreAccount::canonical_execute_signing_payload
// (private to the contract crate): to_xdr || function_xdr || args_xdr || nonce_xdr.
fn sign_execute(
    env: &Env,
    signing_key: &SigningKey,
    to: &Address,
    function: &Symbol,
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
    (BytesN::from_array(&env, &signature.to_bytes()), payload)
}

// Runs random spend sequences against a session key with a cumulative
// window limit, tracking a parallel model. Invariants: stored spend never
// exceeds the limit, stored spend always equals the model, window rollovers
// reset spend, and over-limit calls fail with ExceededSpendLimit without
// touching the nonce.
fuzz_target!(|scenario: SpendScenario| {
    let limit = (scenario.limit % 1000) as i128 + 1;
    let window = (scenario.window % 600) as u64 + 1;

    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let contract_id = env.register_contract(None, AncoreAccount);
    let client = AncoreAccountClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    client.initialize(&owner);
    let sink_id = env.register_contract(None, Sink);
    let record = Symbol::new(&env, "record");

    let signing_key = SigningKey::generate(&mut OsRng);
    let pk = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

    let mut permissions = Vec::new(&env);
    permissions.push_back(PERMISSION_EXECUTE);
    client.add_session_key(
        &pk,
        &(1_000 + 10_000_000),
        &permissions,
        &None,
        &None,
        &Some(limit),
        &window,
    );

    let mut model_window_start = 1_000u64;
    let mut model_spent = 0i128;

    for op in scenario.ops.iter().take(32) {
        let amount = op.amount as i128;
        let now = env.ledger().timestamp() + op.time_advance as u64;
        env.ledger().set_timestamp(now);

        // The limit check rolls the window virtually; the rollover is only
        // persisted by apply_spend_usage on a successful execute.
        let spent_eff = if now > model_window_start + window {
            0
        } else {
            model_spent
        };
        let would_exceed = spent_eff + amount > limit;

        let nonce = client.get_nonce();
        let mut args: Vec<Val> = Vec::new(&env);
        args.push_back(amount.into_val(&env));
        let (sig, payload) = sign_execute(&env, &signing_key, &sink_id, &record, &args, nonce);
        let res = client.try_execute(
            &CallerIdentity::SessionKey(pk.clone()),
            &sink_id,
            &record,
            &args,
            &nonce,
            &Some(pk.clone()),
            &Some(sig),
            &Some(payload),
        );

        let stored = client
            .get_session_key(&pk)
            .expect("session key must persist");
        assert!(
            stored.spent_in_window <= limit,
            "stored spend {} exceeds limit {}",
            stored.spent_in_window,
            limit
        );

        if would_exceed {
            assert!(
                matches!(res, Err(Ok(ContractError::ExceededSpendLimit))),
                "expected ExceededSpendLimit, got {:?}",
                res
            );
            assert_eq!(client.get_nonce(), nonce);
        } else {
            assert!(res.is_ok(), "in-limit execute failed: {:?}", res);
            // apply_spend_usage returns early when no positive amount arg is
            // present, so storage only moves for amount > 0.
            if amount > 0 {
                if now > model_window_start + window {
                    model_window_start = now;
                    model_spent = 0;
                }
                model_spent += amount;
            }
            assert_eq!(client.get_nonce(), nonce + 1);
        }
        assert_eq!(stored.spent_in_window, model_spent, "model/storage drift");
        assert_eq!(stored.spend_window_start, model_window_start);
    }
});
