/**
 * Issue #304 – Relayer API contract boundary and malformed payload tests.
 *
 * Covers edge cases and boundary conditions not exercised by middleware.test.ts,
 * including exact-boundary lengths, mixed-case hex, non-integer nonces,
 * and cross-field conditional requirements.
 */

import {
  relayExecuteRequestSchema,
  relayAddSessionKeyRequestSchema,
  relayRevokeSessionKeyRequestSchema,
} from './types';
import { validateRequest } from '../validation/middleware';

// G + 55 uppercase alphanumeric chars = valid Stellar address format
const STELLAR_ADDR = 'G' + 'A'.repeat(55);
const SESSION_PK_64 = 'a'.repeat(64); // exact 64-char hex
const SIG_128 = 'b'.repeat(128); // exact 128-char hex
const HEX_PAYLOAD = 'deadbeef';

// ─── /relay/execute ──────────────────────────────────────────────────────────

describe('relayExecuteRequestSchema – boundary & malformed payload', () => {
  const base = {
    accountAddress: STELLAR_ADDR,
    to: STELLAR_ADDR,
    functionName: 'transfer',
    args: [],
    nonce: 0,
    callerType: 'owner' as const,
  };

  // Nonce boundary
  it('accepts nonce = 0 (minimum valid)', () => {
    expect(() => validateRequest(relayExecuteRequestSchema, { ...base, nonce: 0 })).not.toThrow();
  });

  it('rejects float nonce', () => {
    expect(() => validateRequest(relayExecuteRequestSchema, { ...base, nonce: 1.5 })).toThrow();
  });

  it('rejects string nonce', () => {
    expect(() => validateRequest(relayExecuteRequestSchema, { ...base, nonce: '0' })).toThrow();
  });

  // functionName boundary
  it('accepts functionName of exactly 32 chars', () => {
    expect(() =>
      validateRequest(relayExecuteRequestSchema, { ...base, functionName: 'x'.repeat(32) })
    ).not.toThrow();
  });

  it('accepts functionName of exactly 1 char', () => {
    expect(() =>
      validateRequest(relayExecuteRequestSchema, { ...base, functionName: 'f' })
    ).not.toThrow();
  });

  it('rejects functionName of exactly 33 chars', () => {
    expect(() =>
      validateRequest(relayExecuteRequestSchema, { ...base, functionName: 'x'.repeat(33) })
    ).toThrow();
  });

  // Stellar address format
  it('rejects address starting with lowercase g', () => {
    expect(() =>
      validateRequest(relayExecuteRequestSchema, {
        ...base,
        accountAddress: 'g' + STELLAR_ADDR.slice(1),
      })
    ).toThrow();
  });

  it('rejects address that is 55 chars total (too short by 1)', () => {
    expect(() =>
      validateRequest(relayExecuteRequestSchema, {
        ...base,
        accountAddress: 'G' + 'A'.repeat(54), // 55 chars total, one short
      })
    ).toThrow();
  });

  it('rejects address that is 57 chars (too long)', () => {
    expect(() =>
      validateRequest(relayExecuteRequestSchema, {
        ...base,
        accountAddress: 'G' + 'A'.repeat(56),
      })
    ).toThrow();
  });

  // session_key path – conditional fields
  it('accepts session_key path with all required fields', () => {
    const data = {
      ...base,
      callerType: 'session_key' as const,
      sessionPublicKey: SESSION_PK_64,
      signature: SIG_128,
      signaturePayload: HEX_PAYLOAD,
    };
    expect(() => validateRequest(relayExecuteRequestSchema, data)).not.toThrow();
  });

  it('rejects sessionPublicKey of 63 chars (one short)', () => {
    const data = {
      ...base,
      callerType: 'session_key' as const,
      sessionPublicKey: 'a'.repeat(63),
    };
    expect(() => validateRequest(relayExecuteRequestSchema, data)).toThrow();
  });

  it('rejects sessionPublicKey of 65 chars (one over)', () => {
    const data = {
      ...base,
      callerType: 'session_key' as const,
      sessionPublicKey: 'a'.repeat(65),
    };
    expect(() => validateRequest(relayExecuteRequestSchema, data)).toThrow();
  });

  it('rejects non-hex sessionPublicKey', () => {
    const data = {
      ...base,
      callerType: 'session_key' as const,
      sessionPublicKey: 'z'.repeat(64), // 'z' is not valid hex
    };
    expect(() => validateRequest(relayExecuteRequestSchema, data)).toThrow();
  });

  it('accepts mixed-case hex sessionPublicKey', () => {
    const mixedHex = 'aAbBcCdD'.repeat(8); // 64 chars, valid hex
    const data = {
      ...base,
      callerType: 'session_key' as const,
      sessionPublicKey: mixedHex,
      signature: SIG_128,
      signaturePayload: HEX_PAYLOAD,
    };
    expect(() => validateRequest(relayExecuteRequestSchema, data)).not.toThrow();
  });

  it('rejects null body', () => {
    expect(() => validateRequest(relayExecuteRequestSchema, null)).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => validateRequest(relayExecuteRequestSchema, {})).toThrow();
  });

  it('rejects array instead of object', () => {
    expect(() => validateRequest(relayExecuteRequestSchema, [])).toThrow();
  });
});

