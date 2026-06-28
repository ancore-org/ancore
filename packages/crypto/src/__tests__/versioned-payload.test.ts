import { describe, expect, it } from '@jest/globals';

import {
  encryptSecretKey,
  decryptSecretKey,
  UnsupportedVersionError,
  InvalidPayloadError,
  EncryptedSecretKeyPayload,
} from '../encryption';

describe('Versioned Payload Tests', () => {
  const secretKey = 'TEST_SECRET_KEY_VERSION_001';
  const password = 'Test-Password-Version-123!';

  describe('Version Header Validation', () => {
    it('includes correct version header in encrypted payload', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);

      expect(encrypted.version).toBe(1);
      expect(typeof encrypted.version).toBe('number');
    });

    it('accepts valid version 1 payload during decryption', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const decrypted = await decryptSecretKey(encrypted, password);

      expect(decrypted).toBe(secretKey);
    });

    it('rejects unsupported version with UnsupportedVersionError', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const futureVersionPayload = {
        ...encrypted,
        version: 2,
      } as EncryptedSecretKeyPayload;

      await expect(decryptSecretKey(futureVersionPayload, password)).rejects.toThrow(
        UnsupportedVersionError
      );
    });

    it('provides detailed error information for unsupported version', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const futureVersionPayload = {
        ...encrypted,
        version: 5,
      } as EncryptedSecretKeyPayload;

      const error = (await decryptSecretKey(futureVersionPayload, password).catch(
        (err) => err
      )) as UnsupportedVersionError;

      expect(error).toBeInstanceOf(UnsupportedVersionError);
      expect(error.name).toBe('UnsupportedVersionError');
      expect(error.detectedVersion).toBe(5);
      expect(error.supportedVersions).toEqual([1]);
      expect(error.message).toContain('Unsupported encryption payload version: 5');
      expect(error.message).toContain('Supported versions: [1]');
    });

    it('rejects negative version numbers', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const negativeVersionPayload = {
        ...encrypted,
        version: -1,
      } as EncryptedSecretKeyPayload;

      await expect(decryptSecretKey(negativeVersionPayload, password)).rejects.toThrow(
        UnsupportedVersionError
      );
    });

    it('rejects zero version', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const zeroVersionPayload = {
        ...encrypted,
        version: 0,
      } as EncryptedSecretKeyPayload;

      await expect(decryptSecretKey(zeroVersionPayload, password)).rejects.toThrow(
        UnsupportedVersionError
      );
    });

    it('rejects very large version numbers', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const largeVersionPayload = {
        ...encrypted,
        version: 999999,
      } as EncryptedSecretKeyPayload;

      await expect(decryptSecretKey(largeVersionPayload, password)).rejects.toThrow(
        UnsupportedVersionError
      );
    });
  });

  describe('Parser Validation', () => {
    it('rejects payload with missing version field', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const { version: _version, ...payloadWithoutVersion } = encrypted;

      await expect(decryptSecretKey(payloadWithoutVersion as any, password)).rejects.toThrow(
        InvalidPayloadError
      );
    });

    it('rejects payload with non-integer version', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const floatVersionPayload = {
        ...encrypted,
        version: 1.5,
      } as any;

      await expect(decryptSecretKey(floatVersionPayload, password)).rejects.toThrow(
        InvalidPayloadError
      );
    });

    it('rejects payload with string version', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const stringVersionPayload = {
        ...encrypted,
        version: '1' as any,
      };

      await expect(decryptSecretKey(stringVersionPayload, password)).rejects.toThrow(
        InvalidPayloadError
      );
    });

    it('rejects null payload', async () => {
      await expect(decryptSecretKey(null as any, password)).rejects.toThrow(InvalidPayloadError);
    });

    it('rejects undefined payload', async () => {
      await expect(decryptSecretKey(undefined as any, password)).rejects.toThrow(
        InvalidPayloadError
      );
    });

    it('rejects non-object payload', async () => {
      await expect(decryptSecretKey('not-an-object' as any, password)).rejects.toThrow(
        InvalidPayloadError
      );
    });

    it('provides specific error for missing salt', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const { salt: _salt, ...payloadWithoutSalt } = encrypted;

      const error = (await decryptSecretKey(payloadWithoutSalt as any, password).catch(
        (err) => err
      )) as InvalidPayloadError;

      expect(error).toBeInstanceOf(InvalidPayloadError);
      expect(error.message).toBe('Payload salt must be a non-empty string');
    });

    it('provides specific error for empty salt', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const emptySaltPayload = {
        ...encrypted,
        salt: '',
      };

      const error = (await decryptSecretKey(emptySaltPayload, password).catch(
        (err) => err
      )) as InvalidPayloadError;

      expect(error).toBeInstanceOf(InvalidPayloadError);
      expect(error.message).toBe('Payload salt must be a non-empty string');
    });

    it('provides specific error for missing iv', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const { iv: _iv, ...payloadWithoutIv } = encrypted;

      const error = (await decryptSecretKey(payloadWithoutIv as any, password).catch(
        (err) => err
      )) as InvalidPayloadError;

      expect(error).toBeInstanceOf(InvalidPayloadError);
      expect(error.message).toBe('Payload iv must be a non-empty string');
    });

    it('provides specific error for missing ciphertext', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const { ciphertext: _ciphertext, ...payloadWithoutCiphertext } = encrypted;

      const error = (await decryptSecretKey(payloadWithoutCiphertext as any, password).catch(
        (err) => err
      )) as InvalidPayloadError;

      expect(error).toBeInstanceOf(InvalidPayloadError);
      expect(error.message).toBe('Payload ciphertext must be a non-empty string');
    });

    it('provides specific error for invalid iterations range', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const invalidIterationsPayload = {
        ...encrypted,
        iterations: 50000, // Below minimum
      };

      const error = (await decryptSecretKey(invalidIterationsPayload, password).catch(
        (err) => err
      )) as InvalidPayloadError;

      expect(error).toBeInstanceOf(InvalidPayloadError);
      expect(error.message).toContain(
        'Payload iterations must be a safe integer between 100000 and 600000'
      );
    });

    it('provides specific error for non-integer iterations', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const floatIterationsPayload = {
        ...encrypted,
        iterations: 150000.5,
      } as any;

      const error = (await decryptSecretKey(floatIterationsPayload, password).catch(
        (err) => err
      )) as InvalidPayloadError;

      expect(error).toBeInstanceOf(InvalidPayloadError);
      expect(error.message).toContain(
        'Payload iterations must be a safe integer between 100000 and 600000'
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains compatibility with existing valid payloads', async () => {
      // Create a payload that matches the old format
      const encrypted = await encryptSecretKey(secretKey, password);

      // Ensure it can still be decrypted
      const decrypted = await decryptSecretKey(encrypted, password);
      expect(decrypted).toBe(secretKey);
    });

    it('preserves all existing payload fields', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);

      expect(encrypted).toHaveProperty('version');
      expect(encrypted).toHaveProperty('iterations');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('ciphertext');

      expect(typeof encrypted.version).toBe('number');
      expect(typeof encrypted.iterations).toBe('number');
      expect(typeof encrypted.salt).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.ciphertext).toBe('string');
    });
  });

  describe('Error Type Differentiation', () => {
    it('distinguishes between version errors and other payload errors', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);

      // Test unsupported version error
      const versionError = await decryptSecretKey(
        { ...encrypted, version: 2 } as EncryptedSecretKeyPayload,
        password
      ).catch((err) => err);

      expect(versionError).toBeInstanceOf(UnsupportedVersionError);
      expect(versionError).not.toBeInstanceOf(InvalidPayloadError);

      // Test invalid payload error
      const payloadError = await decryptSecretKey({ ...encrypted, salt: '' }, password).catch(
        (err) => err
      );

      expect(payloadError).toBeInstanceOf(InvalidPayloadError);
      expect(payloadError).not.toBeInstanceOf(UnsupportedVersionError);
    });

    it('wraps crypto errors as InvalidPayloadError', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);

      // Use wrong password to trigger crypto decryption failure
      const cryptoError = await decryptSecretKey(encrypted, 'wrong-password').catch((err) => err);

      expect(cryptoError).toBeInstanceOf(InvalidPayloadError);
      expect(cryptoError.message).toBe('Invalid password or corrupted encrypted payload.');
    });
  });

  describe('Future Migration Support', () => {
    it('can easily extend supported versions', async () => {
      // This test demonstrates how version support can be extended
      // In a real migration, you would update SUPPORTED_VERSIONS constant

      const currentSupportedVersions = [1]; // Current implementation
      expect(currentSupportedVersions).toContain(1);

      // Future versions would be added here
      // const futureSupportedVersions = [1, 2];
      // expect(futureSupportedVersions).toContain(2);
    });

    it('provides clear migration path information', async () => {
      const encrypted = await encryptSecretKey(secretKey, password);
      const futureVersionPayload = {
        ...encrypted,
        version: 2,
      } as EncryptedSecretKeyPayload;

      const error = (await decryptSecretKey(futureVersionPayload, password).catch(
        (err) => err
      )) as UnsupportedVersionError;

      // Error message provides clear information about supported versions
      expect(error.message).toMatch(/Unsupported encryption payload version: 2/);
      expect(error.message).toMatch(/Supported versions: \[1\]/);

      // Error object contains programmatic access to version info
      expect(error.detectedVersion).toBe(2);
      expect(error.supportedVersions).toEqual([1]);
    });
  });
});
