import { webcrypto } from 'crypto';
import type { StorageAdapter, EncryptedPayload } from '../types';
import { SecureStorageManager } from '../secure-storage-manager';

// Polyfills for Node.js environment
if (!globalThis.crypto) {
  // @ts-expect-error - Polyfill
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

class MockStorageAdapter implements StorageAdapter {
  public store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('SecureStorageManager Corruption Recovery', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;
  const password = 'test-password';

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('master_salt corruption', () => {
    it('should handle non-string master_salt by falling back to re-initialization', async () => {
      // Simulate corrupted master_salt (wrong type)
      await storage.set('master_salt', 12345);

      // Should not throw; should treat as missing and re-initialize
      // Note: This will lose access to old data, which is the expected "recovery" if the master salt is unreadable.
      const result = await manager.unlock(password);
      expect(result).toBe(true);

      // Verify it was re-initialized with a valid string
      const newSalt = await storage.get('master_salt');
      expect(typeof newSalt).toBe('string');
    });

    it('should handle wrong-length master_salt by falling back to re-initialization', async () => {
      // Simulate corrupted master_salt (wrong length - 16 bytes expected)
      await storage.set('master_salt', btoa('too-short'));

      const result = await manager.unlock(password);
      expect(result).toBe(true);

      const newSalt = await storage.get('master_salt');
      expect(typeof newSalt).toBe('string');
      expect(atob(newSalt as string).length).toBe(16);
    });
  });

  describe('payload corruption', () => {
    beforeEach(async () => {
      await manager.unlock(password);
    });

    it('should return null if account payload is corrupted (invalid Base64)', async () => {
      await storage.set('account', {
        iv: 'invalid-base64-!!!',
        salt: btoa('1234567890123456'),
        data: btoa('some-data'),
      });

      const account = await manager.getAccount();
      expect(account).toBeNull();
    });

    it('should return null if account payload is corrupted (invalid ciphertext)', async () => {
      await storage.set('account', {
        iv: btoa('123456789012'),
        salt: btoa('1234567890123456'),
        data: btoa('not-encrypted-properly'),
      });

      const account = await manager.getAccount();
      expect(account).toBeNull();
    });

    it('should return empty keys if sessionKeys payload is corrupted', async () => {
      await storage.set('sessionKeys', {
        iv: btoa('123456789012'),
        salt: btoa('1234567890123456'),
        data: btoa('corrupted'),
      });

      const sessionKeys = await manager.getSessionKeys();
      expect(sessionKeys).toEqual({ keys: {} });
    });
  });

  describe('verification_payload corruption', () => {
    it('should fail unlock gracefully if verification_payload is missing but master_salt exists', async () => {
      await storage.set('master_salt', btoa('1234567890123456'));
      // verification_payload is missing

      const result = await manager.unlock(password);
      expect(result).toBe(false);
    });

    it('should fail unlock gracefully if verification_payload is corrupted', async () => {
      await storage.set('master_salt', btoa('1234567890123456'));
      await storage.set('verification_payload', {
        iv: btoa('123456789012'),
        salt: btoa('1234567890123456'),
        data: btoa('corrupted-verification'),
      });

      const result = await manager.unlock(password);
      expect(result).toBe(false);
    });
  });
});
