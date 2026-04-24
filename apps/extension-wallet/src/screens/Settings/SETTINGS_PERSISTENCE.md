# Settings persistence defaults and migration notes

This document describes the runtime/persistence contract for extension settings that affect lock, security, network, and theme behavior.

## Persisted store

Store key: `ancore-settings`

Defaults (used for first run and migration fallback):

- `network`: `"testnet"`
- `theme`: `"dark"`
- `autoLockMinutes`: `15`
- `requirePasswordForSensitiveActions`: `true`

## Migration behavior for missing keys

The settings store merges persisted payloads with defaults.

When a persisted key is missing (for example from an older release), the runtime state falls back to the default value above.

Invalid persisted values are also coerced to defaults for safety:

- unknown `network` -> `"testnet"`
- unknown `theme` -> `"dark"`
- invalid `autoLockMinutes` -> `15`
- missing/invalid `requirePasswordForSensitiveActions` -> `true`

## Immediate application behavior

- **Auto-lock timeout** changes are propagated to the active lock manager instance through a settings subscription (no restart required).
- **Theme** changes are applied immediately by updating `document.documentElement.dataset.theme` and restored at hydration.
- **Network/security toggle** updates are persisted and reflected immediately in settings screens and runtime consumers.
