import {
  KeychainSecureStoreAdapter,
  type KeychainSecureStoreAdapterOptions,
} from './keychain-secure-store-adapter';
import { MemorySecureStoreAdapter } from './mobile-secure-storage-adapter';
import { SecureStoreAdapter } from './types';

/**
 * Detects whether the current process is a Jest test run.
 *
 * `react-native-keychain` is a native module that Jest never calls, so the
 * factory falls back to the in-memory adapter under test.
 */
export function isJestEnvironment(): boolean {
  return (
    typeof jest !== 'undefined' ||
    (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined)
  );
}

export interface CreateSecureStoreAdapterOptions extends KeychainSecureStoreAdapterOptions {
  /**
   * Force the production Keychain adapter even under Jest. Used to unit-test the
   * Keychain adapter wiring with a mocked native module.
   */
  forceProduction?: boolean;
}

/**
 * Returns the appropriate {@link SecureStoreAdapter} for the current environment:
 *
 * - **Production (device/simulator):** {@link KeychainSecureStoreAdapter}, which
 *   persists secrets in the iOS Keychain / Android Keystore across cold starts.
 * - **Jest:** {@link MemorySecureStoreAdapter}, since the native Keychain bridge
 *   is unavailable in unit tests.
 */
export function createSecureStoreAdapter(
  options: CreateSecureStoreAdapterOptions = {}
): SecureStoreAdapter {
  const { forceProduction, ...keychainOptions } = options;

  if (!forceProduction && isJestEnvironment()) {
    return new MemorySecureStoreAdapter();
  }

  return new KeychainSecureStoreAdapter(keychainOptions);
}
