//! Property-based tests for the trust boundaries called out in issue #994:
//! nonce monotonicity, expired-key rejection, and cumulative spend caps.
//! Randomized sequences are checked against a simple model so any drift
//! between expected and stored state fails loudly.

#![cfg(test)]

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use proptest::prelude::*;
use rand::rngs::OsRng;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    Address, Bytes, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

#[contract]
pub struct Sink;

#[contractimpl]
impl Sink {
    pub fn record(_env: Env, _amount: i128) {}
    pub fn poke(_env: Env) {}
}

struct Fixture {
    env: Env,
    client: AncoreAccountClient<'static>,
    sink_id: Address,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, AncoreAccount);
    let client = AncoreAccountClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    client.initialize(&owner);
    let sink_id = env.register_contract(None, Sink);
    Fixture {
        env,
        client,
        sink_id,
    }
}

fn new_session_key(env: &Env) -> (SigningKey, BytesN<32>) {
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let pk = BytesN::from_array(env, &signing_key.verifying_key().to_bytes());
    (signing_key, pk)
}

fn sign_execute(
    env: &Env,
    signing_key: &SigningKey,
    to: &Address,
    function: &Symbol,
    args: &Vec<Val>,
    nonce: u64,
) -> (BytesN<64>, Bytes) {
    let payload = AncoreAccount::canonical_execute_signing_payload(env, to, function, args, nonce);
    let mut payload_bytes = [0u8; 1024];
    let len = payload.len() as usize;
    payload.copy_into_slice(&mut payload_bytes[..len]);
    let signature = signing_key.sign(&payload_bytes[..len]);
    (BytesN::from_array(env, &signature.to_bytes()), payload)
}

