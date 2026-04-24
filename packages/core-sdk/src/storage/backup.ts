/**
 * Secure backup export/import for @ancore/core-sdk
 * Handles encrypted backup creation and restoration with versioning and migration support
 */

import { encrypt, decrypt, type EncryptedPayload } from './encryption-primitives';
import type { AccountData, SessionKeysData, StorageAdapter } from './types';

// Current backup schema version
export const CURRENT_BACKUP_VERSION = 1;

// Supported backup versions for migration
export const SUPPORTED_BACKUP_VERSIONS = [1];

export interface BackupMetadata {
  version: number;
  createdAt: string; // ISO 8601 timestamp
  createdBy?: string; // Optional identifier for what created the backup
  checksum: string; // SHA-256 hash of the backup payload for integrity verification
}

export interface BackupPayloadV1 {
  version: 1;
  metadata: BackupMetadata;
  account?: EncryptedPayload;
  sessionKeys?: EncryptedPayload;
}

export type BackupPayload = BackupPayloadV1;

export interface BackupValidationError extends Error {
  code: 'INVALID_VERSION' | 'MALFORMED_BACKUP' | 'CHECKSUM_MISMATCH' | 'ENCRYPTION_ERROR' | 'MIGRATION_ERROR';
  details?: unknown;
}

export interface MigrationResult {
  success: boolean;
  migratedFrom: number;
  migratedTo: number;
  warnings?: string[];
}

/**
 * Export an encrypted backup of account and session key data
 *
 * @param storage - The storage adapter to read from
 * @param password - The password to encrypt the backup with
 * @param createdBy - Optional identifier for what created the backup
 * @returns A backup payload with encrypted account and session key data
 */
export async function exportBackup(
  storage: StorageAdapter,
  password: string,
  createdBy?: string
): Promise<BackupPayload> {
  if (typeof password !== 'string' || password.length === 0) {
    throw createBackupError('MALFORMED_BACKUP', 'Password must be a non-empty string');
  }

  const accountData = await storage.get('account');
  const sessionKeysData = await storage.get('sessionKeys');

  const backupData: Omit<BackupPayloadV1, 'metadata'> = {
    version: CURRENT_BACKUP_VERSION,
  };

  // Encrypt account data if it exists
  if (accountData) {
    const accountJson = JSON.stringify(accountData);
    backupData.account = await encrypt(accountJson, password);
  }

  // Encrypt session keys if they exist
  if (sessionKeysData) {
    const sessionKeysJson = JSON.stringify(sessionKeysData);
    backupData.sessionKeys = await encrypt(sessionKeysJson, password);
  }

  // Create metadata with checksum
  const metadata: BackupMetadata = {
    version: CURRENT_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    createdBy,
    checksum: await calculateChecksum(backupData),
  };

  return {
    ...backupData,
    metadata,
  };
}

/**
 * Import an encrypted backup and restore account and session key data
 *
 * @param backup - The backup payload to import
 * @param storage - The storage adapter to write to
 * @param password - The password to decrypt the backup with
 * @returns Migration result if backup was migrated from an older version
 * @throws BackupValidationError if the backup is invalid, corrupted, or password is incorrect
 */
