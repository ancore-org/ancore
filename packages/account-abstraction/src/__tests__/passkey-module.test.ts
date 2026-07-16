/**
 * Unit tests for PasskeyModule.
 * navigator.credentials is mocked throughout; crypto.subtle is provided by jest.setup via Node webcrypto.
 */

import {
  buildAddSessionKeyInvocation,
  PasskeyNotSupportedError,
  PasskeyRegistrationError,
  PasskeySigningError,
  registerPasskey,
  signRelayPayload,
} from '../passkey/passkeyModule';

// ---------------------------------------------------------------------------
// Helpers to build realistic mock WebAuthn objects
// ---------------------------------------------------------------------------

/**
 * Build a P-256 SubjectPublicKeyInfo DER buffer for a given (x, y) pair.
 *
 * Layout (91 bytes):
 *   30 59  – outer SEQUENCE
 *     30 13 – algorithm SEQUENCE
 *       06 07 2a86 48ce 3d02 01  – OID 1.2.840.10045.2.1 (ecPublicKey)
 *       06 08 2a86 48ce 3d03 0107 – OID 1.2.840.10045.3.1.7 (P-256)
 *     03 42 00  – BIT STRING (0 unused bits)
 *       04        – uncompressed point prefix
 *       x[32]
 *       y[32]
 */
function buildSpki(x: Uint8Array, y: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
  ]);
  const out = new Uint8Array(header.length + 64);
  out.set(header);
  out.set(x, header.length);
  out.set(y, header.length + 32);
  return out.buffer;
}

/**
 * Build a DER-encoded ECDSA signature SEQUENCE { INTEGER r, INTEGER s }.
 * Optionally adds a leading 0x00 padding byte to r and/or s (as DER requires when MSB is set).
 */
function buildDerSig(r: Uint8Array, s: Uint8Array, padR = false, padS = false): ArrayBuffer {
  const rBytes = padR ? new Uint8Array([0x00, ...r]) : r;
  const sBytes = padS ? new Uint8Array([0x00, ...s]) : s;
  const inner = new Uint8Array([0x02, rBytes.length, ...rBytes, 0x02, sBytes.length, ...sBytes]);
  return new Uint8Array([0x30, inner.length, ...inner]).buffer;
}

const ACCOUNT_ADDRESS = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

const mockX = new Uint8Array(32).fill(0xaa);
const mockY = new Uint8Array(32).fill(0xbb);
const mockRawId = new Uint8Array([0x01, 0x02, 0x03]);
const mockR = new Uint8Array(32).fill(0x11);
const mockS = new Uint8Array(32).fill(0x22);
const mockAuthData = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const mockClientDataJSON = new Uint8Array(new TextEncoder().encode('{"type":"webauthn.get"}'));

function makeRegistrationCredential(
  overrides: Partial<{ spki: ArrayBuffer | null; rawId: ArrayBuffer }> = {}
) {
  return {
    type: 'public-key',
    rawId: overrides.rawId ?? mockRawId.buffer,
    response: {
      getPublicKey: () => (overrides.spki !== undefined ? overrides.spki : buildSpki(mockX, mockY)),
    },
  };
}

