import { validateRequest } from './middleware';
import {
  relayExecuteRequestSchema,
  relayAddSessionKeyRequestSchema,
  relayRevokeSessionKeyRequestSchema,
  type ValidationErrorResponse,
} from '../api/types';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const VALID_STELLAR_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA';
const VALID_SESSION_PK = 'a'.repeat(64); // 64 hex chars
const VALID_SIGNATURE = 'b'.repeat(128); // 128 hex chars
const VALID_PAYLOAD = 'deadbeef';

// ─── POST /relay/execute ──────────────────────────────────────────────────────

describe('relayExecuteRequestSchema', () => {
  const valid = {
    accountAddress: VALID_STELLAR_ADDRESS,
    to: VALID_STELLAR_ADDRESS,
    functionName: 'transfer',
    args: [],
    nonce: 0,
    callerType: 'owner' as const,
  };

  it('accepts a well-formed owner-path request', () => {
    const result = validateRequest(relayExecuteRequestSchema, valid);
    expect(result.callerType).toBe('owner');
    expect(result.nonce).toBe(0);
  });

  it('accepts a well-formed session-key-path request', () => {
    const data = {
      ...valid,
      callerType: 'session_key' as const,
      sessionPublicKey: VALID_SESSION_PK,
      signature: VALID_SIGNATURE,
      signaturePayload: VALID_PAYLOAD,
    };
    const result = validateRequest(relayExecuteRequestSchema, data);
    expect(result.callerType).toBe('session_key');
    expect(result.sessionPublicKey).toBe(VALID_SESSION_PK);
  });

  it('defaults args to [] when omitted', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { args: _args, ...noArgs } = valid;
    const result = validateRequest(relayExecuteRequestSchema, noArgs);
    expect(result.args).toEqual([]);
  });

  it('rejects missing accountAddress', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accountAddress: _a, ...bad } = valid;
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('rejects invalid Stellar address format', () => {
    const bad = { ...valid, accountAddress: 'NOTASTELLARADDRESS' };
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('rejects negative nonce', () => {
    const bad = { ...valid, nonce: -1 };
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('rejects empty functionName', () => {
    const bad = { ...valid, functionName: '' };
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('rejects functionName longer than 32 chars', () => {
    const bad = { ...valid, functionName: 'x'.repeat(33) };
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('rejects invalid callerType', () => {
    const bad = { ...valid, callerType: 'admin' };
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('rejects session_pk shorter than 64 chars', () => {
    const bad = {
      ...valid,
      callerType: 'session_key' as const,
      sessionPublicKey: 'abc',
    };
    expect(() => validateRequest(relayExecuteRequestSchema, bad)).toThrow();
  });

  it('validation error includes field path', () => {
    const bad = { ...valid, accountAddress: 'bad' };
    let capturedError: ValidationErrorResponse | undefined;
    try {
      validateRequest(relayExecuteRequestSchema, bad);
    } catch (err) {
      capturedError = err as ValidationErrorResponse;
    }

    expect(capturedError).toBeDefined();
    expect(capturedError?.error).toBe('VALIDATION_ERROR');
    expect(capturedError?.details.some((d) => d.field === 'accountAddress')).toBe(true);
  });
});

// ─── POST /relay/session-key ──────────────────────────────────────────────────

describe('relayAddSessionKeyRequestSchema', () => {
  const valid = {
    accountAddress: VALID_STELLAR_ADDRESS,
    sessionPublicKey: VALID_SESSION_PK,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    permissions: [1],
    signature: VALID_SIGNATURE,
    signaturePayload: VALID_PAYLOAD,
  };

  it('accepts a well-formed add-session-key request', () => {
    const result = validateRequest(relayAddSessionKeyRequestSchema, valid);
    expect(result.sessionPublicKey).toBe(VALID_SESSION_PK);
  });

  it('defaults permissions to [] when omitted', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { permissions: _p, ...noPerms } = valid;
    const result = validateRequest(relayAddSessionKeyRequestSchema, noPerms);
    expect(result.permissions).toEqual([]);
  });

  it('rejects expiresAt of zero', () => {
    const bad = { ...valid, expiresAt: 0 };
    expect(() => validateRequest(relayAddSessionKeyRequestSchema, bad)).toThrow();
  });

  it('rejects missing signature', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signature: _s, ...bad } = valid;
    expect(() => validateRequest(relayAddSessionKeyRequestSchema, bad)).toThrow();
  });

  it('rejects non-hex signaturePayload', () => {
    const bad = { ...valid, signaturePayload: 'not-hex!!' };
    expect(() => validateRequest(relayAddSessionKeyRequestSchema, bad)).toThrow();
  });
});

// ─── POST /relay/revoke-session-key ──────────────────────────────────────────

describe('relayRevokeSessionKeyRequestSchema', () => {
  const valid = {
    accountAddress: VALID_STELLAR_ADDRESS,
    sessionPublicKey: VALID_SESSION_PK,
    signature: VALID_SIGNATURE,
    signaturePayload: VALID_PAYLOAD,
  };

  it('accepts a well-formed revoke request', () => {
    const result = validateRequest(relayRevokeSessionKeyRequestSchema, valid);
    expect(result.sessionPublicKey).toBe(VALID_SESSION_PK);
  });

  it('rejects missing sessionPublicKey', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sessionPublicKey: _sk, ...bad } = valid;
    expect(() => validateRequest(relayRevokeSessionKeyRequestSchema, bad)).toThrow();
  });

  it('rejects signature shorter than 128 chars', () => {
    const bad = { ...valid, signature: 'a'.repeat(64) };
    expect(() => validateRequest(relayRevokeSessionKeyRequestSchema, bad)).toThrow();
  });
});
