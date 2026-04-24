export interface SecureStoreAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
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
  encryptedSecret: EncryptedPayload;
}
