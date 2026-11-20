/* global __dirname */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONTRACT_EVENTS } from '../events';

describe('CONTRACT_EVENTS (#1538)', () => {
  it('exports canonical topic strings in CONTRACT_EVENTS', () => {
    expect(CONTRACT_EVENTS.INITIALIZED).toBe('initialized');
    expect(CONTRACT_EVENTS.EXECUTED).toBe('executed');
    expect(CONTRACT_EVENTS.SESSION_KEY_ADDED).toBe('session_key_added');
    expect(CONTRACT_EVENTS.SESSION_KEY_REVOKED).toBe('session_key_revoked');
    expect(CONTRACT_EVENTS.ALLOWED_CONTRACTS_SET).toBe('allowed_contracts_set');
    expect(CONTRACT_EVENTS.UPGRADED).toBe('upgraded');
    expect(CONTRACT_EVENTS.MIGRATED).toBe('migrated');
    expect(CONTRACT_EVENTS.SESSION_KEY_TTL_REFRESHED).toBe('session_key_ttl_refreshed');

    expect(CONTRACT_EVENTS).toMatchObject({
      initialized: 'initialized',
      executed: 'executed',
      session_key_added: 'session_key_added',
      session_key_revoked: 'session_key_revoked',
      allowed_contracts_set: 'allowed_contracts_set',
    });
  });

  it('matches the topics emitted by contracts/account/src/lib.rs', () => {
    const source = readFileSync(
      join(__dirname, '../../../../contracts/account/src/lib.rs'),
      'utf8'
    );
    const topics = new Set(
      [...source.matchAll(/Symbol::new\(env, "([a-z_]+)"\)/g)].map((m) => m[1])
    );

    for (const topic of Object.values(CONTRACT_EVENTS)) {
      expect(topics.has(topic)).toBe(true);
    }
  });
});
