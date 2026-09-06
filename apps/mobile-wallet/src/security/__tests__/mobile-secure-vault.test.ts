/**
 * @jest-environment node
 */

import { webcrypto } from 'crypto';
import {
  ChromeStorageAdapter,
  SecureStorageManager,
  createAccountPersistence,
} from '@ancore/core-sdk';
import { MemorySecureStoreAdapter } from '../../storage';
import { createMobileSecureStorageManager } from '../mobile-storage-manager';

export const mockAppStateListeners = new Set<(state: string) => void>();

jest.mock(
  'react-native',
  () => ({
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn((event, callback) => {
        if (event === 'change') {
          mockAppStateListeners.add(callback);
        }
        return {
          remove: jest.fn(() => {
            mockAppStateListeners.delete(callback);
          }),
        };
      }),
    },
  }),
  { virtual: true }
);

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
  writable: true,
});

globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary');

interface MockChromeArea {
  get: (key: string, cb: (result: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, cb: () => void) => void;
  remove: (key: string, cb: () => void) => void;
  getBytesInUse: (_: null, cb: (bytes: number) => void) => void;
  QUOTA_BYTES: number;
}

function createMockChromeStorage(): {
  area: MockChromeArea;
  getRawStore: () => Record<string, unknown>;
} {
  const store: Record<string, unknown> = {};

  const area: MockChromeArea = {
    get: (key, cb) => cb({ [key]: store[key] }),
    set: (items, cb) => {
      Object.assign(store, items);
      cb();
    },
    remove: (key, cb) => {
      delete store[key];
      cb();
    },
    getBytesInUse: (_unused, cb) => cb(0),
    QUOTA_BYTES: 5_242_880,
  };

  (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
    runtime: { lastError: undefined },
  };

  return {
    area,
    getRawStore: () => store,
  };
}

describe('Unified Vault (SecureStorageManager + AccountPersistence)', () => {
  const password = 'correct horse battery staple';

  it('persists account metadata and encrypted key material through SecureStorageManager', async () => {
    const storage = new MemorySecureStoreAdapter();
    const manager = new SecureStorageManager(storage, {
      autoLockMs: undefined,
    });

    await expect(manager.unlock(password)).resolves.toBe(true);

    const accounts = createAccountPersistence(manager, {
      now: () => Date.parse('2026-04-23T12:00:00.000Z'),
    });

    const metadata = await accounts.persistAccount({
      id: 'primary',
      address: 'GABC1234',
      label: 'Primary account',
      keyMaterial: 'SSECRET1234',
      accountPayload: {
        network: 'testnet',
        encryptedMemoSeed: 'memo-seed',
      },
    });

    expect(metadata).toEqual({
      id: 'primary',
      address: 'GABC1234',
      label: 'Primary account',
      createdAt: '2026-04-23T12:00:00.000Z',
      updatedAt: '2026-04-23T12:00:00.000Z',
    });

    const persistedRecords = await storage.get('vault_accounts');

    expect(persistedRecords).not.toBeNull();
    expect(persistedRecords).not.toContain('SSECRET1234');
    expect(persistedRecords).not.toContain('memo-seed');
    expect(await accounts.listAccountMetadata()).toEqual([metadata]);
    expect(await accounts.loadAccount('primary')).toEqual({
      metadata,
      secret: {
        keyMaterial: 'SSECRET1234',
        accountPayload: {
          network: 'testnet',
          encryptedMemoSeed: 'memo-seed',
        },
      },
    });
  });

  it('rejects wrong passwords after the vault has been initialized', async () => {
    const storage = new MemorySecureStoreAdapter();
    const firstManager = new SecureStorageManager(storage);

    await firstManager.unlock(password);
    const firstAccounts = createAccountPersistence(firstManager);
    await firstAccounts.persistAccount({
      id: 'primary',
      address: 'GABC1234',
      keyMaterial: 'SSECRET1234',
      accountPayload: { network: 'testnet' },
    });
    firstManager.lock();

    const secondManager = new SecureStorageManager(storage);

    await expect(secondManager.unlock('wrong password')).resolves.toBe(false);
    expect(secondManager.isUnlocked).toBe(false);
    const secondAccounts = createAccountPersistence(secondManager);
    await expect(secondAccounts.loadAccount('primary')).rejects.toThrow(
      'Storage manager is locked'
    );
  });

  it('locks after the inactivity timeout elapses', async () => {
    jest.useFakeTimers();

    try {
      const storage = new MemorySecureStoreAdapter();
      const manager = new SecureStorageManager(storage, { autoLockMs: 1_000 });

      await manager.unlock(password);
      expect(manager.isUnlocked).toBe(true);

      jest.advanceTimersByTime(1_001);

      expect(manager.isUnlocked).toBe(false);
      const accounts = createAccountPersistence(manager);
      await expect(
        accounts.persistAccount({
          id: 'primary',
          address: 'GABC1234',
          keyMaterial: 'SSECRET1234',
          accountPayload: {},
        })
      ).rejects.toThrow('Storage manager is locked');
    } finally {
      jest.useRealTimers();
    }
  });

  it('round-trips encrypted payloads between extension and mobile adapters', async () => {
    const chromeStorage = createMockChromeStorage();
    const extensionManager = new SecureStorageManager(
      new ChromeStorageAdapter(chromeStorage.area as never)
    );
    const mobileStorage = new MemorySecureStoreAdapter();
    const mobileManager = new SecureStorageManager(mobileStorage);
    const account = {
      privateKey: 'SSECRET1234',
      publicKey: 'GABC1234',
    };

    await expect(extensionManager.unlock(password)).resolves.toBe(true);
    await extensionManager.saveAccount(account);

    for (const [key, value] of Object.entries(chromeStorage.getRawStore())) {
      await mobileStorage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    extensionManager.lock();

    await expect(mobileManager.unlock(password)).resolves.toBe(true);
    await expect(mobileManager.getAccount()).resolves.toEqual(account);
  });

  it('locks the secure vault when the app goes to the background with app state handler', async () => {
    mockAppStateListeners.clear();
    const storage = new MemorySecureStoreAdapter();
    const { manager, dispose } = createMobileSecureStorageManager(storage);

    // Initial state: locked
    expect(manager.isUnlocked).toBe(false);

    // Unlock vault
    await expect(manager.unlock(password)).resolves.toBe(true);
    expect(manager.isUnlocked).toBe(true);

    // Trigger app state change to inactive / background
    expect(mockAppStateListeners.size).toBe(1);
    const [listener] = Array.from(mockAppStateListeners);

    listener('background');

    // Should be locked now
    expect(manager.isUnlocked).toBe(false);

    // Clean up
    dispose();
    expect(mockAppStateListeners.size).toBe(0);
  });
});