fn register_execute_key(
    f: &Fixture,
    pk: &BytesN<32>,
    expires_at: u64,
    max_per_call: Option<i128>,
    cumulative: Option<i128>,
    window: u64,
) {
    let mut permissions = Vec::new(&f.env);
    permissions.push_back(PERMISSION_EXECUTE);
    f.client.add_session_key(
        pk,
        &expires_at,
        &permissions,
        &None,
        &max_per_call,
        &cumulative,
        &window,
    );
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    #[test]
    fn prop_nonce_monotonic_across_mixed_ops(use_correct_nonce in prop::collection::vec(any::<bool>(), 1..24)) {
        let f = setup();
        let poke = Symbol::new(&f.env, "poke");
        let empty_args: Vec<Val> = Vec::new(&f.env);

        for correct in use_correct_nonce {
            let before = f.client.get_nonce();
            let expected_nonce = if correct { before } else { before.wrapping_add(1) };
            let res = f.client.try_execute(
                &CallerIdentity::Owner,
                &f.sink_id,
                &poke,
                &empty_args,
                &expected_nonce,
                &None,
                &None,
                &None,
            );
            if correct {
                prop_assert!(res.is_ok());
                prop_assert_eq!(f.client.get_nonce(), before + 1);
            } else {
                prop_assert!(matches!(res, Err(Ok(ContractError::InvalidNonce))));
                prop_assert_eq!(f.client.get_nonce(), before);
            }
        }
    }

    #[test]
    fn prop_expired_session_key_always_rejected(expires_in in 1u64..10_000, overshoot in 0u64..10_000) {
        let f = setup();
        f.env.ledger().set_timestamp(1_000);
        let (_sk, pk) = new_session_key(&f.env);
        let expires_at = 1_000 + expires_in;
        register_execute_key(&f, &pk, expires_at, None, None, 0);

        f.env.ledger().set_timestamp(expires_at + overshoot);
        let poke = Symbol::new(&f.env, "poke");
        let res = f.client.try_execute(
            &CallerIdentity::SessionKey(pk.clone()),
            &f.sink_id,
            &poke,
            &Vec::new(&f.env),
            &0u64,
            &Some(pk),
            &None,
            &None,
        );
        prop_assert!(matches!(res, Err(Ok(ContractError::SessionKeyExpired))));
        prop_assert_eq!(f.client.get_nonce(), 0);
    }

    #[test]
    fn prop_cumulative_spend_cap_never_exceeded(
        amounts in prop::collection::vec(1i128..40, 1..12),
        advances in prop::collection::vec(0u64..120, 1..12),
        limit in 50i128..200,
        window in 60u64..600,
    ) {
        let f = setup();
        f.env.ledger().set_timestamp(1_000);
        let (sk, pk) = new_session_key(&f.env);
        let expires_at = 1_000 + 1_000_000;
        register_execute_key(&f, &pk, expires_at, None, Some(limit), window);

        let record = Symbol::new(&f.env, "record");
        let mut model_window_start = 1_000u64;
        let mut model_spent = 0i128;

        for (amount, advance) in amounts.iter().zip(advances.iter().cycle()) {
            let now = f.env.ledger().timestamp() + advance;
            f.env.ledger().set_timestamp(now);

            // The limit check rolls the window virtually; the rollover is
            // only persisted by apply_spend_usage on a successful execute.
            let spent_eff = if now > model_window_start + window {
                0
            } else {
                model_spent
            };
            let would_exceed = spent_eff + amount > limit;

            let nonce = f.client.get_nonce();
            let mut args: Vec<Val> = Vec::new(&f.env);
            args.push_back(amount.into_val(&f.env));
            let (sig, payload) = sign_execute(&f.env, &sk, &f.sink_id, &record, &args, nonce);
            let res = f.client.try_execute(
                &CallerIdentity::SessionKey(pk.clone()),
                &f.sink_id,
                &record,
                &args,
                &nonce,
                &Some(pk.clone()),
                &Some(sig),
                &Some(payload),
            );

            let stored = f.client.get_session_key(&pk).unwrap();
            prop_assert!(stored.spent_in_window <= limit);
            if would_exceed {
                prop_assert!(matches!(res, Err(Ok(ContractError::ExceededSpendLimit))));
                prop_assert_eq!(f.client.get_nonce(), nonce);
                prop_assert_eq!(stored.spent_in_window, model_spent);
                prop_assert_eq!(stored.spend_window_start, model_window_start);
            } else {
                prop_assert!(res.is_ok());
                // apply_spend_usage returns early when no positive amount arg
                // is present, so storage only moves for amount > 0.
                if *amount > 0 {
                    if now > model_window_start + window {
                        model_window_start = now;
                        model_spent = 0;
                    }
                    model_spent += amount;
                }
                prop_assert_eq!(f.client.get_nonce(), nonce + 1);
                prop_assert_eq!(stored.spent_in_window, model_spent);
                prop_assert_eq!(stored.spend_window_start, model_window_start);
            }
        }
    }

    #[test]
    fn prop_per_call_limit_boundary(amount in 1i128..100, limit in 1i128..100) {
        let f = setup();
        f.env.ledger().set_timestamp(1_000);
        let (sk, pk) = new_session_key(&f.env);
        register_execute_key(&f, &pk, 1_000 + 10_000, Some(limit), None, 0);

        let record = Symbol::new(&f.env, "record");
        let mut args: Vec<Val> = Vec::new(&f.env);
        args.push_back(amount.into_val(&f.env));
        let (sig, payload) = sign_execute(&f.env, &sk, &f.sink_id, &record, &args, 0);
        let res = f.client.try_execute(
            &CallerIdentity::SessionKey(pk.clone()),
            &f.sink_id,
            &record,
            &args,
            &0u64,
            &Some(pk),
            &Some(sig),
            &Some(payload),
        );
        if amount > limit {
            prop_assert!(matches!(res, Err(Ok(ContractError::ExceededSpendLimit))));
            prop_assert_eq!(f.client.get_nonce(), 0);
        } else {
            prop_assert!(res.is_ok());
            prop_assert_eq!(f.client.get_nonce(), 1);
        }
    }

    #[test]
    fn prop_spend_policy_validation_matches_rules(
        max_per_call in prop::option::of(any::<i128>()),
        cumulative in prop::option::of(any::<i128>()),
        window in any::<u64>(),
    ) {
        let f = setup();
        f.env.ledger().set_timestamp(1_000);
        let (_sk, pk) = new_session_key(&f.env);

        let invalid = matches!(max_per_call, Some(v) if v <= 0)
            || matches!(cumulative, Some(v) if v <= 0)
            || (cumulative.is_some() && window == 0)
            || (window > 0 && cumulative.is_none());

        let mut permissions = Vec::new(&f.env);
        permissions.push_back(PERMISSION_EXECUTE);
        let res = f.client.try_add_session_key(
            &pk,
            &(1_000 + 10_000),
            &permissions,
            &None,
            &max_per_call,
            &cumulative,
            &window,
        );
        if invalid {
            prop_assert!(matches!(res, Err(Ok(ContractError::InvalidSpendPolicy))));
            prop_assert!(f.client.get_session_key(&pk).is_none());
        } else {
            prop_assert!(res.is_ok());
            let stored = f.client.get_session_key(&pk).unwrap();
            prop_assert_eq!(stored.max_amount_per_call, max_per_call);
            prop_assert_eq!(stored.cumulative_limit, cumulative);
            prop_assert_eq!(stored.spend_window_seconds, window);
            prop_assert_eq!(stored.spent_in_window, 0);
        }
    }
}
