/**
 * Tests for encryption primitives
 */

import { deriveKey, encrypt, decrypt, type EncryptedPayload } from '../encryption-primitives';

describe('encryption-primitives', () => {
  describe('deriveKey', () => {
    it('should derive a key from password and salt', async () => {
      const password = 'test-password';
      const salt = new Uint8Array(16);

      const key = await deriveKey(password, salt);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toEqual(expect.objectContaining({ name: 'AES-GCM' }));
    });

    it('should throw if iterations is too low', async () => {
      const password = 'test-password';
      const salt = new Uint8Array(16);

      await expect(deriveKey(password, salt, 1000)).rejects.toThrow(
        'Iterations must be at least 100000'
      );
    });

    it('should throw if WebCrypto is not available', async () => {
      const originalCrypto = globalThis.crypto;
      // @ts-ignore
      globalThis.crypto = undefined;

      try {
        const password = 'test-password';
        const salt = new Uint8Array(16);
        await expect(deriveKey(password, salt)).rejects.toThrow('WebCrypto API is not available');
      } finally {
        globalThis.crypto = originalCrypto;
      }
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt plaintext correctly', async () => {
      const plaintext = 'Hello, World!';
      const password = 'my-secure-password';

      const encrypted = await encrypt(plaintext, password);

      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('ciphertext');

      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON data', async () => {
      const data = { userId: '123', email: 'user@example.com', tokens: ['token1', 'token2'] };
      const plaintext = JSON.stringify(data);
      const password = 'secure-password';

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password);
      const restored = JSON.parse(decrypted);

      expect(restored).toEqual(data);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', async () => {
      const plaintext = 'Same plaintext';
      const password = 'same-password';

      const encrypted1 = await encrypt(plaintext, password);
      const encrypted2 = await encrypt(plaintext, password);

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // Ciphertexts should be different
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe('');
    });

    it('should handle large payloads', async () => {
      const plaintext = 'x'.repeat(100000);
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decrypt with wrong password', () => {
    it('should fail with wrong password', async () => {
      const plaintext = 'Secret data';
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';

      const encrypted = await encrypt(plaintext, password);

      await expect(decrypt(encrypted, wrongPassword)).rejects.toThrow(
        'Invalid password or corrupted encrypted payload'
      );
    });

    it('should fail with corrupted ciphertext', async () => {
      const plaintext = 'Secret data';
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);

      // Corrupt the ciphertext
      const corrupted: EncryptedPayload = {
        ...encrypted,
        ciphertext: 'aW52YWxpZA==', // Invalid base64 or corrupted data
      };

      await expect(decrypt(corrupted, password)).rejects.toThrow(
        'Invalid password or corrupted encrypted payload'
      );
    });

    it('should fail with corrupted salt', async () => {
      const plaintext = 'Secret data';
      const password = 'password';

      const encrypted = await encrypt(plaintext, password);

      // Corrupt the salt
      const corrupted: EncryptedPayload = {
        ...encrypted,
        salt: 'aW52YWxpZA==',
      };

      await expect(decrypt(corrupted, password)).rejects.toThrow(
        'Invalid password or corrupted encrypted payload'
      );
    });
  });

  describe('encrypt validation', () => {
    it('should throw if plaintext is not a string', async () => {
      const password = 'password';

      // @ts-ignore
      await expect(encrypt(123, password)).rejects.toThrow('Plaintext must be a string');
    });

    it('should throw if password is empty', async () => {
      const plaintext = 'data';

      await expect(encrypt(plaintext, '')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw if password is not a string', async () => {
      const plaintext = 'data';

      // @ts-ignore
      await expect(encrypt(plaintext, 123)).rejects.toThrow('Password must be a non-empty string');
    });
  });

  describe('decrypt validation', () => {
    it('should throw if password is empty', async () => {
      const payload: EncryptedPayload = {
        salt: 'c2FsdA==',
        iv: 'aXY=',
        ciphertext: 'Y2lwaGVydGV4dA==',
      };

      await expect(decrypt(payload, '')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw if password is not a string', async () => {
      const payload: EncryptedPayload = {
        salt: 'c2FsdA==',
        iv: 'aXY=',
        ciphertext: 'Y2lwaGVydGV4dA==',
      };

      // @ts-ignore
      await expect(decrypt(payload, 123)).rejects.toThrow('Password must be a non-empty string');
    });
  });
});
