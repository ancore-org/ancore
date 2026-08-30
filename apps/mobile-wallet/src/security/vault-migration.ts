/**
 * Migration utilities for transitioning from MobileSecureVault to unified AccountPersistence.
 * Handles migration of existing vault data from the legacy storage key format.
 */

import type { SecureStoreAdapter } from '../storage/types';

const LEGACY_MOBILE_VAULT_KEY = 'mobile_vault_accounts';
const NEW_VAULT_KEY = 'vault_accounts';

/**
 * Checks if legacy MobileSecureVault data exists in storage.
 * @param storage - The storage adapter
 * @returns true if legacy vault data is present
 */
export async function hasLegacyVaultData(storage: SecureStoreAdapter): Promise<boolean> {
  try {
    const legacyData = await storage.get(LEGACY_MOBILE_VAULT_KEY);
    return legacyData != null;
  } catch {
    return false;
  }
}

/**
 * Migrates legacy MobileSecureVault account data to the new unified format.
 * This should be called once after an app update when the manager is unlocked.
 *
 * The migration is a no-op if:
 * - No legacy vault key exists
 * - The new vault key already exists (migration already completed)
 *
 * @param storageManager - Unlocked SecureStorageManager instance
 * @returns true if migration was performed, false if already migrated or no legacy data
 * @throws Error if the manager is locked or storage operations fail
 *
 * @example
 * ```typescript
 * import { SecureStorageManager } from '@ancore/core-sdk';
 * import { migrateLegacyMobileVault } from './vault-migration';
 *
 * const manager = new SecureStorageManager(adapter);
 * await manager.unlock(password);
 *
 * if (await migrateLegacyMobileVault(manager)) {
 *   console.log('Vault migrated successfully');
 * }
 * ```
 */
export async function migrateLegacyMobileVault(storageManager: {
  isUnlocked: boolean;
  getItem<T>(key: string): Promise<T | null>;
  saveItem(key: string, value: unknown): Promise<void>;
  deleteItem(key: string): Promise<void>;
}): Promise<boolean> {
  if (!storageManager.isUnlocked) {
    throw new Error('StorageManager must be unlocked to migrate legacy vault data');
  }

  try {
    // Check if legacy data exists
    const legacyData = await storageManager.getItem<unknown>(LEGACY_MOBILE_VAULT_KEY);
    if (!legacyData) {
      // No legacy data to migrate
      return false;
    }

    // Check if new data already exists (migration already done)
    const newData = await storageManager.getItem<unknown>(NEW_VAULT_KEY);
    if (newData) {
      // Migration already completed
      return false;
    }

    // Migrate: copy legacy data to new key
    await storageManager.saveItem(NEW_VAULT_KEY, legacyData);

    // Clean up: delete legacy key
    await storageManager.deleteItem(LEGACY_MOBILE_VAULT_KEY);

    return true;
  } catch (error) {
    throw new Error(
      `Failed to migrate legacy mobile vault: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