// ─── /relay/session-key ──────────────────────────────────────────────────────

describe('relayAddSessionKeyRequestSchema – boundary & malformed payload', () => {
  const base = {
    accountAddress: STELLAR_ADDR,
    sessionPublicKey: SESSION_PK_64,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    permissions: [1],
    signature: SIG_128,
    signaturePayload: HEX_PAYLOAD,
  };

  it('accepts expiresAt = 1 (minimum positive integer)', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, expiresAt: 1 })
    ).not.toThrow();
  });

  it('rejects expiresAt = 0', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, expiresAt: 0 })
    ).toThrow();
  });

  it('rejects negative expiresAt', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, expiresAt: -1 })
    ).toThrow();
  });

  it('rejects float expiresAt', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, expiresAt: 1.5 })
    ).toThrow();
  });

  it('accepts permissions = [] (empty bitmask)', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, permissions: [] })
    ).not.toThrow();
  });

  it('rejects negative permission value', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, permissions: [-1] })
    ).toThrow();
  });

  it('rejects float permission value', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, permissions: [1.5] })
    ).toThrow();
  });

  it('rejects signature of 127 chars (too short)', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, signature: 'a'.repeat(127) })
    ).toThrow();
  });

  it('rejects signature of 129 chars (too long)', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, signature: 'a'.repeat(129) })
    ).toThrow();
  });

  it('rejects non-hex signaturePayload', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, signaturePayload: '!@#$' })
    ).toThrow();
  });

  it('rejects empty signaturePayload (non-empty hex required)', () => {
    expect(() =>
      validateRequest(relayAddSessionKeyRequestSchema, { ...base, signaturePayload: '' })
    ).toThrow();
  });
});

// ─── /relay/revoke-session-key ───────────────────────────────────────────────

describe('relayRevokeSessionKeyRequestSchema – boundary & malformed payload', () => {
  const base = {
    accountAddress: STELLAR_ADDR,
    sessionPublicKey: SESSION_PK_64,
    signature: SIG_128,
    signaturePayload: HEX_PAYLOAD,
  };

  it('accepts a well-formed revoke request', () => {
    expect(() => validateRequest(relayRevokeSessionKeyRequestSchema, base)).not.toThrow();
  });

  it('rejects missing accountAddress', () => {
    const { accountAddress: _a, ...bad } = base;
    expect(() => validateRequest(relayRevokeSessionKeyRequestSchema, bad)).toThrow();
  });

  it('rejects missing signaturePayload', () => {
    const { signaturePayload: _p, ...bad } = base;
    expect(() => validateRequest(relayRevokeSessionKeyRequestSchema, bad)).toThrow();
  });

  it('rejects non-hex signaturePayload', () => {
    expect(() =>
      validateRequest(relayRevokeSessionKeyRequestSchema, { ...base, signaturePayload: 'xyz!!' })
    ).toThrow();
  });

  it('rejects sessionPublicKey with non-hex chars', () => {
    expect(() =>
      validateRequest(relayRevokeSessionKeyRequestSchema, {
        ...base,
        sessionPublicKey: 'g'.repeat(64), // 'g' is not hex
      })
    ).toThrow();
  });

  it('rejects extra unknown fields gracefully (strips them)', () => {
    const withExtra = { ...base, unknownField: 'ignored' };
    expect(() => validateRequest(relayRevokeSessionKeyRequestSchema, withExtra)).not.toThrow();
  });
});
