import { describe, expect, it } from '@jest/globals';

import { decryptSecretKey, encryptSecretKey } from '../encryption';

describe('encryptSecretKey()/decryptSecretKey() round-trip', () => {
  it('decrypts encrypted payload back to original secret key', async () => {
    const secretKey = 'TEST_SECRET_KEY_FIXTURE_ALPHA_001';
    const password = 'Test-Password-Fixture-Alpha!123';

    const encrypted = await encryptSecretKey(secretKey, password);
    const decrypted = await decryptSecretKey(encrypted, password);

    expect(decrypted).toBe(secretKey);
    expect(encrypted.iterations).toBeGreaterThanOrEqual(100000);
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();
  });

  it('fails gracefully with wrong password', async () => {
    const secretKey = 'TEST_SECRET_KEY_FIXTURE_BETA_002';
    const correctPassword = 'Test-Password-Fixture-Beta!123';
    const wrongPassword = 'Test-Password-Fixture-Wrong!123';

    const encrypted = await encryptSecretKey(secretKey, correctPassword);

    await expect(decryptSecretKey(encrypted, wrongPassword)).rejects.toThrow(
      'Invalid password or corrupted encrypted payload.'
    );
  });

  it('generates unique salt and IV for each encryption call', async () => {
    const secretKey = 'TEST_SECRET_KEY_FIXTURE_GAMMA_003';
    const password = 'Test-Password-Fixture-Gamma!123';

    const first = await encryptSecretKey(secretKey, password);
    const second = await encryptSecretKey(secretKey, password);

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
  });

  it('fails gracefully for unsupported payload version', async () => {
    const encrypted = await encryptSecretKey(
      'TEST_SECRET_KEY_FIXTURE_DELTA_004',
      'Test-Password-Fixture-Delta!123'
    );

    await expect(
      decryptSecretKey(
        {
          ...encrypted,
          version: 2,
        },
        'Test-Password-Fixture-Delta!123'
      )
    ).rejects.toThrow('Invalid password or corrupted encrypted payload.');
  });

  it('fails gracefully for out-of-range PBKDF2 iterations', async () => {
    const encrypted = await encryptSecretKey(
      'TEST_SECRET_KEY_FIXTURE_EPSILON_005',
      'Test-Password-Fixture-Epsilon!123'
    );

    await expect(
      decryptSecretKey(
        {
          ...encrypted,
          iterations: 10_000_000,
        },
        'Test-Password-Fixture-Epsilon!123'
      )
    ).rejects.toThrow('Invalid password or corrupted encrypted payload.');
  });
});