function makeAssertionCredential(overrides: Partial<{ sig: ArrayBuffer }> = {}) {
  const derSig = overrides.sig ?? buildDerSig(mockR, mockS);
  return {
    type: 'public-key',
    rawId: mockRawId.buffer,
    response: {
      signature: derSig,
      authenticatorData: mockAuthData.buffer,
      clientDataJSON: mockClientDataJSON.buffer,
    },
  };
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let mockCreate: jest.Mock;
let mockGet: jest.Mock;

beforeAll(() => {
  mockCreate = jest.fn();
  mockGet = jest.fn();

  Object.defineProperty(globalThis, 'navigator', {
    value: { credentials: { create: mockCreate, get: mockGet } },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, 'window', {
    value: { location: { hostname: 'ancore.app' } },
    configurable: true,
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// registerPasskey
// ---------------------------------------------------------------------------

describe('registerPasskey', () => {
  it('returns credentialId, publicKey x/y, and expiresAt on success', async () => {
    mockCreate.mockResolvedValue(makeRegistrationCredential());

    const result = await registerPasskey(ACCOUNT_ADDRESS);

    expect(result.credentialId).toBeDefined();
    expect(typeof result.credentialId).toBe('string');
    expect(result.publicKey.x).toEqual(mockX);
    expect(result.publicKey.y).toEqual(mockY);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('uses provided expiresAt instead of the default', async () => {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    mockCreate.mockResolvedValue(makeRegistrationCredential());

    const result = await registerPasskey(ACCOUNT_ADDRESS, { expiresAt });

    expect(result.expiresAt).toBe(expiresAt);
  });

  it('passes rpId and rpName to the authenticator when provided', async () => {
    mockCreate.mockResolvedValue(makeRegistrationCredential());

    await registerPasskey(ACCOUNT_ADDRESS, { rpId: 'example.com', rpName: 'Example' });

    const callArg = mockCreate.mock.calls[0][0] as CredentialCreationOptions;
    expect(callArg.publicKey?.rp.id).toBe('example.com');
    expect(callArg.publicKey?.rp.name).toBe('Example');
  });

  it('uses window.location.hostname as default rpId', async () => {
    mockCreate.mockResolvedValue(makeRegistrationCredential());

    await registerPasskey(ACCOUNT_ADDRESS);

    const callArg = mockCreate.mock.calls[0][0] as CredentialCreationOptions;
    expect(callArg.publicKey?.rp.id).toBe('ancore.app');
  });

  it('requests ES256 (alg -7) credential', async () => {
    mockCreate.mockResolvedValue(makeRegistrationCredential());

    await registerPasskey(ACCOUNT_ADDRESS);

    const callArg = mockCreate.mock.calls[0][0] as CredentialCreationOptions;
    expect(callArg.publicKey?.pubKeyCredParams).toEqual([{ alg: -7, type: 'public-key' }]);
  });

  it('throws PasskeyRegistrationError when create() returns null', async () => {
    mockCreate.mockResolvedValue(null);

    await expect(registerPasskey(ACCOUNT_ADDRESS)).rejects.toThrow(PasskeyRegistrationError);
  });

  it('throws PasskeyRegistrationError when credential type is not public-key', async () => {
    mockCreate.mockResolvedValue({ type: 'identity' });

    await expect(registerPasskey(ACCOUNT_ADDRESS)).rejects.toThrow(PasskeyRegistrationError);
  });

  it('throws PasskeyRegistrationError when getPublicKey() returns null', async () => {
    mockCreate.mockResolvedValue(makeRegistrationCredential({ spki: null }));

    await expect(registerPasskey(ACCOUNT_ADDRESS)).rejects.toThrow(PasskeyRegistrationError);
  });

  it('throws PasskeyRegistrationError when SPKI contains no uncompressed P-256 point', async () => {
    // Buffer too small to contain a 0x04-prefixed 64-byte point after offset 23
    const badSpki = new Uint8Array(30).fill(0xff);
    mockCreate.mockResolvedValue(makeRegistrationCredential({ spki: badSpki.buffer }));

    await expect(registerPasskey(ACCOUNT_ADDRESS)).rejects.toThrow(PasskeyRegistrationError);
  });

  it('throws PasskeyNotSupportedError when navigator.credentials is absent', async () => {
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await expect(registerPasskey(ACCOUNT_ADDRESS)).rejects.toThrow(PasskeyNotSupportedError);

    Object.defineProperty(globalThis, 'navigator', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it('encodes rawId as base64url without padding', async () => {
    // rawId bytes whose base64 would contain + or /
    const rawId = new Uint8Array([0xfb, 0xff, 0xfe]);
    mockCreate.mockResolvedValue(makeRegistrationCredential({ rawId: rawId.buffer }));

    const { credentialId } = await registerPasskey(ACCOUNT_ADDRESS);

    expect(credentialId).not.toContain('+');
    expect(credentialId).not.toContain('/');
    expect(credentialId).not.toContain('=');
  });
});

// ---------------------------------------------------------------------------
// buildAddSessionKeyInvocation
// ---------------------------------------------------------------------------

describe('buildAddSessionKeyInvocation', () => {
  it('returns add_session_key invocation with x-coordinate and PERMISSION_EXECUTE', () => {
    const registration = {
      credentialId: 'AQID',
      publicKey: { x: mockX, y: mockY },
      expiresAt: 9_999_999_999,
    };

    const inv = buildAddSessionKeyInvocation(CONTRACT_ID, registration);

    expect(inv.method).toBe('add_session_key');
    expect(inv.args).toHaveLength(3);
    // First arg encodes the x-coordinate as BytesN<32>
    expect(inv.args[0].switch().name).toBe('scvBytes');
    expect(inv.args[0].bytes()).toEqual(Buffer.from(mockX));
  });
});

// ---------------------------------------------------------------------------
// signRelayPayload
// ---------------------------------------------------------------------------

const unsignedPayload = {
  sessionKey: 'aabbccdd'.repeat(8),
  operation: 'relay_execute' as const,
  parameters: { to: 'GC...', amount: '100', asset: 'XLM' },
  nonce: 7,
};

describe('signRelayPayload', () => {
  it('returns a 128-char hex signature on success', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());

    const result = await signRelayPayload(unsignedPayload, 'AQID');

    expect(result.signature).toHaveLength(128);
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('encodes r and s in the correct order (first 64 hex chars = r, last 64 = s)', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());

    const { signature } = await signRelayPayload(unsignedPayload, 'AQID');

    const rHex = mockR.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
    const sHex = mockS.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
    expect(signature.slice(0, 64)).toBe(rHex);
    expect(signature.slice(64)).toBe(sHex);
  });

  it('strips the leading 0x00 DER padding byte from r and s', async () => {
    const paddedDer = buildDerSig(mockR, mockS, true, true);
    mockGet.mockResolvedValue(makeAssertionCredential({ sig: paddedDer }));

    const { signature } = await signRelayPayload(unsignedPayload, 'AQID');

    expect(signature).toHaveLength(128);
    const rHex = mockR.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
    expect(signature.slice(0, 64)).toBe(rHex);
  });

  it('returns authenticatorData and clientDataJSON as Uint8Arrays', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());

    const { authenticatorData, clientDataJSON } = await signRelayPayload(unsignedPayload, 'AQID');

    expect(authenticatorData).toEqual(mockAuthData);
    expect(clientDataJSON).toEqual(mockClientDataJSON);
  });

  it('passes the SHA-256 payload hash as the WebAuthn challenge', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());

    await signRelayPayload(unsignedPayload, 'AQID');

    const callArg = mockGet.mock.calls[0][0] as CredentialRequestOptions;
    const challenge = callArg.publicKey?.challenge;
    expect(challenge).toBeDefined();
    expect((challenge as Uint8Array).byteLength ?? (challenge as ArrayBuffer).byteLength).toBe(32);
  });

  it('produces the same challenge for identical payloads', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());
    await signRelayPayload(unsignedPayload, 'AQID');
    const first = mockGet.mock.calls[0][0] as CredentialRequestOptions;

    mockGet.mockResolvedValue(makeAssertionCredential());
    await signRelayPayload({ ...unsignedPayload }, 'AQID');
    const second = mockGet.mock.calls[1][0] as CredentialRequestOptions;

    expect(new Uint8Array(first.publicKey!.challenge as ArrayBuffer)).toEqual(
      new Uint8Array(second.publicKey!.challenge as ArrayBuffer)
    );
  });

  it('includes the decoded credentialId in allowCredentials', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());
    const credentialId = 'AQID'; // base64url for [01 02 03]

    await signRelayPayload(unsignedPayload, credentialId);

    const callArg = mockGet.mock.calls[0][0] as CredentialRequestOptions;
    const id = callArg.publicKey?.allowCredentials?.[0].id;
    // id is a Uint8Array (BufferSource); compare via typed array view
    expect(new Uint8Array(id as ArrayBuffer)).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('passes transports and rpId when provided in options', async () => {
    mockGet.mockResolvedValue(makeAssertionCredential());

    await signRelayPayload(unsignedPayload, 'AQID', {
      transports: ['internal'],
      rpId: 'example.com',
    });

    const callArg = mockGet.mock.calls[0][0] as CredentialRequestOptions;
    expect(callArg.publicKey?.allowCredentials?.[0].transports).toEqual(['internal']);
    expect(callArg.publicKey?.rpId).toBe('example.com');
  });

  it('throws PasskeySigningError when get() returns null', async () => {
    mockGet.mockResolvedValue(null);

    await expect(signRelayPayload(unsignedPayload, 'AQID')).rejects.toThrow(PasskeySigningError);
  });

  it('throws PasskeySigningError when credential type is not public-key', async () => {
    mockGet.mockResolvedValue({ type: 'password' });

    await expect(signRelayPayload(unsignedPayload, 'AQID')).rejects.toThrow(PasskeySigningError);
  });

  it('throws PasskeyNotSupportedError when navigator.credentials is absent', async () => {
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await expect(signRelayPayload(unsignedPayload, 'AQID')).rejects.toThrow(
      PasskeyNotSupportedError
    );

    Object.defineProperty(globalThis, 'navigator', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it('throws PasskeySigningError on malformed DER signature', async () => {
    const badSig = new Uint8Array([0xff, 0x00]).buffer;
    mockGet.mockResolvedValue(makeAssertionCredential({ sig: badSig }));

    await expect(signRelayPayload(unsignedPayload, 'AQID')).rejects.toThrow(PasskeySigningError);
  });
});

// ---------------------------------------------------------------------------
// Error class identity
// ---------------------------------------------------------------------------

describe('error classes', () => {
  it('PasskeyNotSupportedError is instanceof PasskeyNotSupportedError', () => {
    expect(new PasskeyNotSupportedError()).toBeInstanceOf(PasskeyNotSupportedError);
  });

  it('PasskeyRegistrationError is instanceof PasskeyRegistrationError', () => {
    expect(new PasskeyRegistrationError('oops')).toBeInstanceOf(PasskeyRegistrationError);
  });

  it('PasskeySigningError is instanceof PasskeySigningError', () => {
    expect(new PasskeySigningError('oops')).toBeInstanceOf(PasskeySigningError);
  });

  it('PasskeyNotSupportedError has correct code', () => {
    expect(new PasskeyNotSupportedError().code).toBe('PASSKEY_NOT_SUPPORTED');
  });
});
