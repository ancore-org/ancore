/**
 * Secure backup export/import for @ancore/core-sdk
 * Handles encrypted backup creation and restoration
 */

import { encrypt, decrypt, type EncryptedPayload } from './encryption-primitives';
import type { AccountData, SessionKeysData, StorageAdapter } from './types';

const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  account?: EncryptedPayload;
  sessionKeys?: EncryptedPayload;
}

/**
 * Export an encrypted backup of account and session key data
 *
 * @param storage - The storage adapter to read from
 * @param password - The password to encrypt the backup with
 * @returns A backup payload with encrypted account and session key data
 */
export async function exportBackup(
  storage: StorageAdapter,
  password: string
): Promise<BackupPayload> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  const accountData = await storage.get('account');
  const sessionKeysData = await storage.get('sessionKeys');

  const backup: BackupPayload = {
    version: BACKUP_VERSION,
  };

  // Encrypt account data if it exists
  if (accountData) {
    const accountJson = JSON.stringify(accountData);
    backup.account = await encrypt(accountJson, password);
  }

  // Encrypt session keys if they exist
  if (sessionKeysData) {
    const sessionKeysJson = JSON.stringify(sessionKeysData);
    backup.sessionKeys = await encrypt(sessionKeysJson, password);
  }

  return backup;
}

/**
 * Import an encrypted backup and restore account and session key data
 *
 * @param backup - The backup payload to import
 * @param storage - The storage adapter to write to
 * @param password - The password to decrypt the backup with
 * @throws Error if the password is incorrect or the backup is corrupted
 */
export async function importBackup(
  backup: BackupPayload,
  storage: StorageAdapter,
  password: string
): Promise<void> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup payload');
  }

  if (backup.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${backup.version}`);
  }

  // Restore account data if present
  if (backup.account) {
    try {
      const accountJson = await decrypt(backup.account, password);
      const accountData: AccountData = JSON.parse(accountJson);
      await storage.set('account', accountData);
    } catch (error) {
      throw new Error(
        `Failed to restore account data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Restore session keys if present
  if (backup.sessionKeys) {
    try {
      const sessionKeysJson = await decrypt(backup.sessionKeys, password);
      const sessionKeysData: SessionKeysData = JSON.parse(sessionKeysJson);
      await storage.set('sessionKeys', sessionKeysData);
    } catch (error) {
      throw new Error(
        `Failed to restore session keys: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
