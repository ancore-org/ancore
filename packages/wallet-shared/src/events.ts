/**
 * Canonical Soroban contract event symbol constants (Issue #1538).
 * Kept aligned with contracts/account/src/lib.rs (mod events).
 */

export const CONTRACT_EVENTS = {
  INITIALIZED: 'initialized',
  EXECUTED: 'executed',
  SESSION_KEY_ADDED: 'session_key_added',
  SESSION_KEY_REVOKED: 'session_key_revoked',
  ALLOWED_CONTRACTS_SET: 'allowed_contracts_set',
  UPGRADED: 'upgraded',
  MIGRATED: 'migrated',
  SESSION_KEY_TTL_REFRESHED: 'session_key_ttl_refreshed',
  OWNER_ADDED: 'owner_added',
  OWNER_REMOVED: 'owner_removed',
  THRESHOLD_CHANGED: 'threshold_changed',
  MODULE_REGISTERED: 'module_registered',
  MODULE_UNREGISTERED: 'module_unregistered',
} as const;

export type ContractEventName = (typeof CONTRACT_EVENTS)[keyof typeof CONTRACT_EVENTS];
