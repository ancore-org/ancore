/**
 * PasskeyModule: WebAuthn P-256 session key registration and signing for Ancore account abstraction.
 *
 * Wraps navigator.credentials to register P-256 public keys as session keys on the smart
 * account contract and sign relay payloads using the platform authenticator.
 */

import { addSessionKey } from '../add-session-key';
import type { InvocationArgs } from '../account-contract';
import { PERMISSION_EXECUTE } from '../permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extracted P-256 public key coordinates. */
export interface P256PublicKey {
  /** 32-byte x-coordinate (used as the on-chain BytesN<32> session key). */
  x: Uint8Array;
  /** 32-byte y-coordinate (retained for off-chain verification). */
  y: Uint8Array;
}

/** Result returned after a successful WebAuthn passkey registration. */
export interface PasskeyRegistrationResult {
  /** Base64url-encoded credential ID assigned by the authenticator. */
  credentialId: string;
  /** P-256 public key coordinates extracted from the attestation response. */
  publicKey: P256PublicKey;
  /** Session expiry timestamp in milliseconds since epoch. */
  expiresAt: number;
}

/** Result returned after signing a relay payload with a passkey. */
export interface PasskeySignatureResult {
  /** Compact r‖s ECDSA signature encoded as a 128-character lowercase hex string (64 bytes). */
  signature: string;
  /** Raw authenticatorData bytes — required by the relay server for signature verification. */
  authenticatorData: Uint8Array;
  /** Raw clientDataJSON bytes — required by the relay server for signature verification. */
  clientDataJSON: Uint8Array;
}

/** Options for {@link registerPasskey}. */
export interface RegisterPasskeyOptions {
  /** Session expiry in ms since epoch. Default: now + 24 hours. */
  expiresAt?: number;
  /** WebAuthn relying party ID. Default: window.location.hostname. */
  rpId?: string;
  /** Relying party display name. Default: 'Ancore'. */
  rpName?: string;
  /** User display name passed to the authenticator. Default: accountAddress. */
  userName?: string;
  /** Authenticator timeout in milliseconds. Default: 60 000. */
  timeout?: number;
}

/** Options for {@link signRelayPayload}. */
export interface SignRelayPayloadOptions {
  /** Allowed authenticator transports for the allow-credentials list. */
  transports?: AuthenticatorTransport[];
  /** Authenticator timeout in milliseconds. Default: 60 000. */
  timeout?: number;
  /** WebAuthn relying party ID. Default: window.location.hostname. */
  rpId?: string;
}

/**
 * Relay payload fields required to compute the signing challenge.
 * Mirrors relayPayloadSchema fields, excluding the `signature` output field.
 */
export interface UnsignedRelayPayload {
  sessionKey: string;
  operation: string;
  parameters: Record<string, unknown>;
  nonce: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PasskeyError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PasskeyError';
    this.code = code;
    Object.setPrototypeOf(this, PasskeyError.prototype);
  }
}

export class PasskeyNotSupportedError extends PasskeyError {
  constructor() {
    super('WebAuthn is not supported in this environment', 'PASSKEY_NOT_SUPPORTED');
    this.name = 'PasskeyNotSupportedError';
    Object.setPrototypeOf(this, PasskeyNotSupportedError.prototype);
  }
}

export class PasskeyRegistrationError extends PasskeyError {
  constructor(message: string) {
    super(message, 'PASSKEY_REGISTRATION_ERROR');
    this.name = 'PasskeyRegistrationError';
    Object.setPrototypeOf(this, PasskeyRegistrationError.prototype);
  }
}

