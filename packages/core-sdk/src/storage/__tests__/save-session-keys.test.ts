import { saveSessionKeys, SESSION_KEYS_STORAGE_KEY } from '../save-session-keys';
import type { SessionKeysData, StorageAdapter } from '../types';

class MockStorageAdapter implements StorageAdapter {
  values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe('saveSessionKeys', () => {
  const sessionKeys: SessionKeysData = {
    keys: { GABC: 'session-key-material' },
    metadata: { version: 1, createdAt: 1 },
  };

  it('encrypts and persists session keys when unlocked', async () => {
    const storage = new MockStorageAdapter();
    const encryptData = jest.fn().mockResolvedValue({
      ciphertext: 'cipher',
      iv: 'iv',
      salt: 'salt',
    });
    const touch = jest.fn();

    await saveSessionKeys(sessionKeys, {
      storage,
      encryptData,
      assertUnlocked: () => {},
      touch,
    });

    expect(touch).toHaveBeenCalledTimes(1);
    expect(encryptData).toHaveBeenCalledWith(JSON.stringify(sessionKeys));
    expect(storage.values.get(SESSION_KEYS_STORAGE_KEY)).toEqual({
      ciphertext: 'cipher',
      iv: 'iv',
      salt: 'salt',
    });
  });

  it('throws when assertUnlocked fails', async () => {
    await expect(
      saveSessionKeys(sessionKeys, {
        storage: new MockStorageAdapter(),
        encryptData: jest.fn(),
        assertUnlocked: () => {
          throw new Error('Storage manager is locked');
        },
      })
    ).rejects.toThrow('Storage manager is locked');
  });
});
