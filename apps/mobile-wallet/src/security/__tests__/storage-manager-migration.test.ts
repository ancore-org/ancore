/**
 * @jest-environment node
 *
 * Regression tests for #1338: the legacy-vault migration existed but nothing
 * ever called it, so a user upgrading into the unified vault would read from
 * an empty `vault_accounts` key while their real accounts sat untouched under
 * `mobile_vault_accounts` — silent loss of wallet access after an app update.
 *
 * These assert the migration is actually reached on unlock, not merely that
 * `migrateLegacyMobileVault` works in isolation (which it already did).
 */

import { webcrypto } from 'crypto';
import { MemorySecureStoreAdapter } from '../../storage';
import {
  getSharedStorageManager,
  resetSharedStorageManagerForTests,
  unlockSharedStorageManager,
} from '../storage-manager';

jest.mock(
  'react-native',
  () => ({
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
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

const LEGACY_KEY = 'mobile_vault_accounts';
const NEW_KEY = 'vault_accounts';
const PASSWORD = 'correct horse battery staple';

const legacyAccounts = {
  primary: {
    metadata: {
      id: 'primary',
      address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
      label: 'My Wallet',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    secret: { keyMaterial: 'encrypted-mnemonic-blob' },
  },
};

/**
 * Stand up a vault holding pre-unification data, exactly as a user upgrading
 * from an older build would have it: the master key established, accounts
 * under the legacy key, nothing under the new one.
 */
async function seedLegacyVault(adapter: MemorySecureStoreAdapter) {
  resetSharedStorageManagerForTests(adapter);
  const manager = getSharedStorageManager();

  await manager.unlock(PASSWORD);
  await manager.saveItem(LEGACY_KEY, legacyAccounts);
  manager.lock();

  // Fresh manager over the same storage — the state after an app restart.
  resetSharedStorageManagerForTests(adapter);
}

describe('unlockSharedStorageManager (#1338)', () => {
  let adapter: MemorySecureStoreAdapter;

  beforeEach(() => {
    adapter = new MemorySecureStoreAdapter();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetSharedStorageManagerForTests();
    jest.restoreAllMocks();
  });

  it('migrates legacy vault accounts on unlock', async () => {
    await seedLegacyVault(adapter);

    const unlocked = await unlockSharedStorageManager(PASSWORD);
    expect(unlocked).toBe(true);

    const manager = getSharedStorageManager();
    await expect(manager.getItem(NEW_KEY)).resolves.toEqual(legacyAccounts);
  });

  it('removes the legacy key once the accounts are copied across', async () => {
    await seedLegacyVault(adapter);

    await unlockSharedStorageManager(PASSWORD);

    const manager = getSharedStorageManager();
    await expect(manager.getItem(LEGACY_KEY)).resolves.toBeNull();
  });

  it('leaves an already-unified vault untouched', async () => {
    resetSharedStorageManagerForTests(adapter);
    const seeded = getSharedStorageManager();
    await seeded.unlock(PASSWORD);
    const current = { primary: { ...legacyAccounts.primary, secret: { keyMaterial: 'current' } } };
    await seeded.saveItem(NEW_KEY, current);
    seeded.lock();
    resetSharedStorageManagerForTests(adapter);

    await unlockSharedStorageManager(PASSWORD);

    const manager = getSharedStorageManager();
    await expect(manager.getItem(NEW_KEY)).resolves.toEqual(current);
  });

  it('does not overwrite unified data when a stale legacy key is also present', async () => {
    resetSharedStorageManagerForTests(adapter);
    const seeded = getSharedStorageManager();
    await seeded.unlock(PASSWORD);
    const current = { primary: { ...legacyAccounts.primary, secret: { keyMaterial: 'current' } } };
    await seeded.saveItem(NEW_KEY, current);
    await seeded.saveItem(LEGACY_KEY, legacyAccounts);
    seeded.lock();
    resetSharedStorageManagerForTests(adapter);

    await unlockSharedStorageManager(PASSWORD);

    // The new key wins: the migration is a one-way copy into an empty slot,
    // never a merge that could resurrect superseded key material.
    const manager = getSharedStorageManager();
    await expect(manager.getItem(NEW_KEY)).resolves.toEqual(current);
  });

  it('is a no-op for a vault that never had legacy data', async () => {
    resetSharedStorageManagerForTests(adapter);
    const seeded = getSharedStorageManager();
    await seeded.unlock(PASSWORD);
    seeded.lock();
    resetSharedStorageManagerForTests(adapter);

    await expect(unlockSharedStorageManager(PASSWORD)).resolves.toBe(true);

    const manager = getSharedStorageManager();
    await expect(manager.getItem(NEW_KEY)).resolves.toBeNull();
  });

  it('reports failure and skips migration when the password is wrong', async () => {
    await seedLegacyVault(adapter);

    await expect(unlockSharedStorageManager('wrong password')).resolves.toBe(false);

    // The legacy data must still be there for the next, correct attempt.
    const manager = getSharedStorageManager();
    await manager.unlock(PASSWORD);
    await expect(manager.getItem(LEGACY_KEY)).resolves.toEqual(legacyAccounts);
  });

  it('still unlocks when the migration throws, leaving legacy data for a retry', async () => {
    await seedLegacyVault(adapter);

    const manager = getSharedStorageManager();
    const saveItem = jest
      .spyOn(manager, 'saveItem')
      .mockRejectedValueOnce(new Error('keychain unavailable'));

    // The unlock must succeed: the user's data is readable, and failing here
    // would lock them out of a wallet that is perfectly intact.
    await expect(unlockSharedStorageManager(PASSWORD)).resolves.toBe(true);
    expect(console.warn).toHaveBeenCalled();

    saveItem.mockRestore();

    // Nothing was destroyed, so the next unlock migrates successfully.
    await expect(manager.getItem(LEGACY_KEY)).resolves.toEqual(legacyAccounts);

    manager.lock();
    await unlockSharedStorageManager(PASSWORD);
    await expect(manager.getItem(NEW_KEY)).resolves.toEqual(legacyAccounts);
  });
});
