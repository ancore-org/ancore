import { SecureStorageManager } from '@ancore/core-sdk';

import { createSecureStoreAdapter } from '../storage/secure-store-factory';

import type { SecureStoreAdapter } from '../storage/types';

type StorageManagerInstance = InstanceType<typeof SecureStorageManager>;

let sharedStorageManager: StorageManagerInstance | null = null;

/** Shared vault instance for onboarding, unlock, and signing flows. */
export function getSharedStorageManager(): StorageManagerInstance {
  if (!sharedStorageManager) {
    sharedStorageManager = new SecureStorageManager(createSecureStoreAdapter());
  }

  return sharedStorageManager;
}

/** Reset singleton; optionally seed with a test adapter before the next get. */
export function resetSharedStorageManagerForTests(adapter?: SecureStoreAdapter): void {
  sharedStorageManager = adapter ? new SecureStorageManager(adapter) : null;
}

const MASTER_SALT_KEY = 'master_salt';

/** True when a vault has been initialized (onboarding completed at least once). */
export async function hasOnboardedWallet(): Promise<boolean> {
  const adapter = createSecureStoreAdapter();
  const salt = await adapter.get(MASTER_SALT_KEY);
  return typeof salt === 'string' && salt.length > 0;
}