export class PasskeySigningError extends PasskeyError {
  constructor(message: string) {
    super(message, 'PASSKEY_SIGNING_ERROR');
    this.name = 'PasskeySigningError';
    Object.setPrototypeOf(this, PasskeySigningError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertWebAuthnSupport(): void {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.credentials === 'undefined' ||
    typeof navigator.credentials.create !== 'function'
  ) {
    throw new PasskeyNotSupportedError();
  }
}

/** Encode raw bytes to a base64url string (no padding). */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode a base64url string (with or without padding) to bytes. */
function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Copy into a standalone ArrayBuffer for WebAuthn `BufferSource` params.
 * Avoids TS 5.9+ incompatibility between `Uint8Array<ArrayBufferLike>` and `BufferSource`.
 */
function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Encode bytes to a lowercase hex string. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract P-256 x/y coordinates from a SubjectPublicKeyInfo DER buffer.
 *
 * P-256 SPKI structure (91 bytes):
 *   SEQUENCE { AlgorithmIdentifier { OID ecPublicKey, OID P-256 }, BIT STRING { 04 x[32] y[32] } }
 *
 * We locate the uncompressed point prefix (0x04) after the algorithm identifier and read the
 * following 64 bytes as the x and y coordinates.
 */
function parseSpkiP256(spki: ArrayBuffer): P256PublicKey {
  const bytes = new Uint8Array(spki);
  // The algorithm identifier occupies the first ~25 bytes; search for 0x04 from offset 23.
  for (let i = 23; i < bytes.length - 64; i++) {
    if (bytes[i] === 0x04) {
      return {
        x: bytes.slice(i + 1, i + 33),
        y: bytes.slice(i + 33, i + 65),
      };
    }
  }
  throw new PasskeyRegistrationError('Could not locate P-256 uncompressed point in SPKI');
}

/**
 * Parse a DER-encoded ECDSA P-256 signature to compact r‖s form.
 *
 * DER format: SEQUENCE { INTEGER r, INTEGER s }
 * Each integer may carry a leading 0x00 byte when the MSB is set; that byte is stripped.
 * Both r and s are right-aligned in 32-byte arrays.
 */
function parseDerSignature(derSig: ArrayBuffer): { r: Uint8Array; s: Uint8Array } {
  const b = new Uint8Array(derSig);
  let offset = 0;

  if (b[offset++] !== 0x30) {
    throw new PasskeySigningError('DER signature: expected SEQUENCE (0x30)');
  }

  // Skip sequence length (short or long form).
  if (b[offset] & 0x80) {
    offset += (b[offset] & 0x7f) + 1;
  } else {
    offset++;
  }

  if (b[offset++] !== 0x02) {
    throw new PasskeySigningError('DER signature: expected INTEGER for r');
  }
  const rLen = b[offset++];
  let r = b.slice(offset, offset + rLen);
  offset += rLen;

  if (b[offset++] !== 0x02) {
    throw new PasskeySigningError('DER signature: expected INTEGER for s');
  }
  const sLen = b[offset++];
  let s = b.slice(offset, offset + sLen);

  // Strip DER sign-padding zero.
  if (r.length === 33 && r[0] === 0x00) r = r.slice(1);
  if (s.length === 33 && s[0] === 0x00) s = s.slice(1);

  const rFixed = new Uint8Array(32);
  const sFixed = new Uint8Array(32);
  rFixed.set(r, 32 - r.length);
  sFixed.set(s, 32 - s.length);

  return { r: rFixed, s: sFixed };
}

/**
 * Compute a 32-byte SHA-256 challenge from an unsigned relay payload.
 *
 * The challenge is the SHA-256 digest of the canonical JSON of the four
 * non-signature fields, serialised in key-sorted order. Using the payload
 * hash as the WebAuthn challenge binds the authenticator's ECDSA signature
 * to the specific relay operation being authorised.
 */
async function computePayloadChallenge(payload: UnsignedRelayPayload): Promise<Uint8Array> {
  const canonical = JSON.stringify({
    nonce: payload.nonce,
    operation: payload.operation,
    parameters: payload.parameters,
    sessionKey: payload.sessionKey,
  });
  const encoded = new TextEncoder().encode(canonical);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(digest);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a WebAuthn passkey for an Ancore smart account.
 *
 * Calls `navigator.credentials.create()` with an ES256 (P-256) credential,
 * then extracts the public key x/y coordinates from the attestation response.
 * The returned `credentialId` and `publicKey` should be persisted by the caller
 * for later use with {@link buildAddSessionKeyInvocation} and {@link signRelayPayload}.
 *
 * @param accountAddress - Stellar contract or account address that owns this session key.
 * @param options - Optional overrides for expiry, RP identity, and timeout.
 */
export async function registerPasskey(
  accountAddress: string,
  options: RegisterPasskeyOptions = {}
): Promise<PasskeyRegistrationResult> {
  assertWebAuthnSupport();

  const {
    expiresAt = Date.now() + 24 * 60 * 60 * 1000,
    rpId = typeof window !== 'undefined' ? window.location.hostname : undefined,
    rpName = 'Ancore',
    userName = accountAddress,
    timeout = 60_000,
  } = options;

  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(accountAddress);

  const creationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge: toBufferSource(challenge),
      rp: { name: rpName, ...(rpId !== undefined && { id: rpId }) },
      user: {
        id: toBufferSource(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // -7 = ES256 (P-256)
      timeout,
      attestation: 'none',
    },
  };

  const credential = await navigator.credentials.create(creationOptions);

  if (!credential || credential.type !== 'public-key') {
    throw new PasskeyRegistrationError('Passkey creation was cancelled or failed');
  }

  const pk = credential as PublicKeyCredential;
  const response = pk.response as AuthenticatorAttestationResponse;
  const spki = response.getPublicKey();
  if (!spki) {
    throw new PasskeyRegistrationError('Authenticator did not return a public key');
  }

  const publicKey = parseSpkiP256(spki);
  const credentialId = toBase64Url(new Uint8Array(pk.rawId));

  return { credentialId, publicKey, expiresAt };
}

/**
 * Build an `add_session_key` invocation for a registered passkey.
 *
 * Uses the P-256 public key's x-coordinate (32 bytes) as the on-chain `BytesN<32>` key
 * and grants `PERMISSION_EXECUTE` so the session key can call `execute()` on the account.
 *
 * @param contractId - Stellar contract ID of the smart account.
 * @param registration - Result from {@link registerPasskey}.
 * @returns Invocation args ready to be included in a Soroban transaction.
 */
export function buildAddSessionKeyInvocation(
  contractId: string,
  registration: PasskeyRegistrationResult
): InvocationArgs {
  return addSessionKey(
    contractId,
    registration.publicKey.x,
    [PERMISSION_EXECUTE],
    registration.expiresAt
  );
}

/**
 * Sign a relay payload with a registered WebAuthn passkey.
 *
 * The SHA-256 hash of the canonical payload JSON (all fields except `signature`,
 * keys sorted alphabetically) is used as the WebAuthn challenge. The authenticator's
 * DER-encoded ECDSA P-256 signature is converted to compact r‖s form and returned
 * as a 128-character hex string.
 *
 * The `authenticatorData` and `clientDataJSON` fields are included in the result so
 * the relay server can perform full WebAuthn verification independently.
 *
 * @param payload - Relay payload fields to sign (without the `signature` field).
 * @param credentialId - Base64url credential ID returned by {@link registerPasskey}.
 * @param options - Optional overrides for transports, timeout, and RP ID.
 */
export async function signRelayPayload(
  payload: UnsignedRelayPayload,
  credentialId: string,
  options: SignRelayPayloadOptions = {}
): Promise<PasskeySignatureResult> {
  assertWebAuthnSupport();

  const { timeout = 60_000, rpId, transports } = options;
  const challenge = await computePayloadChallenge(payload);
  const credentialIdBytes = fromBase64Url(credentialId);

  const requestOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: toBufferSource(challenge),
      timeout,
      allowCredentials: [
        {
          type: 'public-key',
          id: toBufferSource(credentialIdBytes),
          ...(transports !== undefined && { transports }),
        },
      ],
      ...(rpId !== undefined && { rpId }),
      userVerification: 'required',
    },
  };

  const assertion = await navigator.credentials.get(requestOptions);

  if (!assertion || assertion.type !== 'public-key') {
    throw new PasskeySigningError('Passkey assertion was cancelled or failed');
  }

  const assertionPk = assertion as PublicKeyCredential;
  const response = assertionPk.response as AuthenticatorAssertionResponse;
  const { r, s } = parseDerSignature(response.signature);

  const compact = new Uint8Array(64);
  compact.set(r, 0);
  compact.set(s, 32);

  return {
    signature: toHex(compact),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
}
