import { describe, it, expect } from 'vitest';
import { CONTRACT_EVENTS } from '../events';

describe('Canonical Soroban Contract Event Symbols (#1538)', () => {
  it('should export all canonical event topic symbols matching contract lib.rs', () => {
    expect(CONTRACT_EVENTS.INITIALIZED).toBe('initialized');
    expect(CONTRACT_EVENTS.EXECUTED).toBe('executed');
    expect(CONTRACT_EVENTS.SESSION_KEY_ADDED).toBe('session_key_added');
    expect(CONTRACT_EVENTS.SESSION_KEY_REVOKED).toBe('session_key_revoked');
    expect(CONTRACT_EVENTS.ALLOWED_CONTRACTS_SET).toBe('allowed_contracts_set');
    expect(CONTRACT_EVENTS.UPGRADED).toBe('upgraded');
    expect(CONTRACT_EVENTS.MIGRATED).toBe('migrated');
    expect(CONTRACT_EVENTS.SESSION_KEY_TTL_REFRESHED).toBe('session_key_ttl_refreshed');
  });
});
