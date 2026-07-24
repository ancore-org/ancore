#![no_main]

use ancore_account::{AncoreAccount, AncoreAccountClient, CallerIdentity, ContractError};
use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    Address, Env, IntoVal, Symbol, Val, Vec,
};

#[contract]
pub struct Sink;

#[contractimpl]
impl Sink {
    pub fn record(_env: Env, _amount: i128) {}
    pub fn poke(_env: Env) {}
}

#[derive(Arbitrary, Debug)]
struct ExecuteOp {
    use_correct_nonce: bool,
    with_amount_arg: bool,
    amount: i128,
    time_advance: u8,
}

// Drives owner-path execute() with random nonce correctness, argument shapes,
// and ledger-time movement. Invariants: nonce increments by exactly one on
// success, is unchanged on failure, and failures are typed ContractErrors
// rather than host errors or panics.
fuzz_target!(|ops: std::vec::Vec<ExecuteOp>| {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let contract_id = env.register_contract(None, AncoreAccount);
    let client = AncoreAccountClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    client.initialize(&owner);
    let sink_id = env.register_contract(None, Sink);

    let record = Symbol::new(&env, "record");
    let poke = Symbol::new(&env, "poke");

    for op in ops.iter().take(64) {
        let now = env.ledger().timestamp();
        env.ledger()
            .set_timestamp(now.saturating_add(op.time_advance as u64));

        let before = client.get_nonce();
        let expected_nonce = if op.use_correct_nonce {
            before
        } else {
            before.wrapping_add(1)
        };

        let (function, args) = if op.with_amount_arg {
            let mut args: Vec<Val> = Vec::new(&env);
            args.push_back(op.amount.into_val(&env));
            (record.clone(), args)
        } else {
            (poke.clone(), Vec::new(&env))
        };

        let res = client.try_execute(
            &CallerIdentity::Owner,
            &sink_id,
            &function,
            &args,
            &expected_nonce,
            &None,
            &None,
            &None,
        );

        if op.use_correct_nonce {
            assert!(res.is_ok(), "owner execute must succeed: {:?}", res);
            assert_eq!(client.get_nonce(), before + 1);
        } else {
            assert!(
                matches!(res, Err(Ok(ContractError::InvalidNonce))),
                "wrong nonce must be InvalidNonce, got {:?}",
                res
            );
            assert_eq!(client.get_nonce(), before);
        }
    }
});
