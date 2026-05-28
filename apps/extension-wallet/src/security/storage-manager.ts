import { SecureStorageManager, createStorageAdapter } from '@ancore/core-sdk';

type StorageManagerInstance = InstanceType<typeof SecureStorageManager>;

let _storageManager: StorageManagerInstance | null = null;

/** Shared SecureStorageManager instance for lock/unlock and vault export flows. */
export function getSharedStorageManager(): StorageManagerInstance {
  if (!_storageManager) {
    _storageManager = new SecureStorageManager(createStorageAdapter());
  }
  return _storageManager;
}

export function resetSharedStorageManagerForTests(): void {
  _storageManager = null;
}
