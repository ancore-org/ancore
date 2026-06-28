import * as Keychain from 'react-native-keychain';
import type { SecureStoreAdapter } from '../storage/types';

export class KeychainSecureStoreAdapter implements SecureStoreAdapter {
  async set(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(key, value, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
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
}
