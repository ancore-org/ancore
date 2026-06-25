import { AppState } from 'react-native';
import { SecureStorageManager } from '@ancore/core-sdk';
import {
  AccountMetadata,
  AccountSecretPayload,
  PersistedAccountRecord,
  SecureStoreAdapter,
} from '../storage';

const VAULT_ACCOUNTS_KEY = 'mobile_vault_accounts';

export interface MobileVaultOptions {
  lockTimeoutMs?: number;
  now?: () => number;
}

export interface PersistAccountInput {
  id: string;
  address: string;
  label?: string;
  keyMaterial: string;
  accountPayload: Record<string, unknown>;
}

export interface StoredAccount {
  metadata: AccountMetadata;
  secret: AccountSecretPayload;
}

/**
 * @deprecated Use `SecureStorageManager` from `@ancore/core-sdk` directly with a
 * `SecureStoreAdapter`. This wrapper remains temporarily while mobile callers
 * migrate off the legacy `MobileSecureVault` API surface.
 */
export class MobileSecureVault {
  private readonly storageManager: SecureStorageManager;
  private readonly now: () => number;
  private readonly appStateSubscription?: { remove: () => void };

  constructor(storage: SecureStoreAdapter, options: MobileVaultOptions = {}) {
    this.storageManager = new SecureStorageManager(storage, {
      autoLockMs: options.lockTimeoutMs,
    });
    this.now = options.now ?? (() => Date.now());

    // Lock secure vault when app goes to background
    if (typeof AppState !== 'undefined' && typeof AppState.addEventListener === 'function') {
      this.appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') {
          this.lock();
        }
      });
    }
  }

  get isUnlocked(): boolean {
    return this.storageManager.isUnlocked;
  }

  async unlock(password: string): Promise<boolean> {
    return this.storageManager.unlock(password);
  }

  lock(): void {
    this.storageManager.lock();
  }

  touch(): void {
    this.storageManager.touch();
  }

  dispose(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  async persistAccount(input: PersistAccountInput): Promise<AccountMetadata> {
    const records = await this.loadAccountRecords();
    const existingRecord = records[input.id];
    const createdAt = existingRecord?.metadata.createdAt ?? new Date(this.now()).toISOString();
    const updatedAt = new Date(this.now()).toISOString();

    const metadata: AccountMetadata = {
      id: input.id,
      address: input.address,
      label: input.label,
      createdAt,
      updatedAt,
    };

    records[input.id] = {
      metadata,
      secret: {
        keyMaterial: input.keyMaterial,
        accountPayload: input.accountPayload,
      },
    };

    await this.storageManager.saveItem(VAULT_ACCOUNTS_KEY, records);

    return metadata;
  }

  async listAccountMetadata(): Promise<AccountMetadata[]> {
    const records = await this.loadAccountRecords();

    return Object.values(records)
      .map((record) => record.metadata)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async loadAccount(accountId: string): Promise<StoredAccount | null> {
    const records = await this.loadAccountRecords();
    const record = records[accountId];

    if (!record) {
      return null;
    }

    this.storageManager.touch();

    return {
      metadata: record.metadata,
      secret: record.secret,
    };
  }

  async clearData(): Promise<void> {
    await this.storageManager.reset([VAULT_ACCOUNTS_KEY]);
  }

  private async loadAccountRecords(): Promise<Record<string, PersistedAccountRecord>> {
    return (
      (await this.storageManager.getItem<Record<string, PersistedAccountRecord>>(
        VAULT_ACCOUNTS_KEY
      )) ?? {}
    );
  }
}
