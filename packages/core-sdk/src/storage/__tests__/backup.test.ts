/**
 * Tests for backup export/import
 */

import { exportBackup, importBackup, type BackupPayload } from '../backup';
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
});
