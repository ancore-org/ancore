import { encryptSecretKey, decryptSecretKey } from '../encryption';

describe('Encryption Roundtrip', () => {
  const secretKey = 'SABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const password = 'secure-password-123';

  it('should decrypt back to original secret key with correct password', async () => {
    const encrypted = await encryptSecretKey(secretKey, password);
    const decrypted = await decryptSecretKey(encrypted, password);
    expect(decrypted).toBe(secretKey);
  });

  it('should fail with incorrect password', async () => {
    const encrypted = await encryptSecretKey(secretKey, password);
    await expect(decryptSecretKey(encrypted, 'wrong-password')).rejects.toThrow(
      'Invalid password or corrupted encrypted payload.'
    );
  });

  it('should fail with malformed payload', async () => {
    const encrypted = await encryptSecretKey(secretKey, password);
    const malformed = { ...encrypted, version: 999 };
    // @ts-ignore
    await expect(decryptSecretKey(malformed, password)).rejects.toThrow(
      'Invalid password or corrupted encrypted payload.'
    );
  });

  it('should fail with missing fields in payload', async () => {
    const encrypted = await encryptSecretKey(secretKey, password);
    const { salt, ...incomplete } = encrypted;
    // @ts-ignore
    await expect(decryptSecretKey(incomplete, password)).rejects.toThrow(
      'Invalid password or corrupted encrypted payload.'
    );
  });
});
