/* global __dirname */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONTRACT_EVENTS } from '../events';

describe('CONTRACT_EVENTS', () => {
  it('exports the canonical topic strings', () => {
    expect(CONTRACT_EVENTS).toEqual({
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
