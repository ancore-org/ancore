/**
 * Canonical Soroban account contract event topics.
 * Keep aligned with the `events` module in contracts/account/src/lib.rs.
 */
export const CONTRACT_EVENTS = {
  initialized: 'initialized',
  executed: 'executed',
  session_key_added: 'session_key_added',
  session_key_revoked: 'session_key_revoked',
  allowed_contracts_set: 'allowed_contracts_set',
} as const;

export type ContractEventTopic = (typeof CONTRACT_EVENTS)[keyof typeof CONTRACT_EVENTS];
