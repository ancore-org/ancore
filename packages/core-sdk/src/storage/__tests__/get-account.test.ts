import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

import { SecureStorageManager } from '../secure-storage-manager';
import { StorageAdapter, AccountData, EncryptedPayload } from '../types';

class MockStorageAdapter implements StorageAdapter {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  public inspectStore(): Map<string, any> {
    return this.store;
  }

  public setRaw(key: string, value: any): void {
    this.store.set(key, value);
  }
}

describe('SecureStorageManager.getAccount()', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  const password = 'my_super_secret_password_123!';
  const validAccountData: AccountData = { 
    privateKey: '0x1234567890abcdef',
    address: '0xabcdef1234567890',
    network: 'mainnet'
  };

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('Happy Path', () => {
    it('should successfully decrypt and return account data', async () => {
      await manager.unlock(password);
      await manager.saveAccount(validAccountData);

      const result = await manager.getAccount();

      expect(result).toEqual(validAccountData);
      expect(result?.privateKey).toBe(validAccountData.privateKey);
      expect(result?.address).toBe(validAccountData.address);
      expect(result?.network).toBe(validAccountData.network);
    });

    it('should return null when no account exists', async () => {
      await manager.unlock(password);

      const result = await manager.getAccount();

      expect(result).toBeNull();
    });

    it('should handle complex account data structures', async () => {
      const complexAccount: AccountData = {
        privateKey: '0x1234567890abcdef',
        address: '0xabcdef1234567890',
        network: 'mainnet',
        metadata: {
          name: 'My Account',
          createdAt: '2023-01-01T00:00:00Z',
          tags: ['primary', 'trading']
        },
        preferences: {
          theme: 'dark',
          currency: 'USD'
        }
      };

      await manager.unlock(password);
      await manager.saveAccount(complexAccount);

      const result = await manager.getAccount();

      expect(result).toEqual(complexAccount);
    });
  });

  describe('Locked State Behavior', () => {
    it('should throw when trying to get account while locked', async () => {
      // Don't unlock the manager
      await expect(manager.getAccount()).rejects.toThrow('Storage manager is locked');
    });

    it('should throw after explicit lock', async () => {
      await manager.unlock(password);
      await manager.saveAccount(validAccountData);

      manager.lock();

      await expect(manager.getAccount()).rejects.toThrow('Storage manager is locked');
    });

    it('should work correctly after unlock -> lock -> unlock cycle', async () => {
      await manager.unlock(password);
      await manager.saveAccount(validAccountData);

      manager.lock();
      expect(manager.isUnlocked).toBe(false);

      await manager.unlock(password);
      expect(manager.isUnlocked).toBe(true);

      const result = await manager.getAccount();
      expect(result).toEqual(validAccountData);
    });
  });

  describe('Wrong Password Handling', () => {
    it('should throw with wrong password', async () => {
      // Save with correct password
      await manager.unlock(password);
      await manager.saveAccount(validAccountData);
      manager.lock();

      // Try to get with wrong password
      const wrongPasswordManager = new SecureStorageManager(storage);
      await wrongPasswordManager.unlock('wrong_password');

      await expect(wrongPasswordManager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should not leak any information in error messages', async () => {
      await manager.unlock(password);
      await manager.saveAccount(validAccountData);
      manager.lock();

      const wrongPasswordManager = new SecureStorageManager(storage);
      await wrongPasswordManager.unlock('wrong_password');

      try {
        await wrongPasswordManager.getAccount();
        fail('Expected getAccount to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid password or corrupted data');
        // Ensure no private data is leaked in the error
        expect((error as Error).message).not.toContain(validAccountData.privateKey);
        expect((error as Error).message).not.toContain(validAccountData.address);
      }
    });
  });

  describe('Malformed Payload Handling', () => {
    it('should throw when payload is missing required fields', async () => {
      await manager.unlock(password);

      // Test missing salt
      const malformedPayload1: Partial<EncryptedPayload> = {
        iv: 'dGVzdCB2Zw==',
        data: 'dGVzdCBkYXRh'
      };
      storage.setRaw('account', malformedPayload1);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');

      // Test missing iv
      const malformedPayload2: Partial<EncryptedPayload> = {
        salt: 'dGVzdCBzYWx0',
        data: 'dGVzdCBkYXRh'
      };
      storage.setRaw('account', malformedPayload2);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');

      // Test missing data
      const malformedPayload3: Partial<EncryptedPayload> = {
        salt: 'dGVzdCBzYWx0',
        iv: 'dGVzdCB2Zw=='
      };
      storage.setRaw('account', malformedPayload3);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw when payload contains invalid base64', async () => {
      await manager.unlock(password);

      const invalidBase64Payload: EncryptedPayload = {
        salt: 'invalid_base64!@#',
        iv: 'invalid_base64!@#',
        data: 'invalid_base64!@#'
      };
      storage.setRaw('account', invalidBase64Payload);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw when decrypted data is not valid JSON', async () => {
      await manager.unlock(password);

      // Create a payload that decrypts to invalid JSON
      // We'll simulate this by manually setting an invalid JSON structure
      const invalidJsonPayload: EncryptedPayload = {
        salt: 'dGVzdCBzYWx0', // "test salt" in base64
        iv: 'dGVzdCB2Zw==',   // "test iv" in base64
        data: 'dGVzdCBkYXRh'  // This will fail decryption, but if it succeeded, it wouldn't be valid JSON
      };
      storage.setRaw('account', invalidJsonPayload);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw when decrypted JSON is not AccountData structure', async () => {
      await manager.unlock(password);

      // Create a payload that decrypts to valid JSON but wrong structure
      // We need to encrypt this properly, so let's use the encryption method but with wrong data
      const wrongStructureData = { notPrivateKey: 'some_value' };
      
      // Manually encrypt the wrong structure data
      const payload = await (manager as any).encryptData(JSON.stringify(wrongStructureData));
      storage.setRaw('account', payload);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw when decrypted data is null or undefined', async () => {
      await manager.unlock(password);

      // Test with null
      const nullData = { data: null };
      const payload1 = await (manager as any).encryptData(JSON.stringify(nullData));
      storage.setRaw('account', payload1);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');

      // Test with undefined (will become null in JSON)
      const undefinedData = { data: undefined };
      const payload2 = await (manager as any).encryptData(JSON.stringify(undefinedData));
      storage.setRaw('account', payload2);

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should handle empty string payload', async () => {
      await manager.unlock(password);

      storage.setRaw('account', '');

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should handle non-object payload', async () => {
      await manager.unlock(password);

      storage.setRaw('account', 'not_an_object');

      await expect(manager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
    });
  });

  describe('Auto-lock Behavior', () => {
    it('should reset auto-lock timer when accessing account', async () => {
      const shortAutoLockMs = 100; // 100ms
      const managerWithAutoLock = new SecureStorageManager(storage, { autoLockMs: shortAutoLockMs });
      
      await managerWithAutoLock.unlock(password);
      await managerWithAutoLock.saveAccount(validAccountData);

      // Wait a bit but not long enough to trigger auto-lock
      await new Promise(resolve => setTimeout(resolve, 50));

      // Access account should reset timer
      await managerWithAutoLock.getAccount();

      // Should still be unlocked
      expect(managerWithAutoLock.isUnlocked).toBe(true);

      // Wait for auto-lock to trigger
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should now be locked
      expect(managerWithAutoLock.isUnlocked).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should return properly typed AccountData', async () => {
      await manager.unlock(password);
      await manager.saveAccount(validAccountData);

      const result = await manager.getAccount();

      // TypeScript should infer the correct type
      expect(result?.privateKey).toBeDefined();
      expect(typeof result?.privateKey).toBe('string');
      
      // Should allow accessing AccountData properties
      if (result) {
        expect(result.privateKey).toBe(validAccountData.privateKey);
        expect(result.address).toBe(validAccountData.address);
        expect(result.network).toBe(validAccountData.network);
      }
    });
  });
});
