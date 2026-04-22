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
import type { AccountData, StorageAdapter } from '../types';

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

describe('SecureStorageManager auto-lock', () => {
  const password = 'my_super_secret_password_123!';
  const accountData: AccountData = { privateKey: '0xabcdef' };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('locks automatically after inactivity', async () => {
    const manager = new SecureStorageManager(new MockStorageAdapter(), {
      autoLockMs: 1_000,
    });

    await manager.unlock(password);
    expect(manager.isUnlocked).toBe(true);

    jest.advanceTimersByTime(1_001);

    expect(manager.isUnlocked).toBe(false);
  });

  it('touch resets the inactivity timer', async () => {
    const manager = new SecureStorageManager(new MockStorageAdapter(), {
      autoLockMs: 1_000,
    });

    await manager.unlock(password);

    jest.advanceTimersByTime(900);
    manager.touch();
    jest.advanceTimersByTime(900);

    expect(manager.isUnlocked).toBe(true);

    jest.advanceTimersByTime(101);
    expect(manager.isUnlocked).toBe(false);
  });

  it('saveAccount updates activity and delays auto-lock', async () => {
    const manager = new SecureStorageManager(new MockStorageAdapter(), {
      autoLockMs: 1_000,
    });

    await manager.unlock(password);
    jest.advanceTimersByTime(900);

    await manager.saveAccount(accountData);
    jest.advanceTimersByTime(900);

    expect(manager.isUnlocked).toBe(true);
  });
});