export async function importBackup(
  backup: BackupPayload,
  storage: StorageAdapter,
  password: string
): Promise<MigrationResult | void> {
  if (typeof password !== 'string' || password.length === 0) {
    throw createBackupError('MALFORMED_BACKUP', 'Password must be a non-empty string');
  }

  // Validate backup structure
  validateBackupStructure(backup);

  // Verify checksum for integrity
  await verifyBackupIntegrity(backup);

  // Handle version migration if needed
  let migrationResult: MigrationResult | undefined;
  if (backup.version !== CURRENT_BACKUP_VERSION) {
    migrationResult = await migrateBackup(backup, password);
    backup = migrationResult.success ? 
      await migrateToCurrentVersion(backup, password) : 
      backup;
  }

  // Restore account data if present
  if (backup.account) {
    try {
      const accountJson = await decrypt(backup.account, password);
      const accountData: AccountData = JSON.parse(accountJson);
      validateAccountData(accountData);
      await storage.set('account', accountData);
    } catch (error) {
      throw createBackupError('ENCRYPTION_ERROR', 
        `Failed to restore account data: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  // Restore session keys if present
  if (backup.sessionKeys) {
    try {
      const sessionKeysJson = await decrypt(backup.sessionKeys, password);
      const sessionKeysData: SessionKeysData = JSON.parse(sessionKeysJson);
      validateSessionKeysData(sessionKeysData);
      await storage.set('sessionKeys', sessionKeysData);
    } catch (error) {
      throw createBackupError('ENCRYPTION_ERROR',
        `Failed to restore session keys: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  return migrationResult;
}

/**
 * Validate backup structure and version compatibility
 */
function validateBackupStructure(backup: BackupPayload): void {
  if (!backup || typeof backup !== 'object') {
    throw createBackupError('MALFORMED_BACKUP', 'Invalid backup payload: must be an object');
  }

  if (!backup.metadata || typeof backup.metadata !== 'object') {
    throw createBackupError('MALFORMED_BACKUP', 'Invalid backup payload: missing metadata');
  }

  const { version } = backup.metadata;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw createBackupError('INVALID_VERSION', `Invalid backup version: ${version}`);
  }

  if (!SUPPORTED_BACKUP_VERSIONS.includes(version)) {
    throw createBackupError('INVALID_VERSION', 
      `Unsupported backup version: ${version}. Supported versions: ${SUPPORTED_BACKUP_VERSIONS.join(', ')}`
    );
  }
}

/**
 * Verify backup integrity using checksum
 */
async function verifyBackupIntegrity(backup: BackupPayload): Promise<void> {
  const { checksum } = backup.metadata;
  
  if (typeof checksum !== 'string' || checksum.length === 0) {
    throw createBackupError('MALFORMED_BACKUP', 'Missing or invalid checksum in backup metadata');
  }

  // Calculate checksum of current backup data (excluding metadata checksum itself)
  const backupDataForChecksum = {
    version: backup.version,
    account: backup.account,
    sessionKeys: backup.sessionKeys,
  };
  
  const calculatedChecksum = await calculateChecksum(backupDataForChecksum);
  
  if (checksum !== calculatedChecksum) {
    throw createBackupError('CHECKSUM_MISMATCH', 
      'Backup integrity check failed: checksum mismatch. Backup may be corrupted or tampered with.'
    );
  }
}

/**
 * Calculate SHA-256 checksum of backup data
 */
async function calculateChecksum(data: unknown): Promise<string> {
  const crypto = (globalThis as any).crypto;
  if (!crypto?.subtle) {
    throw new Error('WebCrypto API is not available in this environment');
  }

  const dataString = JSON.stringify(data, Object.keys(data as any).sort());
  const encoder = new (globalThis as any).TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Migrate backup from older version to current version
 */
async function migrateBackup(backup: BackupPayload, _password: string): Promise<MigrationResult> {
  const fromVersion = backup.version;
  const toVersion = CURRENT_BACKUP_VERSION;
  const warnings: string[] = [];

  try {
    // For now, version 1 is current, so no migration needed
    // This function is prepared for future migrations
    if (fromVersion === toVersion) {
      return {
        success: true,
        migratedFrom: fromVersion,
        migratedTo: toVersion,
      };
    }

    // Future migration logic will go here
    // Example: if (fromVersion === 1 && toVersion === 2) { ... }

    return {
      success: true,
      migratedFrom: fromVersion,
      migratedTo: toVersion,
      warnings,
    };
  } catch (error) {
    throw createBackupError('MIGRATION_ERROR',
      `Failed to migrate backup from version ${fromVersion} to ${toVersion}: ${error instanceof Error ? error.message : String(error)}`,
      { error }
    );
  }
}

/**
 * Create a migrated backup payload in current version format
 */
async function migrateToCurrentVersion(oldBackup: BackupPayload, _password: string): Promise<BackupPayload> {
  // For now, since we only have version 1, just return the backup
  // This function is prepared for future version migrations
  return oldBackup;
}

/**
 * Validate account data structure
 */
function validateAccountData(data: AccountData): void {
  if (!data || typeof data !== 'object') {
    throw createBackupError('MALFORMED_BACKUP', 'Invalid account data: must be an object');
  }

  if (typeof data.privateKey !== 'string' || data.privateKey.length === 0) {
    throw createBackupError('MALFORMED_BACKUP', 'Invalid account data: missing or invalid privateKey');
  }
}

/**
 * Validate session keys data structure
 */
function validateSessionKeysData(data: SessionKeysData): void {
  if (!data || typeof data !== 'object') {
    throw createBackupError('MALFORMED_BACKUP', 'Invalid session keys data: must be an object');
  }

  if (!data.keys || typeof data.keys !== 'object') {
    throw createBackupError('MALFORMED_BACKUP', 'Invalid session keys data: missing or invalid keys object');
  }
}

/**
 * Create a standardized backup validation error
 */
function createBackupError(
  code: BackupValidationError['code'],
  message: string,
  details?: unknown
): BackupValidationError {
  const error = new Error(message) as BackupValidationError;
  error.name = 'BackupValidationError';
  error.code = code;
  error.details = details;
  return error;
}
