import * as Keychain from 'react-native-keychain';
import type { SecureStoreAdapter } from '../storage/types';

export class KeychainSecureStoreAdapter implements SecureStoreAdapter {
  async set(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(key, value, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accessible: (Keychain as any).ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: key,
    });
  }

  async get(key: string): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({ service: key });
    if (credentials) {
      return credentials.password;
    }
    return null;
  }

  async remove(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: key });
  }

  async delete(key: string): Promise<void> {
    await this.remove(key);
  }

  async clear(): Promise<void> {
    // Cannot easily clear all generic passwords without knowing their services.
  }
}
