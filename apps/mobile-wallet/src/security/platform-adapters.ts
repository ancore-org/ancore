import type { IPasswordAuthService } from './hooks/useBiometricUnlock';
import type { SecureStoreAdapter } from '../storage/types';

import { NativeBiometricAdapter } from './NativeBiometricAdapter';

export const WebAuthnBiometricService = NativeBiometricAdapter;

// Password auth adapter
export class WalletPasswordAuthService implements IPasswordAuthService {
  private verifyPassword: (pw: string) => Promise<boolean>;

  constructor(verifyFn: (pw: string) => Promise<boolean>) {
    this.verifyPassword = verifyFn;
  }

  async authenticate(password: string): Promise<boolean> {
    return this.verifyPassword(password);
  }
}

// Secure storage adapter
export function makeSecureStorageAdapter(store: SecureStoreAdapter) {
  return {
    getItem: (key: string) => store.get(key),
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.remove(key),
  };
}
