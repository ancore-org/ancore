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
import type { StorageAdapter } from '../types';
import { AccountPersistence, createAccountPersistence } from '../account-persistence';

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

async function createUnlockedManager(): Promise<SecureStorageManager> {
  const manager = new SecureStorageManager(new MockStorageAdapter());
  await manager.unlock('super_secret_password_123!');
  return manager;
}

describe('AccountPersistence', () => {
  it('creates an instance via the factory function', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager);
    expect(accounts).toBeInstanceOf(AccountPersistence);
  });

  it('persists a new account and returns its metadata', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager, { now: () => 1_716_000_000_000 });

    const metadata = await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      label: 'Main',
      keyMaterial: 'encrypted-mnemonic',
      accountPayload: { derivationPath: "m/44'/148'/0'" },
    });

    expect(metadata).toEqual({
      id: 'account-1',
      address: 'GACC1',
      label: 'Main',
      createdAt: new Date(1_716_000_000_000).toISOString(),
      updatedAt: new Date(1_716_000_000_000).toISOString(),
    });
  });

  it('preserves createdAt and bumps updatedAt when persisting over an existing account', async () => {
    const manager = await createUnlockedManager();
    let now = 1_716_000_000_000;
    const accounts = createAccountPersistence(manager, { now: () => now });

    const first = await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      keyMaterial: 'encrypted-mnemonic',
      accountPayload: {},
    });

    now += 60_000;
    const second = await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1-updated',
      keyMaterial: 'encrypted-mnemonic-2',
      accountPayload: {},
    });

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.address).toBe('GACC1-updated');
  });

  it('lists account metadata sorted by creation order, without secret material', async () => {
    const manager = await createUnlockedManager();
    let now = 1_716_000_000_000;
    const accounts = createAccountPersistence(manager, { now: () => now });

    await accounts.persistAccount({
      id: 'account-2',
      address: 'GACC2',
      keyMaterial: 'secret-2',
      accountPayload: {},
    });
    now += 60_000;
    await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      keyMaterial: 'secret-1',
      accountPayload: {},
    });

    const list = await accounts.listAccountMetadata();
    expect(list.map((entry) => entry.id)).toEqual(['account-2', 'account-1']);
    expect(list.every((entry) => !('secret' in entry))).toBe(true);
  });

  it('returns null when loading an account that does not exist', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager);

    expect(await accounts.loadAccount('missing')).toBeNull();
  });

  it('loads a persisted account including its secret payload', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager);

    await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      keyMaterial: 'encrypted-mnemonic',
      accountPayload: { foo: 'bar' },
    });

    const loaded = await accounts.loadAccount('account-1');
    expect(loaded?.metadata.id).toBe('account-1');
    expect(loaded?.secret).toEqual({
      keyMaterial: 'encrypted-mnemonic',
      accountPayload: { foo: 'bar' },
    });
  });

  it('deletes an account by id', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager);

    await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      keyMaterial: 'secret',
      accountPayload: {},
    });
    await accounts.deleteAccount('account-1');

    expect(await accounts.loadAccount('account-1')).toBeNull();
  });

  it('reports the account count', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager);

    expect(await accounts.getAccountCount()).toBe(0);

    await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      keyMaterial: 'secret',
      accountPayload: {},
    });
    await accounts.persistAccount({
      id: 'account-2',
      address: 'GACC2',
      keyMaterial: 'secret',
      accountPayload: {},
    });

    expect(await accounts.getAccountCount()).toBe(2);
  });

  it('clears all account data by resetting (and locking) the storage manager', async () => {
    const manager = await createUnlockedManager();
    const accounts = createAccountPersistence(manager, { storageKey: 'custom_accounts_key' });

    await accounts.persistAccount({
      id: 'account-1',
      address: 'GACC1',
      keyMaterial: 'secret',
      accountPayload: {},
    });
    await accounts.clearAllAccounts();

    // reset() locks the manager as part of the wipe, so a subsequent read
    // must fail closed rather than silently reporting an empty vault.
    await expect(accounts.getAccountCount()).rejects.toThrow(/locked/i);
  });
});
