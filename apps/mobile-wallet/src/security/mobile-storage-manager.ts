/**
 * Mobile-specific wrapper for SecureStorageManager that adds React Native AppState handling.
 * Automatically locks the vault when the app goes to background.
 */

import { AppState } from 'react-native';
import type { SecureStorageManager } from '@ancore/core-sdk';
import { SecureStorageManager as SSM } from '@ancore/core-sdk';
import { SecureStoreAdapter } from '../storage/types';

export interface MobileSecureStorageManagerOptions {
  /** Auto-lock timeout in milliseconds, or null to disable auto-lock */
  autoLockMs?: number;
}

/**
 * Creates a SecureStorageManager instance with automatic app state handling.
 * Locks the vault when the app transitions to background state.
 *
 * @param storage - The SecureStoreAdapter instance (Keychain adapter)
 * @param options - SecureStorageManager options (autoLockMs, etc.)
 * @returns An object containing the manager and cleanup function
 */
export function createMobileSecureStorageManager(
  storage: SecureStoreAdapter,
  options?: MobileSecureStorageManagerOptions
): {
  manager: SecureStorageManager;
  dispose: () => void;
} {
  const manager = new SSM(storage, options);

  // Lock secure vault when app goes to background
  let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
  if (typeof AppState !== 'undefined' && typeof AppState.addEventListener === 'function') {
    subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        manager.lock();
      }
    });
  }

  return {
    manager,
    dispose: () => {
      subscription?.remove();
    },
  };
}
