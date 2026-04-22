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
import type { SessionKeysData, StorageAdapter } from '../types';
import { getSessionKeys } from '../get-session-keys';

class MockStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('SecureStorageManager session key persistence', () => {
  const password = 'super_secret_password_123!';
  const sessionKeys: SessionKeysData = {
    keys: {
      GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF: 'session-key-1',
      GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCD: 'session-key-2',
    },
    metadata: {
      version: 1,
      createdAt: 1_716_000_000,
    },
  };

  it('encrypts and stores session keys at rest', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    await manager.saveSessionKeys(sessionKeys);

    const stored = await storage.get('sessionKeys');
    expect(stored).toBeDefined();

    const raw = JSON.stringify(stored);
    expect(raw).not.toContain('session-key-1');
    expect(raw).not.toContain('session-key-2');

    expect(stored).toHaveProperty('salt');
    expect(stored).toHaveProperty('iv');
    expect(stored).toHaveProperty('data');
  });

  it('preserves data through save -> lock -> unlock -> get round trip', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    await manager.saveSessionKeys(sessionKeys);

    manager.lock();

    const rehydratedManager = new SecureStorageManager(storage);
    await rehydratedManager.unlock(password);

    const restored = await rehydratedManager.getSessionKeys();
    expect(restored).toEqual(sessionKeys);
  });

  it('returns an empty typed object when no persisted session keys exist', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    const result = await manager.getSessionKeys();

    expect(result).toEqual({ keys: {} });
  });

  it('enforces locked state for save and get', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await expect(manager.saveSessionKeys(sessionKeys)).rejects.toThrow('Storage manager is locked');
    await expect(manager.getSessionKeys()).rejects.toThrow('Storage manager is locked');
  });

  it('fails to decrypt with a wrong password', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    await manager.saveSessionKeys(sessionKeys);
    manager.lock();

    const wrongPasswordManager = new SecureStorageManager(storage);
    await wrongPasswordManager.unlock('wrong_password');

    await expect(wrongPasswordManager.getSessionKeys()).rejects.toThrow(
      'Storage manager is locked'
    );
  });

  it('helper returns empty keys when storage has no payload', async () => {
    const storage = new MockStorageAdapter();
    const decryptData = jest.fn();

    await expect(
      getSessionKeys({
        storage,
        decryptData,
        assertUnlocked: () => undefined,
      })
    ).resolves.toEqual({ keys: {} });

    expect(decryptData).not.toHaveBeenCalled();
  });

  it('helper rejects malformed encrypted payloads', async () => {
    const storage = new MockStorageAdapter();
    await storage.set('sessionKeys', 'bad-payload');

    await expect(
      getSessionKeys({
        storage,
        decryptData: jest.fn(),
        assertUnlocked: () => undefined,
      })
    ).rejects.toThrow('Invalid password or corrupted data');
  });

  it('helper rejects decrypted shapes that are not SessionKeysData', async () => {
    const storage = new MockStorageAdapter();
    await storage.set('sessionKeys', { salt: 'x', iv: 'y', data: 'z' });

    await expect(
      getSessionKeys({
        storage,
        decryptData: async () => JSON.stringify({ keys: { a: 42 } }),
        assertUnlocked: () => undefined,
      })
    ).rejects.toThrow('Invalid password or corrupted data');
  });

  it('helper normalizes unexpected parse/decrypt exceptions', async () => {
    const storage = new MockStorageAdapter();
    await storage.set('sessionKeys', { salt: 'x', iv: 'y', data: 'z' });

    await expect(
      getSessionKeys({
        storage,
        decryptData: async () => '{invalid-json',
        assertUnlocked: () => undefined,
      })
    ).rejects.toThrow('Invalid password or corrupted data');
  });
});
