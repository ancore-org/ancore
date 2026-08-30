/**
 * Platform-neutral account persistence layer for vault management.
 * Works with SecureStorageManager and any storage adapter (Keychain, Chrome, etc).
 */

import { SecureStorageManager } from './secure-storage-manager';

export interface AccountMetadata {
  /** Unique account identifier */
  id: string;
  /** Account public address (G-address for smart accounts, C-address for contract accounts) */
  address: string;
  /** Optional account label for UI display */
  label?: string;
  /** ISO timestamp of account creation */
  createdAt: string;
  /** ISO timestamp of last account update */
  updatedAt: string;
}

export interface AccountSecretPayload {
  /** Encrypted key material (mnemonic or secret key) */
  keyMaterial: string;
  /** Additional serialized account data (e.g., derivation path metadata) */
  accountPayload: Record<string, unknown>;
}

export interface PersistedAccountRecord {
  metadata: AccountMetadata;
  secret: AccountSecretPayload;
}

export interface PersistAccountInput {
  /** Unique account identifier */
  id: string;
  /** Account public address */
  address: string;
  /** Optional account label */
  label?: string;
  /** Encrypted key material */
  keyMaterial: string;
  /** Additional account data */
  accountPayload: Record<string, unknown>;
}

export interface StoredAccount {
  metadata: AccountMetadata;
  secret: AccountSecretPayload;
}

export interface AccountPersistenceOptions {
  /** Storage key prefix for accounts (default: 'vault_accounts') */
  storageKey?: string;
  /** Timestamp function for testing (default: Date.now) */
  now?: () => number;
}

const DEFAULT_ACCOUNTS_STORAGE_KEY = 'vault_accounts';

/**
 * Account persistence manager for unified vault across platforms.
 * Provides platform-neutral APIs for account CRUD operations.
 * Accounts are stored encrypted within the SecureStorageManager.
 *
 * Usage:
 * ```typescript
 * import { SecureStorageManager } from '@ancore/core-sdk';
 * import { createAccountPersistence } from '@ancore/core-sdk/storage';
 * import { createSecureStoreAdapter } from '@ancore/mobile-wallet';
 *
 * const storage = new SecureStorageManager(createSecureStoreAdapter());
 * const accounts = createAccountPersistence(storage);
 *
 * await accounts.persistAccount({
 *   id: 'account-1',
 *   address: 'GXYZ...',
 *   keyMaterial: encryptedMnemonic,
 *   accountPayload: {}
 * });
 * ```
 */
export class AccountPersistence {
  private readonly storageManager: SecureStorageManager;
  private readonly storageKey: string;
  private readonly now: () => number;

  constructor(storageManager: SecureStorageManager, options: AccountPersistenceOptions = {}) {
    this.storageManager = storageManager;
    this.storageKey = options.storageKey ?? DEFAULT_ACCOUNTS_STORAGE_KEY;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Persist or update an account in the vault.
   * If the account already exists, updates metadata and secret while preserving createdAt.
   * If new, generates createdAt timestamp.
   */
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

    await this.storageManager.saveItem(this.storageKey, records);

    return metadata;
  }

  /**
   * List all account metadata in creation order.
   * Does not return secret key material.
   */
  async listAccountMetadata(): Promise<AccountMetadata[]> {
    const records = await this.loadAccountRecords();

    return Object.values(records)
      .map((record) => record.metadata)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  /**
   * Load a specific account by ID, including secret key material.
   * Calls touch() to reset auto-lock timer if configured.
   */
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

  /**
   * Delete a specific account by ID.
   */
  async deleteAccount(accountId: string): Promise<void> {
    const records = await this.loadAccountRecords();
    delete records[accountId];
    await this.storageManager.saveItem(this.storageKey, records);
  }

  /**
   * Clear all account data (calls reset with this storage key).
   */
  async clearAllAccounts(): Promise<void> {
    await this.storageManager.reset([this.storageKey]);
  }

  /**
   * Get a specific account count.
   */
  async getAccountCount(): Promise<number> {
    const records = await this.loadAccountRecords();
    return Object.keys(records).length;
  }

  private async loadAccountRecords(): Promise<Record<string, PersistedAccountRecord>> {
    return (
      (await this.storageManager.getItem<Record<string, PersistedAccountRecord>>(
        this.storageKey
      )) ?? {}
    );
  }
}

/**
 * Factory function to create an AccountPersistence instance.
 * @param storageManager - SecureStorageManager instance
 * @param options - Optional configuration
 */
export function createAccountPersistence(
  storageManager: SecureStorageManager,
  options?: AccountPersistenceOptions
): AccountPersistence {
  return new AccountPersistence(storageManager, options);
}
