import { SecureStorageManager } from '@ancore/core-sdk';

import { createSecureStoreAdapter } from '../storage/secure-store-factory';
import { createMobileSecureStorageManager } from './mobile-storage-manager';
import { migrateLegacyMobileVault } from './vault-migration';

import type { SecureStoreAdapter } from '../storage/types';

type StorageManagerInstance = InstanceType<typeof SecureStorageManager>;

let sharedStorageManager: StorageManagerInstance | null = null;
let sharedDispose: (() => void) | null = null;

/** Shared vault instance for onboarding, unlock, and signing flows. */
export function getSharedStorageManager(): StorageManagerInstance {
  if (!sharedStorageManager) {
    const { manager, dispose } = createMobileSecureStorageManager(createSecureStoreAdapter());
    sharedStorageManager = manager;
    sharedDispose = dispose;
  }

  return sharedStorageManager as StorageManagerInstance;
}

/** Reset singleton; optionally seed with a test adapter before the next get. */
export function resetSharedStorageManagerForTests(adapter?: SecureStoreAdapter): void {
  if (sharedDispose) {
    sharedDispose();
  }
  sharedStorageManager = adapter ? new SecureStorageManager(adapter) : null;
  sharedDispose = null;
}

/**
 * Unlocks the shared vault and migrates any pre-unification account data.
 *
 * Every unlock path must go through this rather than calling
 * `getSharedStorageManager().unlock()` directly. Before #1338 nothing invoked
 * `migrateLegacyMobileVault`, so a user upgrading into the unified vault read
 * from the empty `vault_accounts` key while their real accounts sat untouched
 * under the old `mobile_vault_accounts` key — indistinguishable, from the
 * user's side, from the wallet having lost their keys.
 *
 * The migration runs after unlock because the legacy data is encrypted with
 * the same master key: it cannot be read until the manager holds it. It is
 * idempotent — it no-ops when there is no legacy key or when the new key
 * already exists — so running it on every unlock costs one storage read in the
 * steady state and needs no "have I migrated yet" flag of its own.
 *
 * A migration failure does not fail the unlock. The migration copies before it
 * deletes, so a failure leaves the legacy data intact and the next unlock tries
 * again; failing the unlock instead would lock a user out of a wallet whose
 * data is still perfectly readable.
 */
export async function unlockSharedStorageManager(password: string): Promise<boolean> {
  const manager = getSharedStorageManager();
  const unlocked = await manager.unlock(password);

  if (!unlocked) {
    return false;
  }

  try {
    await migrateLegacyMobileVault(manager);
  } catch (error) {
    console.warn(
      '[vault] legacy vault migration failed; legacy data left in place and will be retried on next unlock',
      error
    );
  }

  return true;
}

const MASTER_SALT_KEY = 'master_salt';

/** True when a vault has been initialized (onboarding completed at least once). */
export async function hasOnboardedWallet(): Promise<boolean> {
  const adapter = createSecureStoreAdapter();
  const salt = await adapter.get(MASTER_SALT_KEY);
  return typeof salt === 'string' && salt.length > 0;
}
