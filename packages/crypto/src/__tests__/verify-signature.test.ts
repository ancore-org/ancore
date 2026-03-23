import { Buffer } from 'node:buffer';
import { TextEncoder } from 'node:util';
import { describe, expect, it } from '@jest/globals';
import { Keypair } from '@stellar/stellar-sdk';

import { verifySignature } from '../signing';

describe('verifySignature', () => {
  it('returns true for a valid signature', async () => {
    const privateKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1));
    const message = new TextEncoder().encode('Authorize session key operation');
    const keypair = Keypair.fromRawEd25519Seed(privateKey);
    const signature = keypair.sign(Buffer.from(message));

    await expect(
      verifySignature(message, Buffer.from(signature).toString('base64'), keypair.publicKey())
    ).resolves.toBe(true);
  });

  it('returns false for an invalid signature', async () => {
    const privateKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1));
    const otherPrivateKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 33));
    const message = 'Authorize contract execution';
    const keypair = Keypair.fromRawEd25519Seed(privateKey);
    const otherKeypair = Keypair.fromRawEd25519Seed(otherPrivateKey);
    const invalidSignature = otherKeypair.sign(Buffer.from(message));

    await expect(
      verifySignature(message, Buffer.from(invalidSignature).toString('hex'), keypair.publicKey())
    ).resolves.toBe(false);
  });
});
