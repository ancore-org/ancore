/**
 * Tests for backup export/import with versioning and compatibility checks
 */

import { 
  exportBackup, 
  importBackup, 
  type BackupPayload, 
  CURRENT_BACKUP_VERSION,
  SUPPORTED_BACKUP_VERSIONS,
  type BackupValidationError
} from '../backup';
import type { StorageAdapter, AccountData, SessionKeysData } from '../types';

class MockStorageAdapter implements StorageAdapter {
  private store = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  inspect(): Map<string, any> {
    return new Map(this.store);
  }
}

describe('backup', () => {
  describe('exportBackup', () => {
    it('should export empty backup when storage is empty', async () => {
      const storage = new MockStorageAdapter();
      const password = 'password';

      const backup = await exportBackup(storage, password);

      expect(backup.version).toBe(1);
      expect(backup.account).toBeUndefined();
      expect(backup.sessionKeys).toBeUndefined();
    });

    it('should export account data when present', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = {
        privateKey: 'SBXYZ...',
        publicKey: 'GABC...',
      };
      await storage.set('account', accountData);

      const backup = await exportBackup(storage, 'password');

      expect(backup.version).toBe(1);
      expect(backup.account).toBeDefined();
      expect(backup.account?.salt).toBeDefined();
      expect(backup.account?.iv).toBeDefined();
      expect(backup.account?.ciphertext).toBeDefined();
    });

    it('should export session keys when present', async () => {
      const storage = new MockStorageAdapter();
      const sessionKeysData: SessionKeysData = {
        keys: {
          'GABC...': 'session-key-1',
          'GDEF...': 'session-key-2',
        },
      };
      await storage.set('sessionKeys', sessionKeysData);

      const backup = await exportBackup(storage, 'password');

      expect(backup.version).toBe(1);
      expect(backup.sessionKeys).toBeDefined();
      expect(backup.sessionKeys?.salt).toBeDefined();
      expect(backup.sessionKeys?.iv).toBeDefined();
      expect(backup.sessionKeys?.ciphertext).toBeDefined();
    });

    it('should export both account and session keys', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };
      const sessionKeysData: SessionKeysData = { keys: { 'GABC...': 'key1' } };

      await storage.set('account', accountData);
      await storage.set('sessionKeys', sessionKeysData);

      const backup = await exportBackup(storage, 'password');

      expect(backup.version).toBe(1);
      expect(backup.account).toBeDefined();
      expect(backup.sessionKeys).toBeDefined();
    });

    it('should throw if password is empty', async () => {
      const storage = new MockStorageAdapter();

      await expect(exportBackup(storage, '')).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw if password is not a string', async () => {
      const storage = new MockStorageAdapter();

      // @ts-ignore
      await expect(exportBackup(storage, 123)).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });
  });

  describe('importBackup', () => {
    it('should import empty backup without error', async () => {
      const storage = new MockStorageAdapter();
      const backup: BackupPayload = { version: 1 };

      await expect(importBackup(backup, storage, 'password')).resolves.not.toThrow();
    });

    it('should restore account data from backup', async () => {
      const storage = new MockStorageAdapter();
      const originalData: AccountData = {
        privateKey: 'SBXYZ...',
        publicKey: 'GABC...',
      };

      // Export
      await storage.set('account', originalData);
      const backup = await exportBackup(storage, 'password');

      // Clear storage
      await storage.remove('account');
      expect(await storage.get('account')).toBeNull();

      // Import
      await importBackup(backup, storage, 'password');
      const restored = await storage.get('account');

      expect(restored).toEqual(originalData);
    });

    it('should restore session keys from backup', async () => {
      const storage = new MockStorageAdapter();
      const originalData: SessionKeysData = {
        keys: {
          'GABC...': 'session-key-1',
          'GDEF...': 'session-key-2',
        },
      };

      // Export
      await storage.set('sessionKeys', originalData);
      const backup = await exportBackup(storage, 'password');

      // Clear storage
      await storage.remove('sessionKeys');
      expect(await storage.get('sessionKeys')).toBeNull();

      // Import
      await importBackup(backup, storage, 'password');
      const restored = await storage.get('sessionKeys');

      expect(restored).toEqual(originalData);
    });

    it('should restore both account and session keys', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };
      const sessionKeysData: SessionKeysData = { keys: { 'GABC...': 'key1' } };

      // Export
      await storage.set('account', accountData);
      await storage.set('sessionKeys', sessionKeysData);
      const backup = await exportBackup(storage, 'password');

      // Clear storage
      await storage.remove('account');
      await storage.remove('sessionKeys');

      // Import
      await importBackup(backup, storage, 'password');

      expect(await storage.get('account')).toEqual(accountData);
      expect(await storage.get('sessionKeys')).toEqual(sessionKeysData);
    });

    it('should fail with wrong password', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };

      // Export with one password
      await storage.set('account', accountData);
      const backup = await exportBackup(storage, 'correct-password');

      // Try to import with wrong password
      const newStorage = new MockStorageAdapter();
      await expect(importBackup(backup, newStorage, 'wrong-password')).rejects.toThrow(
        'Failed to restore account data'
      );
    });

    it('should fail with corrupted backup', async () => {
      const storage = new MockStorageAdapter();
      const backup: BackupPayload = {
        version: 1,
        account: {
          salt: 'invalid',
          iv: 'invalid',
          ciphertext: 'invalid',
        },
      };

      await expect(importBackup(backup, storage, 'password')).rejects.toThrow(
        'Failed to restore account data'
      );
    });

    it('should fail with unsupported backup version', async () => {
      const storage = new MockStorageAdapter();
      const backup: BackupPayload = {
        version: 999,
      };

      await expect(importBackup(backup, storage, 'password')).rejects.toThrow(
        'Unsupported backup version'
      );
    });

    it('should fail with invalid backup payload', async () => {
      const storage = new MockStorageAdapter();

      // @ts-ignore
      await expect(importBackup(null, storage, 'password')).rejects.toThrow(
        'Invalid backup payload'
      );
    });

    it('should throw if password is empty', async () => {
      const storage = new MockStorageAdapter();
      const backup: BackupPayload = { version: 1 };

      await expect(importBackup(backup, storage, '')).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw if password is not a string', async () => {
      const storage = new MockStorageAdapter();
      const backup: BackupPayload = { version: 1 };

      // @ts-ignore
      await expect(importBackup(backup, storage, 123)).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });
  });

  describe('round-trip export/import', () => {
    it('should preserve complex account data through export/import cycle', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = {
        privateKey: 'SBXYZ...',
        publicKey: 'GABC...',
        metadata: {
          name: 'My Account',
          created: 1234567890,
          tags: ['important', 'primary'],
        },
      };

      // Export
      await storage.set('account', accountData);
      const backup = await exportBackup(storage, 'my-password');

      // Import to new storage
      const newStorage = new MockStorageAdapter();
      await importBackup(backup, newStorage, 'my-password');

      const restored = await newStorage.get('account');
      expect(restored).toEqual(accountData);
    });

    it('should preserve complex session keys through export/import cycle', async () => {
      const storage = new MockStorageAdapter();
      const sessionKeysData: SessionKeysData = {
        keys: {
          'GABC...': 'key1',
          'GDEF...': 'key2',
        },
        metadata: {
          lastUpdated: 1234567890,
          version: 2,
        },
      };

      // Export
      await storage.set('sessionKeys', sessionKeysData);
      const backup = await exportBackup(storage, 'my-password');

      // Import to new storage
      const newStorage = new MockStorageAdapter();
      await importBackup(backup, newStorage, 'my-password');

      const restored = await newStorage.get('sessionKeys');
      expect(restored).toEqual(sessionKeysData);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Issue #273 — Secure storage backup/restore compatibility hardening tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('backup versioning and compatibility', () => {
    it('should export backup with current version and metadata', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };
      await storage.set('account', accountData);

      const backup = await exportBackup(storage, 'password', 'test-client');

      expect(backup.version).toBe(CURRENT_BACKUP_VERSION);
      expect(backup.metadata).toBeDefined();
      expect(backup.metadata.version).toBe(CURRENT_BACKUP_VERSION);
      expect(backup.metadata.createdAt).toBeDefined();
      expect(backup.metadata.createdBy).toBe('test-client');
      expect(backup.metadata.checksum).toBeDefined();
      expect(typeof backup.metadata.checksum).toBe('string');
      expect(backup.metadata.checksum.length).toBe(64); // SHA-256 hex string
    });

    it('should validate backup structure on import', async () => {
      const storage = new MockStorageAdapter();

      // Test missing metadata
      const invalidBackup1 = { version: 1, account: undefined } as any;
      await expect(importBackup(invalidBackup1, storage, 'password')).rejects.toThrow(
        'Invalid backup payload: missing metadata'
      );

      // Test invalid version
      const invalidBackup2 = {
        version: 1,
        metadata: { version: 0, createdAt: new Date().toISOString(), checksum: 'abc' },
      } as any;
      await expect(importBackup(invalidBackup2, storage, 'password')).rejects.toThrow(
        'Invalid backup version: 0'
      );

      // Test unsupported version
      const invalidBackup3 = {
        version: 1,
        metadata: { version: 999, createdAt: new Date().toISOString(), checksum: 'abc' },
      } as any;
      await expect(importBackup(invalidBackup3, storage, 'password')).rejects.toThrow(
        'Unsupported backup version: 999'
      );
    });

    it('should verify backup integrity with checksum', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };
      await storage.set('account', accountData);

      const backup = await exportBackup(storage, 'password');

      // Test with tampered checksum
      const tamperedBackup = {
        ...backup,
        metadata: {
          ...backup.metadata,
          checksum: 'tampered_checksum_value',
        },
      };

      await expect(importBackup(tamperedBackup, storage, 'password')).rejects.toThrow(
        'Backup integrity check failed: checksum mismatch'
      );
    });

    it('should reject malformed backups with actionable errors', async () => {
      const storage = new MockStorageAdapter();

      // Test null backup
      await expect(importBackup(null as any, storage, 'password')).rejects.toThrow(
        'Invalid backup payload: must be an object'
      );

      // Test missing checksum
      const backupWithoutChecksum = {
        version: 1,
        metadata: {
          version: 1,
          createdAt: new Date().toISOString(),
        },
      } as any;
      await expect(importBackup(backupWithoutChecksum, storage, 'password')).rejects.toThrow(
        'Missing or invalid checksum in backup metadata'
      );
    });

    it('should validate account data structure on import', async () => {
      const storage = new MockStorageAdapter();
      
      // Create backup with invalid account data structure
      const invalidAccountBackup = {
        version: 1,
        metadata: {
          version: 1,
          createdAt: new Date().toISOString(),
          checksum: await (async () => {
            const crypto = (globalThis as any).crypto;
            const data = JSON.stringify({ version: 1, account: { invalid: 'data' } });
            const encoder = new (globalThis as any).TextEncoder();
            const buffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = new Uint8Array(hashBuffer);
            return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
          })(),
        },
        account: {
          salt: 'dGVzdHNhbHQ=', // base64 'testsalt'
          iv: 'dGVzdGl2', // base64 'testiv'
          ciphertext: 'dGVzdA==', // base64 'test'
        },
      };

      await expect(importBackup(invalidAccountBackup, storage, 'password')).rejects.toThrow(
        'Invalid account data: missing or invalid privateKey'
      );
    });

    it('should validate session keys data structure on import', async () => {
      const storage = new MockStorageAdapter();
      
      // Create backup with invalid session keys data structure
      const invalidSessionKeysBackup = {
        version: 1,
        metadata: {
          version: 1,
          createdAt: new Date().toISOString(),
          checksum: await (async () => {
            const crypto = (globalThis as any).crypto;
            const data = JSON.stringify({ version: 1, sessionKeys: { invalid: 'data' } });
            const encoder = new (globalThis as any).TextEncoder();
            const buffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = new Uint8Array(hashBuffer);
            return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
          })(),
        },
        sessionKeys: {
          salt: 'dGVzdHNhbHQ=', // base64 'testsalt'
          iv: 'dGVzdGl2', // base64 'testiv'
          ciphertext: 'dGVzdA==', // base64 'test'
        },
      };

      await expect(importBackup(invalidSessionKeysBackup, storage, 'password')).rejects.toThrow(
        'Invalid session keys data: missing or invalid keys object'
      );
    });
  });

  describe('backup error handling', () => {
    it('should provide typed actionable errors for different failure modes', async () => {
      const storage = new MockStorageAdapter();

      // Test malformed backup error
      try {
        await importBackup(null as any, storage, 'password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as BackupValidationError).code).toBe('MALFORMED_BACKUP');
        expect((error as BackupValidationError).name).toBe('BackupValidationError');
      }

      // Test invalid version error
      try {
        await importBackup({
          version: 1,
          metadata: { version: 999, createdAt: new Date().toISOString(), checksum: 'abc' },
        } as any, storage, 'password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as BackupValidationError).code).toBe('INVALID_VERSION');
      }

      // Test encryption error
      const backup = await exportBackup(storage, 'password');
      try {
        await importBackup(backup, storage, 'wrong-password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as BackupValidationError).code).toBe('ENCRYPTION_ERROR');
      }
    });

    it('should include error details in validation errors', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };
      await storage.set('account', accountData);

      const backup = await exportBackup(storage, 'password');

      try {
        await importBackup(backup, storage, 'wrong-password');
      } catch (error) {
        const validationError = error as BackupValidationError;
        expect(validationError.code).toBe('ENCRYPTION_ERROR');
        expect(validationError.details).toBeDefined();
        expect(typeof validationError.details).toBe('object');
      }
    });
  });

  describe('backup compatibility across versions', () => {
    it('should handle current version without migration', async () => {
      const storage = new MockStorageAdapter();
      const accountData: AccountData = { privateKey: 'SBXYZ...' };
      await storage.set('account', accountData);

      const backup = await exportBackup(storage, 'password');
      const result = await importBackup(backup, storage, 'password');

      // Should not return migration result for same version
      expect(result).toBeUndefined();
    });

    it('should support all declared backup versions', () => {
      expect(SUPPORTED_BACKUP_VERSIONS).toContain(CURRENT_BACKUP_VERSION);
      expect(SUPPORTED_BACKUP_VERSIONS.length).toBeGreaterThan(0);
      expect(SUPPORTED_BACKUP_VERSIONS.every(v => typeof v === 'number' && v > 0)).toBe(true);
    });

    it('should provide clear error messages for unsupported versions', async () => {
      const storage = new MockStorageAdapter();
      const unsupportedBackup = {
        version: 1,
        metadata: {
          version: 999,
          createdAt: new Date().toISOString(),
          checksum: 'abc123',
        },
      } as any;

      try {
        await importBackup(unsupportedBackup, storage, 'password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).message).toContain('Unsupported backup version: 999');
        expect((error as any).message).toContain('Supported versions:');
      }
    });
  });

  describe('backup security and integrity', () => {
    it('should generate different checksums for different data', async () => {
      const storage1 = new MockStorageAdapter();
      const storage2 = new MockStorageAdapter();

      await storage1.set('account', { privateKey: 'key1' });
      await storage2.set('account', { privateKey: 'key2' });

      const backup1 = await exportBackup(storage1, 'password');
      const backup2 = await exportBackup(storage2, 'password');

      expect(backup1.metadata.checksum).not.toBe(backup2.metadata.checksum);
    });

    it('should generate same checksum for identical data', async () => {
      const storage1 = new MockStorageAdapter();
      const storage2 = new MockStorageAdapter();
      const accountData = { privateKey: 'same-key' };

      await storage1.set('account', accountData);
      await storage2.set('account', accountData);

      const backup1 = await exportBackup(storage1, 'password');
      const backup2 = await exportBackup(storage2, 'password');

      expect(backup1.metadata.checksum).toBe(backup2.metadata.checksum);
    });

    it('should include creation timestamp in metadata', async () => {
      const storage = new MockStorageAdapter();
      const beforeExport = new Date().toISOString();

      const backup = await exportBackup(storage, 'password');
      
      const afterExport = new Date().toISOString();
      expect(backup.metadata.createdAt).toBeDefined();
      expect(backup.metadata.createdAt >= beforeExport).toBe(true);
      expect(backup.metadata.createdAt <= afterExport).toBe(true);
    });

    it('should handle optional createdBy field', async () => {
      const storage = new MockStorageAdapter();

      const backupWithoutCreator = await exportBackup(storage, 'password');
      expect(backupWithoutCreator.metadata.createdBy).toBeUndefined();

      const backupWithCreator = await exportBackup(storage, 'password', 'test-app');
      expect(backupWithCreator.metadata.createdBy).toBe('test-app');
    });
  });
});
