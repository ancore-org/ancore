# Extension Wallet Privacy

_Last updated: 2026-06-25_

This document describes optional usage analytics in the Ancore browser extension wallet.

## Telemetry opt-in

- **Default:** off for new installs (`telemetryOptIn: false` in settings).
- **Control:** Settings → Privacy → **Usage analytics**.
- **Persistence:** stored in extension settings (`ancore-settings`) alongside other wallet preferences.

When opt-in is disabled, the telemetry client is a no-op: no events are recorded or buffered.

## What is collected (when enabled)

Events are defined in `apps/extension-wallet/src/telemetry/telemetry-schema.ts`. Examples:

| Event | Purpose |
|---|---|
| `address_copied` | Clipboard copy action succeeded |
| `wallet_lock_failure` | Lock/unlock failure category |
| `wallet_auth_failure` | Auth failure category |
| `wallet_send_failure` | Send flow failure stage |
| `wallet_execute_failure` | Contract execution failure stage |
| `wallet_tx_initiated` | Transaction started (operation type only) |
| `wallet_tx_completed` | Transaction finished (success + duration) |

Each event includes a session identifier and timestamp. No wallet addresses, private keys, mnemonics, transaction payloads, or balances are included.

## What is never collected

The extension telemetry layer does **not** collect:

- Stellar addresses or account IDs
- Private keys, mnemonics, or passwords
- Transaction amounts, memos, or operation payloads
- Contract arguments or simulation results
- IP addresses or device identifiers
- Free-form error messages that may contain user data

## Local buffering

When enabled, events are buffered locally in `localStorage` under `wallet_telemetry_events` (capped at 200 events). This buffer is cleared when you disable usage analytics. No remote upload transport is configured by default.

## Related settings

Telemetry respects the same persistence mechanism as other runtime settings in `apps/extension-wallet/src/stores/settings.ts`, consistent with network and security preference storage.
