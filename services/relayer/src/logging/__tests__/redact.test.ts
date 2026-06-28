import {
  redactPublicKey,
  redactSignature,
  redactSignedPayload,
  redactSecret,
  redactRelayRequest,
} from '../redact';

// ── Sample values that must never appear raw in logs ──────────────────────────

/** A realistic 64-char hex Ed25519 public key (G... keys are Stellar StrKey; raw hex is used here) */
const SAMPLE_PUBLIC_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

/** A realistic 128-char hex Ed25519 signature */
const SAMPLE_SIGNATURE =
  'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718' +
  '191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738';

/** A signed XDR blob (base64-like opaque string) */
const SAMPLE_XDR = 'AAAAAQAAAAC7JAuE3XvquOnbsgv2SRztjuk4RoBVefQ0rlrFMMQvfAAAAAoAAAAA';

/** A Bearer token */
const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';

// ── redactPublicKey ───────────────────────────────────────────────────────────

describe('redactPublicKey', () => {
  it('keeps the first 8 characters and appends …[REDACTED]', () => {
    const result = redactPublicKey(SAMPLE_PUBLIC_KEY);
    expect(result).toBe('a1b2c3d4…[REDACTED]');
  });

  it('does NOT contain the full key', () => {
    const result = redactPublicKey(SAMPLE_PUBLIC_KEY);
    expect(result).not.toContain(SAMPLE_PUBLIC_KEY);
  });

  it('returns [REDACTED] for empty string', () => {
    expect(redactPublicKey('')).toBe('[REDACTED]');
  });

  it('returns [REDACTED] for non-string input', () => {
    // @ts-expect-error -- testing runtime safety with invalid types
    expect(redactPublicKey(null)).toBe('[REDACTED]');
    // @ts-expect-error -- testing runtime safety with invalid types
    expect(redactPublicKey(undefined)).toBe('[REDACTED]');
  });

  it('works for short keys (shorter than preview length)', () => {
    const result = redactPublicKey('abc');
    expect(result).toBe('abc…[REDACTED]');
    expect(result).not.toContain('abc…[REDACTED]abc'); // no duplication
  });
});

// ── redactSignature ───────────────────────────────────────────────────────────

describe('redactSignature', () => {
  it('keeps the first 8 characters and appends …[REDACTED]', () => {
    const result = redactSignature(SAMPLE_SIGNATURE);
    expect(result).toBe('deadbeef…[REDACTED]');
  });

  it('does NOT contain the full signature', () => {
    const result = redactSignature(SAMPLE_SIGNATURE);
    expect(result).not.toContain(SAMPLE_SIGNATURE);
  });

  it('returns [REDACTED] for empty string', () => {
    expect(redactSignature('')).toBe('[REDACTED]');
  });
});

// ── redactSignedPayload ───────────────────────────────────────────────────────

describe('redactSignedPayload', () => {
  it('replaces the entire payload with [REDACTED]', () => {
    expect(redactSignedPayload(SAMPLE_XDR)).toBe('[REDACTED]');
  });

  it('does NOT leak any part of the payload', () => {
    const result = redactSignedPayload(SAMPLE_XDR);
    expect(result).not.toContain('AAAAA');
  });
});

// ── redactSecret ─────────────────────────────────────────────────────────────

describe('redactSecret', () => {
  it('replaces the entire secret with [REDACTED]', () => {
    expect(redactSecret(SAMPLE_TOKEN)).toBe('[REDACTED]');
  });

  it('does NOT leak any part of the token', () => {
    const result = redactSecret(SAMPLE_TOKEN);
    expect(result).not.toContain('eyJ');
  });
});

// ── redactRelayRequest ────────────────────────────────────────────────────────

describe('redactRelayRequest', () => {
  const fullRequest = {
    sessionKey: SAMPLE_PUBLIC_KEY,
    signature: SAMPLE_SIGNATURE,
    operation: 'relay_execute' as const,
    nonce: 42,
    parameters: {
      signedTransactionXdr: SAMPLE_XDR,
      someOtherParam: 'safe-value',
    },
  };

  it('redacts sessionKey', () => {
    const result = redactRelayRequest(fullRequest);
    expect(result.sessionKey).toBe('a1b2c3d4…[REDACTED]');
    expect(result.sessionKey).not.toContain(SAMPLE_PUBLIC_KEY);
  });

  it('redacts signature', () => {
    const result = redactRelayRequest(fullRequest);
    expect(result.signature).toBe('deadbeef…[REDACTED]');
    expect(result.signature).not.toContain(SAMPLE_SIGNATURE);
  });

  it('passes through operation and nonce unchanged', () => {
    const result = redactRelayRequest(fullRequest);
    expect(result.operation).toBe('relay_execute');
    expect(result.nonce).toBe(42);
  });

  it('redacts signedTransactionXdr inside parameters', () => {
    const result = redactRelayRequest(fullRequest);
    const params = result.parameters as Record<string, unknown>;
    expect(params['signedTransactionXdr']).toBe('[REDACTED]');
    expect(params['signedTransactionXdr']).not.toContain('AAAAA');
  });

  it('passes through non-sensitive parameters', () => {
    const result = redactRelayRequest(fullRequest);
    const params = result.parameters as Record<string, unknown>;
    expect(params['someOtherParam']).toBe('safe-value');
  });

  it('handles missing optional fields gracefully', () => {
    const result = redactRelayRequest({});
    expect(result.sessionKey).toBeUndefined();
    expect(result.signature).toBeUndefined();
    expect(result.parameters).toBeUndefined();
  });

  // ── Forbidden pattern: no raw G... / full hex keys in output ─────────────

  it('SECURITY: output does not contain the raw public key', () => {
    const result = JSON.stringify(redactRelayRequest(fullRequest));
    expect(result).not.toContain(SAMPLE_PUBLIC_KEY);
  });

  it('SECURITY: output does not contain the raw signature', () => {
    const result = JSON.stringify(redactRelayRequest(fullRequest));
    expect(result).not.toContain(SAMPLE_SIGNATURE);
  });

  it('SECURITY: output does not contain the raw XDR payload', () => {
    const result = JSON.stringify(redactRelayRequest(fullRequest));
    expect(result).not.toContain(SAMPLE_XDR);
  });
});
