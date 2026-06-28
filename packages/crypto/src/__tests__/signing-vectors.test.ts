import { describe, expect, it } from '@jest/globals';
import { Keypair } from '@stellar/stellar-sdk';

import { signPayload, verifySignature } from '../signing';
import vectors from './vectors/stellar-ed25519-signing.json';

type SigningVector = {
  name: string;
  curve: string;
  encoding: string;
  payload: string;
  secret: string;
  publicKey: string;
  signature: string;
};

const signingVectors = vectors as SigningVector[];

describe('Stellar SDK aligned Ed25519 signing vectors', () => {
  it('keeps a broad vector set including edge payload lengths', () => {
    expect(signingVectors).toHaveLength(8);
    expect(signingVectors.map((vector) => Buffer.byteLength(vector.payload, 'utf8'))).toEqual([
      0, 1, 24, 29, 31, 32, 64, 257,
    ]);
  });

  it.each(signingVectors)(
    '$name signs payloads exactly like @stellar/stellar-sdk',
    async (vector) => {
      expect(vector.curve).toBe('ed25519');
      expect(vector.encoding).toBe('utf8');
      expect(vector.signature).toMatch(/^[0-9a-f]{128}$/);

      const signature = await signPayload(vector.payload, vector.secret);
      expect(Buffer.from(signature).toString('hex')).toBe(vector.signature);

      const stellarSignature = Keypair.fromSecret(vector.secret).sign(
        Buffer.from(vector.payload, 'utf8')
      );
      expect(stellarSignature.toString('hex')).toBe(vector.signature);
      await expect(verifySignature(vector.payload, signature, vector.publicKey)).resolves.toBe(
        true
      );
    }
  );
});
