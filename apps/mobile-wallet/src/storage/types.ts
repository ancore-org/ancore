import type { PlatformStorageAdapter } from '@ancore/core-sdk';

export interface SecureStoreAdapter extends PlatformStorageAdapter {
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface EncryptedPayload {
  iv: string;
  salt: string;
  data: string;
}

export interface PersistedVaultState {
  version: 1;
  masterSalt: string;
  verification: EncryptedPayload;
}

export interface AccountMetadata {
  id: string;
  address: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSecretPayload {
  keyMaterial: string;
  accountPayload: Record<string, unknown>;
}

export interface PersistedAccountRecord {
  metadata: AccountMetadata;
  secret: AccountSecretPayload;
}
