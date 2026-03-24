import { webcrypto } from 'crypto';
import type { EncryptedPayload, StorageAdapter } from '../types';

if (!globalThis.crypto) {
  // @ts-expect-error Node test environment does not expose writable crypto typing.
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

import { SecureStorageManager } from '../secure-storage-manager';
import type { AccountData, SessionKeysData } from '../types';

class MockStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  public inspectStore(): Map<string, unknown> {
    return this.store;
  }
}

describe('SecureStorageManager', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  const password = 'my_super_secret_password_123!';
  const accountData: AccountData = { privateKey: '0x1234567890abcdef' };
  const sessionKeysData: SessionKeysData = { keys: { session1: 'key1' } };

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  it('should store encrypted payloads (no plaintext secrets)', async () => {
    await manager.unlock(password);
    await manager.saveAccount(accountData);

    const storedData = await storage.get<EncryptedPayload>('account');
    expect(storedData).toBeDefined();

    // Ensure it's not plaintext
    const jsonStr = JSON.stringify(storedData);
    expect(jsonStr).not.toContain(accountData.privateKey);

    // Verify EncryptedPayload structure
    expect(storedData).toHaveProperty('iv');
    expect(storedData).toHaveProperty('salt');
    expect(storedData).toHaveProperty('data');
  });

  it('should restore original data after unlock -> save -> lock -> unlock -> get', async () => {
    await manager.unlock(password);
    await manager.saveAccount(accountData);
    await manager.saveSessionKeys(sessionKeysData);

    // Lock and lose in-memory keys
    manager.lock();
    expect(manager.isUnlocked).toBe(false);

    // Create a new instance (reload scenario)
    const newManager = new SecureStorageManager(storage);
    expect(newManager.isUnlocked).toBe(false);

    // Trying to get/save without unlocking should fail
    await expect(newManager.getAccount()).rejects.toThrow('Storage manager is locked');
    await expect(newManager.saveAccount(accountData)).rejects.toThrow('Storage manager is locked');

    // Unlock with correct password
    await newManager.unlock(password);
    expect(newManager.isUnlocked).toBe(true);

    const restoredAccount = await newManager.getAccount();
    const restoredSessionKeys = await newManager.getSessionKeys();

    expect(restoredAccount).toEqual(accountData);
    expect(restoredSessionKeys).toEqual(sessionKeysData);
  });

  it('should fail gracefully with the wrong password', async () => {
    await manager.unlock(password);
    await manager.saveAccount(accountData);

    manager.lock();
    const newManager = new SecureStorageManager(storage);
    await newManager.unlock('wrong_password');

    await expect(newManager.getAccount()).rejects.toThrow('Invalid password or corrupted data');
  });

  it('should return null for non-existent items', async () => {
    await manager.unlock(password);

    const account = await manager.getAccount();
    expect(account).toBeNull();

    const sessionKeys = await manager.getSessionKeys();
    expect(sessionKeys).toBeNull();
  });

  it('should not throw on unlock if already unlocked', async () => {
    await manager.unlock(password);
    await manager.unlock(password); // Should return early
    expect(manager.isUnlocked).toBe(true);
  });
});
