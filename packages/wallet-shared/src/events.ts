/**
 * Canonical Soroban account contract event topics (Issue #1538).
 * Kept aligned with the `events` module in contracts/account/src/lib.rs.
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

  // Lowercase topic strings matching contract event symbol literals
  initialized: 'initialized',
  executed: 'executed',
  session_key_added: 'session_key_added',
  session_key_revoked: 'session_key_revoked',
  allowed_contracts_set: 'allowed_contracts_set',
  upgraded: 'upgraded',
  migrated: 'migrated',
  session_key_ttl_refreshed: 'session_key_ttl_refreshed',
  owner_added: 'owner_added',
  owner_removed: 'owner_removed',
  threshold_changed: 'threshold_changed',
  module_registered: 'module_registered',
  module_unregistered: 'module_unregistered',
} as const;

export type ContractEventName = (typeof CONTRACT_EVENTS)[keyof typeof CONTRACT_EVENTS];
export type ContractEventTopic = ContractEventName;
