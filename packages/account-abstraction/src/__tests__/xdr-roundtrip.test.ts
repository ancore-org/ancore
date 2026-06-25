import crypto from 'crypto';
import { publicKeyToBytes32ScVal, bytes32ScValToPublicKey } from '../xdr-utils';
import { StrKey } from '@stellar/stellar-sdk';
import { StrKeyValidationError } from '@ancore/core-sdk';

describe('xdr-utils session key round-trip', () => {
  test('round-trips a G... public key string', () => {
    const raw = crypto.randomBytes(32);
    const pub = StrKey.encodeEd25519PublicKey(raw);

    const sc = publicKeyToBytes32ScVal(pub);
    const round = bytes32ScValToPublicKey(sc);
    expect(round).toBe(pub);
  });

  test('accepts raw 32-byte Uint8Array and returns same encoded public key', () => {
    const raw = crypto.randomBytes(32);
    const sc = publicKeyToBytes32ScVal(new Uint8Array(raw));
    const encoded = bytes32ScValToPublicKey(sc);
    expect(encoded).toBe(StrKey.encodeEd25519PublicKey(raw));
  });

  test('throws StrKeyValidationError for malformed G key', () => {
    expect(() => publicKeyToBytes32ScVal('NOT_A_KEY')).toThrow(StrKeyValidationError);
    try {
      publicKeyToBytes32ScVal('NOT_A_KEY');
    } catch (err: any) {
      expect(err.code).toBe('INVALID_G_KEY');
    }
  });
});
