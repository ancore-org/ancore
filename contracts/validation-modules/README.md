# Validation Modules

This directory contains the MVP pluggable validation module interface and the
first concrete policy module for Ancore account contracts.

## Module interface

Every validation module exposes:

```rust
fn validate(env: Env, context: ValidationContext) -> Result<(), ValidationModuleError>
```

`ValidationContext` is the account-to-module boundary:

| Field        | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| `account`    | Account contract requesting validation                   |
| `authorizer` | Owner or session-key authority represented as an address |
| `target`     | Contract address the account wants to invoke             |
| `function`   | Function symbol the account wants to invoke              |
| `args_hash`  | Fixed-size digest of the execution arguments             |
| `nonce`      | Account nonce bound to the execution                     |

The interface keeps validation bounded by passing a fixed-size context instead
of an unbounded argument vector. Modules that need argument-aware rules should
validate `args_hash` against policy commitments.

## Target allowlist module

`TargetAllowlistModule` approves execution only when `context.target` is in the
module allowlist and the module is enabled.

Lifecycle:

1. `initialize(admin)` stores the module admin and enables validation.
2. `set_allowed_target(target, true)` adds a target contract.
3. `set_allowed_target(target, false)` removes a target contract.
4. `set_enabled(false)` pauses approvals without deleting policy state.
5. `validate(context)` returns `Ok(())` for allowed targets or a structured
   `ValidationModuleError` for denial.

Policy semantics:

- Deny by default: unconfigured targets fail with `TargetNotAllowed`.
- Admin controlled: policy mutations require `admin.require_auth()`.
- Pauseable: disabled modules fail closed with `Disabled`.
- Target-only MVP: `function`, `args_hash`, `nonce`, `account`, and
  `authorizer` are part of the stable interface but are not interpreted by this
  concrete allowlist module.

## Complexity

Let `n` be the number of allowlisted targets.

| Operation            | Time | Space           |
| -------------------- | ---- | --------------- |
| `initialize`         | O(1) | O(1)            |
| `set_enabled`        | O(1) | O(1)            |
| `set_allowed_target` | O(1) | O(1) per target |
| `is_allowed_target`  | O(1) | O(1)            |
| `validate`           | O(1) | O(1)            |

Total module storage is O(n).

## Account integration boundary

For the MVP, account integration is intentionally interface-level only. The
account contract should call a module before `env.invoke_contract` and treat any
module error as a failed validation. The account should derive `args_hash` from
the exact execution arguments it will invoke and bind the same nonce already
used for replay protection.

Recommended future call order inside `account.execute`:

1. Validate owner/session-key authority and nonce.
2. Build `ValidationContext` from the pending execution.
3. Invoke the configured validation module contract.
4. Increment nonce and dispatch only after module validation succeeds.

The account contract does not yet store module addresses or invoke modules in
this MVP.

## Security assumptions

- The module admin is trusted to manage policy entries.
- Account contracts must fail closed when module validation fails.
- Account contracts must pass the same target, function, argument digest, and
  nonce that will be executed.
- `args_hash` must be computed with a canonical encoding before integration is
  enabled in `account`.
- Allowlist entries are stored in persistent storage because policy state must
  survive beyond a single ledger TTL window.
- Instance storage is limited to small module configuration values needed on
  every invocation.
