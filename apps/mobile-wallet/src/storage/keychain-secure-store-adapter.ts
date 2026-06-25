import * as Keychain from 'react-native-keychain';

import { SecureStoreAdapter } from './types';

/**
 * Username stored alongside every Keychain entry. Keychain requires a username,
 * but the adapter keys data by `service`, so the username is a constant marker.
 */
export const KEYCHAIN_USERNAME = 'ancore';

/**
 * Keychain service names are scoped per bundle ID so the production and
 * development builds never read or overwrite each other's secrets on a device
 * that has both installed (mirrors Freighter's per-bundle keychain scoping).
 */
export const PROD_BUNDLE_ID = 'org.ancore.wallet';
export const DEV_BUNDLE_ID = 'org.ancore.wallet.dev';

/**
 * Reserved logical key used to persist the set of keys this adapter has written.
 * Keychain has no "enumerate entries" primitive, so we maintain a small index to
 * support {@link KeychainSecureStoreAdapter.clear}.
 */
const KEY_INDEX = '__keys__';

declare const __DEV__: boolean | undefined;

const resolveDefaultBundleId = (): string => {
  // `__DEV__` is injected by the React Native bundler; true in dev builds.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return DEV_BUNDLE_ID;
  }

  return PROD_BUNDLE_ID;
};

export interface KeychainSecureStoreAdapterOptions {
  /**
   * Bundle ID used to namespace Keychain service names. Defaults to the
   * production bundle ID, or the dev bundle ID when `__DEV__` is set.
   */
  bundleId?: string;
}

/**
 * Production {@link SecureStoreAdapter} backed by `react-native-keychain`.
 *
 * Secrets persisted here survive app cold starts (unlike
 * {@link MemorySecureStoreAdapter}) and are stored in the iOS Keychain /
 * Android Keystore. The unified vault stores already-serialized encrypted
 * payloads here as strings.
 *
 * **Storage rule:** mnemonics, key material, and the encrypted vault blobs go
 * here — never in AsyncStorage. Only non-sensitive metadata/preferences belong
 * in AsyncStorage. See `apps/mobile-wallet/docs/secure-storage.md`.
 */
export class KeychainSecureStoreAdapter implements SecureStoreAdapter {
  private readonly bundleId: string;

  constructor(options: KeychainSecureStoreAdapterOptions = {}) {
    this.bundleId = options.bundleId ?? resolveDefaultBundleId();
  }

  async get(key: string): Promise<string | null> {
    const result = await Keychain.getGenericPassword({ service: this.serviceFor(key) });

    if (!result) {
      return null;
    }

    return result.password;
  }

  async set(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, value, {
      service: this.serviceFor(key),
    });

    await this.indexAdd(key);
  }

  async delete(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: this.serviceFor(key) });
    await this.indexRemove(key);
  }

  async remove(key: string): Promise<void> {
    await this.delete(key);
  }

  async clear(): Promise<void> {
    const keys = await this.readIndex();

    await Promise.all(
      keys.map((key) => Keychain.resetGenericPassword({ service: this.serviceFor(key) }))
    );

    await Keychain.resetGenericPassword({ service: this.serviceFor(KEY_INDEX) });
  }

  /** Bundle-scoped Keychain service name for a logical key. */
  private serviceFor(key: string): string {
    return `${this.bundleId}.${key}`;
  }

  private async readIndex(): Promise<string[]> {
    const result = await Keychain.getGenericPassword({ service: this.serviceFor(KEY_INDEX) });

    if (!result) {
      return [];
    }

    try {
      const parsed = JSON.parse(result.password);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(keys: string[]): Promise<void> {
    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, JSON.stringify(keys), {
      service: this.serviceFor(KEY_INDEX),
    });
  }

  private async indexAdd(key: string): Promise<void> {
    const keys = await this.readIndex();

    if (!keys.includes(key)) {
      await this.writeIndex([...keys, key]);
    }
  }

  private async indexRemove(key: string): Promise<void> {
    const keys = await this.readIndex();
    const next = keys.filter((existing) => existing !== key);

    if (next.length !== keys.length) {
      await this.writeIndex(next);
    }
  }
}
