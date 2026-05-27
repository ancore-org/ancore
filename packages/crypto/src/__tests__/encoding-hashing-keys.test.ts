import { Keypair } from '@stellar/stellar-sdk';

import { toHex, fromHex, toBase64, fromBase64 } from '../encoding';
import { sha256, sha512, hmac } from '../hashing';
import { deriveKeyPair, publicKeyFromSecret } from '../keys';

describe('encoding utilities', () => {
  it('round-trips hex and base64', () => {
    const bytes = Uint8Array.from([1, 2, 3, 254, 255]);
    const hex = toHex(bytes);
    const b64 = toBase64(bytes);

    expect(fromHex(hex)).toEqual(bytes);
    expect(fromBase64(b64)).toEqual(bytes);
  });

  it('rejects invalid hex and invalid base64', () => {
    expect(() => fromHex('abc')).toThrow(TypeError);
    expect(() => fromHex('zz')).toThrow(TypeError);
    expect(() => fromBase64('@@@')).toThrow(TypeError);
  });
});

describe('hashing utilities', () => {
  it('produces deterministic output lengths for strings and bytes', () => {
    expect(sha256('hello')).toHaveLength(32);
    expect(sha512('hello')).toHaveLength(64);
    expect(hmac('key', 'message')).toHaveLength(32);

    const bytes = Uint8Array.from([1, 2, 3]);
    expect(sha256(bytes)).toHaveLength(32);
    expect(sha512(bytes)).toHaveLength(64);
  });
});

describe('key utilities', () => {
  it('derives keypair from 32-byte and 64-byte seeds', () => {
    const seed32 = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const seed64 = Uint8Array.from({ length: 64 }, (_, i) => i + 1);

    const kp32 = deriveKeyPair(seed32);
    const kp64 = deriveKeyPair(seed64);

    expect(kp32.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(kp32.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
    expect(kp64.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(kp64.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
  });

  it('rejects invalid seed size', () => {
    expect(() => deriveKeyPair(new Uint8Array(31))).toThrow('seed must be 32 or 64 bytes');
  });

  it('derives public key from a valid secret and rejects invalid secret', () => {
    const pair = Keypair.random();
    expect(publicKeyFromSecret(pair.secret())).toBe(pair.publicKey());
    expect(() => publicKeyFromSecret('SINVALIDSECRET')).toThrow('invalid secret key');
  });
});
