import { describe, expect, it } from '@jest/globals';
import {
  Account,
  Asset,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { signTransaction, verifySignature } from '../signing';

describe('signTransaction', () => {
  const networkPassphrase = Networks.TESTNET;

  const mockAccount = (publicKey: string, sequence: string) => new Account(publicKey, sequence);

  it('produces a non-empty signature for a standard transaction', async () => {
    // Dynamically generate a valid test keypair to avoid "fake key" hallucinations
    const kp = Keypair.random();

    const tx = new TransactionBuilder(mockAccount(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '10',
        })
      )
      .setTimeout(0)
      .build();

    const signature = await signTransaction(tx, kp);

    expect(signature).toBeDefined();
    expect(signature.length).toBe(64); // Ed25519 signatures are 64 bytes
    expect(tx.signatures.length).toBe(1);

    // Integrity check: the signature in the transaction should match the returned signature
    expect(Uint8Array.from(tx.signatures[0].signature())).toEqual(signature);
  });

  it('produces a signature that verifies correctly', async () => {
    const kp = Keypair.random();
    const tx = new TransactionBuilder(mockAccount(kp.publicKey(), '100'), {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        Operation.beginSponsoringFutureReserves({ sponsoredId: Keypair.random().publicKey() })
      )
      .addOperation(Operation.endSponsoringFutureReserves())
      .setTimeout(0)
      .build();

    const signature = await signTransaction(tx, kp);
    const txHash = tx.hash();

    const isValid = await verifySignature(txHash, signature, kp.publicKey());
    expect(isValid).toBe(true);
  });

  it('supports signing with a secret key string', async () => {
    const kp = Keypair.random();
    const tx = new TransactionBuilder(mockAccount(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '10',
        })
      )
      .addMemo(Memo.text('test'))
      .setTimeout(0)
      .build();

    const secret = kp.secret();
    const signature = await signTransaction(tx, secret);

    const isValid = await verifySignature(tx.hash(), signature, kp.publicKey());
    expect(isValid).toBe(true);
  });

  it('throws an error for a malformed secret key', async () => {
    const kp = Keypair.random();
    const tx = new TransactionBuilder(mockAccount(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '10',
        })
      )
      .setTimeout(0)
      .build();

    const invalidSecret = 'NOT-A-SECRET';
    await expect(signTransaction(tx, invalidSecret)).rejects.toThrow(
      'Invalid secret key or keypair provided for signing.'
    );
  });

  it('signs a FeeBumpTransaction correctly', async () => {
    const kp = Keypair.random();
    const innerTx = new TransactionBuilder(mockAccount(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
      .setTimeout(0)
      .build();

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      kp.publicKey(),
      '200',
      innerTx,
      networkPassphrase
    );

    const signature = await signTransaction(feeBumpTx, kp);

    const isValid = await verifySignature(feeBumpTx.hash(), signature, kp.publicKey());
    expect(isValid).toBe(true);
    expect(feeBumpTx.signatures.length).toBe(1);
  });
});
