import { ChromeStorageAdapter, SecureStorageManager, type StorageAdapter } from '@ancore/core-sdk';

type StorageManagerInstance = InstanceType<typeof SecureStorageManager>;

let _storageManager: StorageManagerInstance | null = null;

/** Shared SecureStorageManager instance for lock/unlock and vault export flows. */
export function getSharedStorageManager(): StorageManagerInstance {
  if (!_storageManager) {
    _storageManager = new SecureStorageManager(new ChromeStorageAdapter());
  }
  return _storageManager;
}

/** Reset singleton; optionally seed with a test adapter before the next getSharedStorageManager(). */
export function resetSharedStorageManagerForTests(adapter?: StorageAdapter): void {
  _storageManager = adapter ? new SecureStorageManager(adapter) : null;
  globalThis.localStorage?.clear?.();
}
