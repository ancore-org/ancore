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
import type { RecentRecipientsData, StorageAdapter } from '../types';

class MockStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('SecureStorageManager recent recipients persistence', () => {
  const password = 'wallet-password';
  const data: RecentRecipientsData = {
    recipients: [
      { address: 'GABC', timestamp: 100 },
      { address: 'GDEF', timestamp: 200 },
    ],
  };

  it('encrypts and stores recent recipients at rest', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    await manager.saveRecentRecipients(data);

    const stored = await storage.get('recentRecipients');
    expect(stored).toBeDefined();

    const raw = JSON.stringify(stored);
    expect(raw).not.toContain('GABC');
    expect(raw).not.toContain('GDEF');

    expect(stored).toHaveProperty('salt');
    expect(stored).toHaveProperty('iv');
    expect(stored).toHaveProperty('data');
  });

  it('preserves data through save -> lock -> unlock -> get round trip', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    await manager.saveRecentRecipients(data);

    manager.lock();

    const rehydratedManager = new SecureStorageManager(storage);
    await rehydratedManager.unlock(password);

    const restored = await rehydratedManager.getRecentRecipients();
    expect(restored).toEqual(data);
  });

  it('returns empty recipients when none exist', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await manager.unlock(password);
    const result = await manager.getRecentRecipients();

    expect(result).toEqual({ recipients: [] });
  });

  it('enforces locked state', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await expect(manager.saveRecentRecipients(data)).rejects.toThrow('Storage manager is locked');
    await expect(manager.getRecentRecipients()).rejects.toThrow('Storage manager is locked');
  });
});
