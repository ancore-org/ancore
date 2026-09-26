import { webcrypto } from 'crypto';
import type { StorageAdapter } from '../types';

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
import { AccountPersistence, createAccountPersistence } from '../account-persistence';

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
}

describe('AccountPersistence', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;
  let persistence: AccountPersistence;
  let mockTime = 1700000000000;

  beforeEach(async () => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
    await manager.unlock('test-password-1234');
    mockTime = 1700000000000;
    persistence = createAccountPersistence(manager, {
      now: () => mockTime,
    });
  });

  it('persists an account with metadata and secret payload', async () => {
    const meta = await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      label: 'Main Account',
      keyMaterial: 'encrypted-secret-key-1',
      accountPayload: { derivationPath: "m/44'/148'/0'" },
    });

    expect(meta).toEqual({
      id: 'acc-1',
      address: 'GABC123',
      label: 'Main Account',
      createdAt: new Date(1700000000000).toISOString(),
      updatedAt: new Date(1700000000000).toISOString(),
    });

    const stored = await persistence.loadAccount('acc-1');
    expect(stored).toBeDefined();
    expect(stored?.metadata).toEqual(meta);
    expect(stored?.secret).toEqual({
      keyMaterial: 'encrypted-secret-key-1',
      accountPayload: { derivationPath: "m/44'/148'/0'" },
    });
  });

  it('preserves an account label on update when omitted by caller', async () => {
    // 1. Create with label
    await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      label: 'Savings Vault',
      keyMaterial: 'key-v1',
      accountPayload: {},
    });

    // Advance time
    mockTime += 5000;

    // 2. Update without passing label (e.g. key rotation or payload update)
    const updated = await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      keyMaterial: 'key-v2',
      accountPayload: { rotated: true },
    });

    expect(updated.label).toBe('Savings Vault');
    expect(updated.createdAt).toBe(new Date(1700000000000).toISOString());
    expect(updated.updatedAt).toBe(new Date(1700000005000).toISOString());

    // Verify stored record
    const stored = await persistence.loadAccount('acc-1');
    expect(stored?.metadata.label).toBe('Savings Vault');
    expect(stored?.secret.keyMaterial).toBe('key-v2');
    expect(stored?.secret.accountPayload).toEqual({ rotated: true });
  });

  it('updates an account label when explicitly provided', async () => {
    await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      label: 'Original Label',
      keyMaterial: 'key-v1',
      accountPayload: {},
    });

    mockTime += 2000;

    const updated = await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      label: 'Renamed Label',
      keyMaterial: 'key-v1',
      accountPayload: {},
    });

    expect(updated.label).toBe('Renamed Label');

    const stored = await persistence.loadAccount('acc-1');
    expect(stored?.metadata.label).toBe('Renamed Label');
  });

  it('lists all accounts in creation order without secrets', async () => {
    await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      label: 'Account 1',
      keyMaterial: 'secret-1',
      accountPayload: {},
    });

    mockTime += 1000;

    await persistence.persistAccount({
      id: 'acc-2',
      address: 'GDEF456',
      label: 'Account 2',
      keyMaterial: 'secret-2',
      accountPayload: {},
    });

    const list = await persistence.listAccountMetadata();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('acc-1');
    expect(list[1].id).toBe('acc-2');
    expect((list[0] as unknown as { secret?: unknown }).secret).toBeUndefined();
  });

  it('returns null when loading non-existent account', async () => {
    const loaded = await persistence.loadAccount('non-existent');
    expect(loaded).toBeNull();
  });

  it('deletes an account and tracks account count', async () => {
    await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      keyMaterial: 'secret-1',
      accountPayload: {},
    });
    await persistence.persistAccount({
      id: 'acc-2',
      address: 'GDEF456',
      keyMaterial: 'secret-2',
      accountPayload: {},
    });

    expect(await persistence.getAccountCount()).toBe(2);

    await persistence.deleteAccount('acc-1');
    expect(await persistence.getAccountCount()).toBe(1);
    expect(await persistence.loadAccount('acc-1')).toBeNull();
    expect(await persistence.loadAccount('acc-2')).not.toBeNull();
  });

  it('clears all accounts', async () => {
    await persistence.persistAccount({
      id: 'acc-1',
      address: 'GABC123',
      keyMaterial: 'secret-1',
      accountPayload: {},
    });

    await persistence.clearAllAccounts();
    await manager.unlock('test-password-1234');
    expect(await persistence.getAccountCount()).toBe(0);
    expect(await persistence.listAccountMetadata()).toEqual([]);
  });
});
