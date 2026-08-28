/**
 * Error-branch coverage for signing and encryption.
 *
 * These paths are all guards that the happy-path suites never reach, which
 * left signing at 80% and encryption at 88% branch coverage — both under the
 * gate in scripts/coverage-gate.js for security-critical modules.
 */

import { describe, expect, it, jest, afterEach } from '@jest/globals';
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { signPayload, signTransaction } from '../signing';
import { encryptSecretKey, decryptSecretKey } from '../encryption';

const NETWORK = Networks.TESTNET;

function buildTx(kp: Keypair) {
  return new TransactionBuilder(new Account(kp.publicKey(), '1'), {
    fee: '100',
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: '1',
      })
    )
    .setTimeout(30)
    .build();
}

describe('signing guards', () => {
  it('rejects a malformed secret key passed to signPayload', async () => {
    await expect(signPayload(new Uint8Array([1, 2, 3]), 'not-a-secret')).rejects.toThrow(
      /Invalid secret key or keypair/
    );
  });

  it('accepts a valid secret key string and matches the Keypair-object result', async () => {
    const kp = Keypair.random();
    const message = new Uint8Array([1, 2, 3]);

    const fromSecret = await signPayload(message, kp.secret());
    const fromKeypair = await signPayload(message, kp);

    expect(fromSecret).toEqual(fromKeypair);
    expect(fromSecret.length).toBe(64);
  });

  it('rejects a malformed secret key passed to signTransaction', async () => {
    const tx = buildTx(Keypair.random());
    await expect(signTransaction(tx, 'SNOTAREALSECRET')).rejects.toThrow(
      /Invalid secret key or keypair/
    );
  });

  it('throws when the SDK attaches no signature to the envelope', async () => {
    const kp = Keypair.random();
    const tx = buildTx(kp);
    // Simulate an envelope that silently fails to record the signature.
    jest.spyOn(tx, 'sign').mockImplementation(() => undefined);

    await expect(signTransaction(tx, kp)).rejects.toThrow(/Failed to produce a signature/);
  });
});

describe('encryption guards', () => {
  const SECRET = Keypair.random().secret();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects an empty secret key', async () => {
    await expect(encryptSecretKey('', 'correct-horse-battery-staple')).rejects.toThrow(
      /secretKey must be a non-empty string/
    );
  });

  it('rejects a non-string secret key', async () => {
    await expect(
      encryptSecretKey(undefined as unknown as string, 'correct-horse-battery-staple')
    ).rejects.toThrow(/secretKey must be a non-empty string/);
  });

  it('rejects an empty password on encrypt', async () => {
    await expect(encryptSecretKey(SECRET, '')).rejects.toThrow(
      /password must be a non-empty string/
    );
  });

  it('rejects an empty password on decrypt', async () => {
    const payload = await encryptSecretKey(SECRET, 'correct-horse-battery-staple');
    await expect(decryptSecretKey(payload, '')).rejects.toThrow(
      /password must be a non-empty string/
    );
  });

  it('rejects a non-string password on decrypt', async () => {
    const payload = await encryptSecretKey(SECRET, 'correct-horse-battery-staple');
    await expect(decryptSecretKey(payload, null as unknown as string)).rejects.toThrow(
      /password must be a non-empty string/
    );
  });

  it('fails closed when WebCrypto is unavailable', async () => {
    const original = globalThis.crypto;
    // Node always provides WebCrypto, so emulate a host that does not.
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      await expect(encryptSecretKey(SECRET, 'correct-horse-battery-staple')).rejects.toThrow(
        /WebCrypto API is not available/
      );
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
