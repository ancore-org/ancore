import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  // @ts-expect-error - Polyfill for Node.js environment
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

import { SecureStorageManager } from '../secure-storage-manager';
import { StorageAdapter } from '../types';

class MockStorageAdapter implements StorageAdapter {
  private store: Map<string, unknown> = new Map();

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.store.has(key)) return null;
    return this.store.get(key) as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  raw(key: string): unknown {
    return this.store.get(key);
  }
}

const OLD_PASSWORD = 'old-password-123';
const NEW_PASSWORD = 'new-password-456';
const ACCOUNT = { privateKey: 'S-SECRET-KEY', address: 'GABC' };

async function seedVault(storage: StorageAdapter) {
  const manager = new SecureStorageManager(storage);
  await manager.unlock(OLD_PASSWORD);
  await manager.saveAccount(ACCOUNT);
  await manager.saveSessionKeys({ keys: { a: 'session-a' } });
  manager.lock();
  return manager;
}

describe('SecureStorageManager.changePassword', () => {
  it('re-encrypts the vault so the new password unlocks it', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);

    await expect(manager.changePassword(OLD_PASSWORD, NEW_PASSWORD)).resolves.toBe(true);

    const reopened = new SecureStorageManager(storage);
    await expect(reopened.unlock(NEW_PASSWORD)).resolves.toBe(true);
    await expect(reopened.getAccount()).resolves.toEqual(ACCOUNT);
    await expect(reopened.getSessionKeys()).resolves.toEqual({ keys: { a: 'session-a' } });
  });

  it('makes the old password stop working', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);

    await manager.changePassword(OLD_PASSWORD, NEW_PASSWORD);

    const reopened = new SecureStorageManager(storage);
    await expect(reopened.unlock(OLD_PASSWORD)).resolves.toBe(false);
  });

  it('rejects an incorrect current password and leaves the vault intact', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);
    const saltBefore = storage.raw('master_salt');
    const accountBefore = storage.raw('account');

    await expect(manager.changePassword('wrong-password', NEW_PASSWORD)).resolves.toBe(false);

    expect(storage.raw('master_salt')).toBe(saltBefore);
    expect(storage.raw('account')).toBe(accountBefore);

    const reopened = new SecureStorageManager(storage);
    await expect(reopened.unlock(OLD_PASSWORD)).resolves.toBe(true);
    await expect(reopened.getAccount()).resolves.toEqual(ACCOUNT);
  });

  it('rejects a wrong current password even when already unlocked', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);
    await manager.unlock(OLD_PASSWORD);
    expect(manager.isUnlocked).toBe(true);

    await expect(manager.changePassword('wrong-password', NEW_PASSWORD)).resolves.toBe(false);

    const reopened = new SecureStorageManager(storage);
    await expect(reopened.unlock(OLD_PASSWORD)).resolves.toBe(true);
  });

  it('rotates the master salt so the old derived key cannot open the vault', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);
    const saltBefore = storage.raw('master_salt');

    await manager.changePassword(OLD_PASSWORD, NEW_PASSWORD);

    expect(storage.raw('master_salt')).not.toBe(saltBefore);
  });

  it('returns false when no vault exists', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);

    await expect(manager.changePassword(OLD_PASSWORD, NEW_PASSWORD)).resolves.toBe(false);
  });

  it('re-encrypts additional caller-supplied keys', async () => {
    const storage = new MockStorageAdapter();
    const manager = new SecureStorageManager(storage);
    await manager.unlock(OLD_PASSWORD);
    await manager.saveItem('customSettings', { theme: 'dark' });
    manager.lock();

    await expect(
      manager.changePassword(OLD_PASSWORD, NEW_PASSWORD, ['customSettings'])
    ).resolves.toBe(true);

    const reopened = new SecureStorageManager(storage);
    await reopened.unlock(NEW_PASSWORD);
    await expect(reopened.getItem('customSettings')).resolves.toEqual({ theme: 'dark' });
  });

  it('leaves the manager unlocked under the new password', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);

    await manager.changePassword(OLD_PASSWORD, NEW_PASSWORD);

    expect(manager.isUnlocked).toBe(true);
    await expect(manager.getAccount()).resolves.toEqual(ACCOUNT);
  });

  it('aborts without writing when a stored payload is unreadable', async () => {
    const storage = new MockStorageAdapter();
    const manager = await seedVault(storage);
    // Corrupt one item while keeping it a structurally valid payload.
    const stored = storage.raw('account');
    const corrupted = typeof stored === 'string' ? JSON.parse(stored) : { ...(stored as object) };
    (corrupted as { data: string }).data = Buffer.from('tampered-ciphertext').toString('base64');
    await storage.set('account', JSON.stringify(corrupted));
    const saltBefore = storage.raw('master_salt');

    await expect(manager.changePassword(OLD_PASSWORD, NEW_PASSWORD)).rejects.toThrow(/unreadable/);

    // Salt untouched, so the vault still opens with the original password.
    expect(storage.raw('master_salt')).toBe(saltBefore);
    const reopened = new SecureStorageManager(storage);
    await expect(reopened.unlock(OLD_PASSWORD)).resolves.toBe(true);
  });
});
