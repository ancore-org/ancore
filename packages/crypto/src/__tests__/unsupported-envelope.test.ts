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

import { signTransaction } from '../signing';

describe('signing with unsupported envelope types', () => {
  const networkPassphrase = Networks.TESTNET;

  const mockAccount = (publicKey: string, sequence: string) => new Account(publicKey, sequence);

  it('signs a standard Transaction successfully', async () => {
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
    expect(signature.length).toBe(64);
    expect(tx.signatures.length).toBe(1);
  });

  it('signs a FeeBumpTransaction successfully', async () => {
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

    expect(signature).toBeDefined();
    expect(signature.length).toBe(64);
    expect(feeBumpTx.signatures.length).toBe(1);
  });

  it('throws error for any other transaction type', async () => {
    const kp = Keypair.random();

    // Create a mock object that has transaction-like properties but is NOT a Transaction
    // or FeeBumpTransaction instance. This simulates an unsupported envelope type.
    const mockUnsupportedEnvelope = {
      signatures: [],
      sign: jest.fn(),
      hash: jest.fn(() => Buffer.from('mock-hash')),
    };

    await expect(
      // @ts-expect-error - intentionally passing unsupported type
      signTransaction(mockUnsupportedEnvelope as any, kp)
    ).rejects.toThrow(
      'Unsupported transaction type. Supported types: Transaction, FeeBumpTransaction. See CRYPTO_ASSUMPTIONS.md'
    );
  });

  it('throws error for plain object masquerading as transaction', async () => {
    const kp = Keypair.random();

    const plainObject = {
      foo: 'bar',
      baz: 123,
    };

    await expect(
      // @ts-expect-error - intentionally passing plain object
      signTransaction(plainObject as any, kp)
    ).rejects.toThrow(
      'Unsupported transaction type. Supported types: Transaction, FeeBumpTransaction. See CRYPTO_ASSUMPTIONS.md'
    );
  });

  it('throws error for null transaction', async () => {
    const kp = Keypair.random();

    await expect(
      // @ts-expect-error - intentionally passing null
      signTransaction(null as any, kp)
    ).rejects.toThrow(
      'Unsupported transaction type. Supported types: Transaction, FeeBumpTransaction. See CRYPTO_ASSUMPTIONS.md'
    );
  });

  it('throws error for undefined transaction', async () => {
    const kp = Keypair.random();

    await expect(
      // @ts-expect-error - intentionally passing undefined
      signTransaction(undefined as any, kp)
    ).rejects.toThrow(
      'Unsupported transaction type. Supported types: Transaction, FeeBumpTransaction. See CRYPTO_ASSUMPTIONS.md'
    );
  });
});
