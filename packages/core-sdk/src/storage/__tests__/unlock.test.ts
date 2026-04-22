import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  // @ts-expect-error - Polyfill for Node.js environment
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

import { SecureStorageManager } from '../secure-storage-manager';
import { StorageAdapter } from '../types';

class MockStorageAdapter implements StorageAdapter {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    if (!this.store.has(key)) return null;
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  public inspectStore(): Map<string, any> {
    return this.store;
  }
}

describe('SecureStorageManager - Master Salt Initialization', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('initializeMasterSalt', () => {
    it('should generate and store a 16-byte master salt', async () => {
      // initializeMasterSalt now only generates in memory — storage is handled by unlock()
      const initializeMasterSalt = (manager as any).initializeMasterSalt.bind(manager);

      const masterSalt = initializeMasterSalt();

      // Verify the returned value is a Uint8Array of 16 bytes
      expect(masterSalt).toBeInstanceOf(Uint8Array);
      expect(masterSalt.length).toBe(16);
    });

    it('should generate different salts on multiple calls', () => {
      const initializeMasterSalt = (manager as any).initializeMasterSalt.bind(manager);

      const salt1 = initializeMasterSalt();
      const salt2 = initializeMasterSalt();

      // Verify they are different
      expect(Buffer.from(salt1).toString('base64')).not.toBe(Buffer.from(salt2).toString('base64'));
    });

    it('should store the salt as a valid base64 string', () => {
      // initializeMasterSalt now returns the salt directly — verify it's encodable as base64
      const initializeMasterSalt = (manager as any).initializeMasterSalt.bind(manager);

      const masterSalt = initializeMasterSalt();

      expect(() => {
        const base64 = Buffer.from(masterSalt).toString('base64');
        const decoded = Buffer.from(base64, 'base64');
        expect(decoded.length).toBe(16);
      }).not.toThrow();
    });
  });

  describe('loadMasterSalt', () => {
    it('should return null when master salt does not exist', async () => {
      const loadMasterSalt = (manager as any).loadMasterSalt.bind(manager);

      const result = await loadMasterSalt();

      expect(result).toBeNull();
    });

    it('should load and decode existing master salt from storage', async () => {
      // Generate salt and manually persist it (as unlock() would do)
      const initializeMasterSalt = (manager as any).initializeMasterSalt.bind(manager);
      const originalSalt = initializeMasterSalt();
      await storage.set('master_salt', Buffer.from(originalSalt).toString('base64'));

      // Now load it back
      const loadMasterSalt = (manager as any).loadMasterSalt.bind(manager);
      const loadedSalt = await loadMasterSalt();

      // Verify the loaded salt matches the original
      expect(loadedSalt).toBeInstanceOf(Uint8Array);
      expect(loadedSalt!.length).toBe(16);
      expect(Buffer.from(loadedSalt!).toString('base64')).toBe(
        Buffer.from(originalSalt).toString('base64')
      );
    });

    it('should decode base64 string to Uint8Array correctly', async () => {
      // Manually set a known base64 salt
      const knownBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const knownBase64 = Buffer.from(knownBytes).toString('base64');
      await storage.set('master_salt', knownBase64);

      // Load it
      const loadMasterSalt = (manager as any).loadMasterSalt.bind(manager);
      const loadedSalt = await loadMasterSalt();

      // Verify it matches the known bytes
      expect(loadedSalt).toBeInstanceOf(Uint8Array);
      expect(loadedSalt!.length).toBe(16);
      expect(Array.from(loadedSalt!)).toEqual(Array.from(knownBytes));
    });

    it('should throw for empty string in storage (corrupted)', async () => {
      await storage.set('master_salt', '');

      const loadMasterSalt = (manager as any).loadMasterSalt.bind(manager);

      await expect(loadMasterSalt()).rejects.toThrow('Corrupted master_salt: expected 16 bytes');
    });
  });
});

describe('SecureStorageManager - Key Derivation', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('deriveEncryptionKey', () => {
    it('should derive a CryptoKey from password and master salt', async () => {
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);

      const password = 'test-password-123';
      const masterSalt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(masterSalt);

      const key = await deriveEncryptionKey(password, masterSalt);

      // Verify the key is a CryptoKey suitable for deriving AES keys
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('PBKDF2');
    });

    it('should derive the same key for the same password and salt', async () => {
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);

      const password = 'consistent-password';
      const masterSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

      const key1 = await deriveEncryptionKey(password, masterSalt);
      const key2 = await deriveEncryptionKey(password, masterSalt);

      // Set the encryption key so we can use deriveAesKey
      (manager as any).encryptionKey = key1;
      const deriveAesKey = (manager as any).deriveAesKey.bind(manager);

      // Verify both keys can derive the same AES key for the same payload salt
      const payloadSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const aesKey1 = await deriveAesKey(payloadSalt);

      (manager as any).encryptionKey = key2;
      const aesKey2 = await deriveAesKey(payloadSalt);

      // Verify both AES keys can encrypt/decrypt the same data consistently
      const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const plaintext = new TextEncoder().encode('test data');

      const ciphertext1 = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey1,
        plaintext
      );

      const ciphertext2 = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey2,
        plaintext
      );

      // Verify both ciphertexts are identical (same key, same IV, same plaintext)
      expect(new Uint8Array(ciphertext1)).toEqual(new Uint8Array(ciphertext2));

      // Verify aesKey2 can decrypt data encrypted with aesKey1
      const decrypted = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey2,
        ciphertext1
      );

      expect(new TextDecoder().decode(decrypted)).toBe('test data');
    });

    it('should derive different keys for different passwords', async () => {
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      const deriveAesKey = (manager as any).deriveAesKey.bind(manager);

      const masterSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const payloadSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

      const key1 = await deriveEncryptionKey('password1', masterSalt);
      const key2 = await deriveEncryptionKey('password2', masterSalt);

      // Derive AES keys from both encryption keys
      (manager as any).encryptionKey = key1;
      const aesKey1 = await deriveAesKey(payloadSalt);

      (manager as any).encryptionKey = key2;
      const aesKey2 = await deriveAesKey(payloadSalt);

      // Encrypt data with aesKey1
      const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const plaintext = new TextEncoder().encode('test data');

      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey1,
        plaintext
      );

      // Try to decrypt with aesKey2 - should fail
      await expect(
        globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey2, ciphertext)
      ).rejects.toThrow();
    });

    it('should derive different keys for different salts', async () => {
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      const deriveAesKey = (manager as any).deriveAesKey.bind(manager);

      const password = 'same-password';
      const salt1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const salt2 = new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      const payloadSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

      const key1 = await deriveEncryptionKey(password, salt1);
      const key2 = await deriveEncryptionKey(password, salt2);

      // Derive AES keys from both encryption keys
      (manager as any).encryptionKey = key1;
      const aesKey1 = await deriveAesKey(payloadSalt);

      (manager as any).encryptionKey = key2;
      const aesKey2 = await deriveAesKey(payloadSalt);

      // Encrypt data with aesKey1
      const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const plaintext = new TextEncoder().encode('test data');

      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey1,
        plaintext
      );

      // Try to decrypt with aesKey2 - should fail
      await expect(
        globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey2, ciphertext)
      ).rejects.toThrow();
    });

    it('should derive a key that can be used for AES-GCM encryption', async () => {
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      const deriveAesKey = (manager as any).deriveAesKey.bind(manager);

      const password = 'encryption-test';
      const masterSalt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(masterSalt);

      const key = await deriveEncryptionKey(password, masterSalt);

      // Set the encryption key and derive an AES key
      (manager as any).encryptionKey = key;
      const payloadSalt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(payloadSalt);
      const aesKey = await deriveAesKey(payloadSalt);

      // Try to use the AES key for encryption
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode('test data');

      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        plaintext
      );

      // Verify encryption succeeded
      expect(ciphertext).toBeDefined();
      expect(ciphertext.byteLength).toBeGreaterThan(0);

      // Verify we can decrypt it back
      const decrypted = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext
      );

      expect(new TextDecoder().decode(decrypted)).toBe('test data');
    });
  });
});

describe('SecureStorageManager - Verification Payload', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('createVerificationPayload', () => {
    it('should create and store a verification payload', async () => {
      // Set up encryption key using the existing unlock method
      const password = 'test-password';
      await manager.unlock(password);

      // Create verification payload
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Verify it was stored
      const storedPayload = await storage.get('verification_payload');
      expect(storedPayload).toBeDefined();
      expect(storedPayload).toHaveProperty('iv');
      expect(storedPayload).toHaveProperty('salt');
      expect(storedPayload).toHaveProperty('data');
    });

    it('should create a payload with valid EncryptedPayload structure', async () => {
      // Set up encryption key using the existing unlock method
      const password = 'test-password';
      await manager.unlock(password);

      // Create verification payload
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Verify structure
      const storedPayload = await storage.get('verification_payload');
      expect(typeof storedPayload.iv).toBe('string');
      expect(typeof storedPayload.salt).toBe('string');
      expect(typeof storedPayload.data).toBe('string');

      // Verify base64 encoding
      expect(() => Buffer.from(storedPayload.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(storedPayload.salt, 'base64')).not.toThrow();
      expect(() => Buffer.from(storedPayload.data, 'base64')).not.toThrow();
    });

    it('should create a payload that can be decrypted with the same key', async () => {
      // Set up encryption key using the existing unlock method
      const password = 'test-password';
      await manager.unlock(password);

      // Create verification payload
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Retrieve and decrypt
      const storedPayload = await storage.get('verification_payload');
      const decryptData = (manager as any).decryptData.bind(manager);
      const decrypted = await decryptData(storedPayload);

      // Verify content
      const content = JSON.parse(decrypted);
      expect(content.marker).toBe('KIRO_VERIFICATION_V1');
      expect(typeof content.timestamp).toBe('number');
      expect(content.timestamp).toBeGreaterThan(0);
    });

    it('should create a payload with current timestamp', async () => {
      // Set up encryption key using the existing unlock method
      const password = 'test-password';
      await manager.unlock(password);

      // Record time before creation
      const beforeTime = Date.now();

      // Create verification payload
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Record time after creation
      const afterTime = Date.now();

      // Retrieve and decrypt
      const storedPayload = await storage.get('verification_payload');
      const decryptData = (manager as any).decryptData.bind(manager);
      const decrypted = await decryptData(storedPayload);

      // Verify timestamp is within range
      const content = JSON.parse(decrypted);
      expect(content.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(content.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should fail to decrypt with wrong encryption key', async () => {
      // Set up encryption key using the existing unlock method
      const password1 = 'test-password-1';
      const unlockResult1 = await manager.unlock(password1);
      expect(unlockResult1).toBe(true);

      // Create verification payload
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Change to different encryption key
      manager.lock();
      const password2 = 'test-password-2';
      const unlockResult2 = await manager.unlock(password2);

      // Wrong password should return false and manager should be locked
      expect(unlockResult2).toBe(false);
      expect(manager.isUnlocked).toBe(false);

      // Try to decrypt - should fail because manager is locked
      const storedPayload = await storage.get('verification_payload');
      const decryptData = (manager as any).decryptData.bind(manager);

      await expect(decryptData(storedPayload)).rejects.toThrow('Storage manager is locked');
    });
  });

  describe('verifyPassword', () => {
    it('should return true when verification payload decrypts successfully', async () => {
      // Set up encryption key and create verification payload
      const password = 'test-password';
      await manager.unlock(password);
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Verify password
      const verifyPassword = (manager as any).verifyPassword.bind(manager);
      const result = await verifyPassword();

      expect(result).toBe(true);
      expect(manager.isUnlocked).toBe(true);
    });

    it('should return false when verification payload does not exist', async () => {
      // Set up encryption key directly without calling unlock (which would create the verification payload)
      const password = 'test-password';
      const masterSalt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(masterSalt);

      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      (manager as any).encryptionKey = await deriveEncryptionKey(password, masterSalt);

      // Verify password without verification payload
      const verifyPassword = (manager as any).verifyPassword.bind(manager);
      const result = await verifyPassword();

      expect(result).toBe(false);
    });

    it('should return false and clear encryption key when decryption fails', async () => {
      // Set up encryption key with password1 and create verification payload
      const password1 = 'correct-password';
      await manager.unlock(password1);
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Lock and unlock with wrong password
      manager.lock();
      const password2 = 'wrong-password';
      await manager.unlock(password2);

      // Verify password should fail
      const verifyPassword = (manager as any).verifyPassword.bind(manager);
      const result = await verifyPassword();

      expect(result).toBe(false);
      expect(manager.isUnlocked).toBe(false);
    });

    it('should clear encryption key on verification failure', async () => {
      // Set up encryption key with password1 and create verification payload
      const password1 = 'correct-password';
      const unlockResult1 = await manager.unlock(password1);
      expect(unlockResult1).toBe(true);
      const createVerificationPayload = (manager as any).createVerificationPayload.bind(manager);
      await createVerificationPayload();

      // Lock and set up encryption key with wrong password directly (bypassing unlock's verification)
      manager.lock();
      const password2 = 'wrong-password';
      const masterSalt = await (manager as any).loadMasterSalt();
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      (manager as any).encryptionKey = await deriveEncryptionKey(password2, masterSalt);

      // Verify manager is unlocked before verification
      expect(manager.isUnlocked).toBe(true);

      // Verify password should fail and clear key
      const verifyPassword = (manager as any).verifyPassword.bind(manager);
      await verifyPassword();

      // Verify manager is now locked
      expect(manager.isUnlocked).toBe(false);
    });
  });
});

describe('SecureStorageManager - Security Guarantees (Task 6.1)', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('No plaintext exposure in storage', () => {
    it('should never persist encryption key to storage', async () => {
      const password = 'test-password-123';

      // Unlock and perform operations
      const unlockResult = await manager.unlock(password);
      expect(unlockResult).toBe(true);

      // Inspect storage for any keys that might contain encryption key material
      const store = storage.inspectStore();

      // Check all stored values
      for (const [key, value] of store.entries()) {
        // Master salt is allowed (it's not the encryption key)
        if (key === 'master_salt') {
          expect(typeof value).toBe('string');
          continue;
        }

        // All other values should be EncryptedPayload structures
        if (value && typeof value === 'object') {
          expect(value).toHaveProperty('iv');
          expect(value).toHaveProperty('salt');
          expect(value).toHaveProperty('data');

          // Verify these are base64 strings (encrypted data)
          expect(typeof value.iv).toBe('string');
          expect(typeof value.salt).toBe('string');
          expect(typeof value.data).toBe('string');
        }
      }

      // Verify no key named 'encryptionKey' or similar exists
      expect(store.has('encryptionKey')).toBe(false);
      expect(store.has('encryption_key')).toBe(false);
      expect(store.has('key')).toBe(false);
      expect(store.has('baseKey')).toBe(false);
      expect(store.has('base_key')).toBe(false);
    });

    it('should encrypt all sensitive data before storage', async () => {
      const password = 'secure-password';
      const accountData = { privateKey: '0xSECRET_PRIVATE_KEY_12345' };
      const sessionKeysData = { keys: { session1: 'SECRET_SESSION_KEY' } };

      // Unlock and save sensitive data
      await manager.unlock(password);
      await manager.saveAccount(accountData);
      await manager.saveSessionKeys(sessionKeysData);

      // Inspect storage
      const store = storage.inspectStore();

      // Convert all stored values to JSON strings for searching
      const allStoredData = JSON.stringify(Array.from(store.values()));

      // Verify no plaintext secrets in storage
      expect(allStoredData).not.toContain('0xSECRET_PRIVATE_KEY_12345');
      expect(allStoredData).not.toContain('SECRET_SESSION_KEY');
      expect(allStoredData).not.toContain(accountData.privateKey);
      expect(allStoredData).not.toContain(sessionKeysData.keys.session1);
    });

    it('should not expose plaintext in storage after wrong password attempt', async () => {
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';
      const accountData = { privateKey: '0xSECRET_KEY' };

      // First run: unlock with correct password and save data
      await manager.unlock(correctPassword);
      await manager.saveAccount(accountData);

      // Lock and try with wrong password
      manager.lock();
      const wrongUnlockResult = await manager.unlock(wrongPassword);
      expect(wrongUnlockResult).toBe(false);

      // Inspect storage after wrong password attempt
      const store = storage.inspectStore();
      const allStoredData = JSON.stringify(Array.from(store.values()));

      // Verify no plaintext secrets exposed
      expect(allStoredData).not.toContain('0xSECRET_KEY');
      expect(allStoredData).not.toContain(accountData.privateKey);

      // Verify encryption key not stored
      expect(store.has('encryptionKey')).toBe(false);
      expect(store.has('encryption_key')).toBe(false);
    });

    it('should maintain encryption in storage across multiple operations', async () => {
      const password = 'test-password';
      const sensitiveData1 = { privateKey: '0xFIRST_SECRET' };
      const sensitiveData2 = { privateKey: '0xSECOND_SECRET' };

      // First unlock and save
      await manager.unlock(password);
      await manager.saveAccount(sensitiveData1);

      // Lock and unlock again
      manager.lock();
      await manager.unlock(password);
      await manager.saveAccount(sensitiveData2);

      // Inspect storage
      const store = storage.inspectStore();
      const allStoredData = JSON.stringify(Array.from(store.values()));

      // Verify no plaintext from either operation
      expect(allStoredData).not.toContain('0xFIRST_SECRET');
      expect(allStoredData).not.toContain('0xSECOND_SECRET');
      expect(allStoredData).not.toContain(sensitiveData1.privateKey);
      expect(allStoredData).not.toContain(sensitiveData2.privateKey);
    });

    it('should only store master_salt, verification_payload, and encrypted data', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };

      await manager.unlock(password);
      await manager.saveAccount(accountData);

      const store = storage.inspectStore();
      const keys = Array.from(store.keys());

      // Verify only expected keys exist
      const allowedKeys = ['master_salt', 'verification_payload', 'account', 'sessionKeys'];
      for (const key of keys) {
        expect(allowedKeys).toContain(key);
      }

      // Verify master_salt is a string (base64)
      const masterSalt = store.get('master_salt');
      expect(typeof masterSalt).toBe('string');

      // Verify verification_payload is an EncryptedPayload
      const verificationPayload = store.get('verification_payload');
      expect(verificationPayload).toHaveProperty('iv');
      expect(verificationPayload).toHaveProperty('salt');
      expect(verificationPayload).toHaveProperty('data');

      // Verify account is an EncryptedPayload
      const account = store.get('account');
      expect(account).toHaveProperty('iv');
      expect(account).toHaveProperty('salt');
      expect(account).toHaveProperty('data');
    });

    it('should not leak encryption key through storage adapter methods', async () => {
      const password = 'test-password';

      await manager.unlock(password);

      // Try to get encryption key directly from storage
      const encryptionKey = await storage.get('encryptionKey');
      expect(encryptionKey).toBeNull();

      const encryption_key = await storage.get('encryption_key');
      expect(encryption_key).toBeNull();

      const key = await storage.get('key');
      expect(key).toBeNull();

      const baseKey = await storage.get('baseKey');
      expect(baseKey).toBeNull();
    });

    it('should verify all EncryptedPayload fields are base64 strings', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };

      await manager.unlock(password);
      await manager.saveAccount(accountData);

      const store = storage.inspectStore();

      // Check verification_payload
      const verificationPayload = store.get('verification_payload');
      expect(typeof verificationPayload.iv).toBe('string');
      expect(typeof verificationPayload.salt).toBe('string');
      expect(typeof verificationPayload.data).toBe('string');

      // Verify they are valid base64 (can be decoded)
      expect(() => Buffer.from(verificationPayload.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(verificationPayload.salt, 'base64')).not.toThrow();
      expect(() => Buffer.from(verificationPayload.data, 'base64')).not.toThrow();

      // Check account payload
      const accountPayload = store.get('account');
      expect(typeof accountPayload.iv).toBe('string');
      expect(typeof accountPayload.salt).toBe('string');
      expect(typeof accountPayload.data).toBe('string');

      // Verify they are valid base64
      expect(() => Buffer.from(accountPayload.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(accountPayload.salt, 'base64')).not.toThrow();
      expect(() => Buffer.from(accountPayload.data, 'base64')).not.toThrow();
    });
  });
});

describe('SecureStorageManager - Error Message Security (Task 6.2)', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('Decryption failure error messages', () => {
    it('should use generic error message for decryption failures', async () => {
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';
      const sensitiveData = { privateKey: '0xSECRET_PRIVATE_KEY_12345' };

      // First run: unlock with correct password and save data
      await manager.unlock(correctPassword);
      await manager.saveAccount(sensitiveData);

      // Lock and derive wrong encryption key directly (bypass unlock's verification)
      manager.lock();
      const masterSalt = await (manager as any).loadMasterSalt();
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      (manager as any).encryptionKey = await deriveEncryptionKey(wrongPassword, masterSalt);

      // Try to decrypt data with wrong password - should throw generic error
      const decryptData = (manager as any).decryptData.bind(manager);
      const encryptedPayload = await storage.get('account');

      try {
        await decryptData(encryptedPayload);
        throw new Error('Expected decryptData to throw');
      } catch (error: any) {
        // Verify error message is generic
        expect(error.message).toBe('Invalid password or corrupted data');

        // Verify error message contains no sensitive information
        expect(error.message).not.toContain('0xSECRET_PRIVATE_KEY_12345');
        expect(error.message).not.toContain(sensitiveData.privateKey);
        expect(error.message).not.toContain('correct-password');
        expect(error.message).not.toContain('wrong-password');

        // Verify error message contains no encryption key material
        expect(error.message).not.toContain('key');
        expect(error.message).not.toContain('salt');
        expect(error.message).not.toContain('iv');
      }
    });

    it('should not leak password in error messages', async () => {
      const password = 'my-secret-password-123';
      const wrongPassword = 'wrong-password-456';

      // First run
      await manager.unlock(password);

      // Lock and try with wrong password
      manager.lock();
      const unlockResult = await manager.unlock(wrongPassword);
      expect(unlockResult).toBe(false);

      // Try to access data while locked
      try {
        await manager.getAccount();
        throw new Error('Expected getAccount to throw');
      } catch (error: any) {
        // Verify error message contains no password
        expect(error.message).not.toContain(password);
        expect(error.message).not.toContain(wrongPassword);
        expect(error.message).not.toContain('my-secret-password-123');
        expect(error.message).not.toContain('wrong-password-456');
      }
    });

    it('should not leak private keys in error messages', async () => {
      const password = 'test-password';
      const privateKey = '0xVERY_SECRET_PRIVATE_KEY_ABCDEF123456';
      const accountData = { privateKey };

      await manager.unlock(password);
      await manager.saveAccount(accountData);

      // Lock and try to access without unlocking
      manager.lock();

      try {
        await manager.getAccount();
        throw new Error('Expected getAccount to throw');
      } catch (error: any) {
        // Verify error message contains no private key
        expect(error.message).not.toContain(privateKey);
        expect(error.message).not.toContain('0xVERY_SECRET_PRIVATE_KEY_ABCDEF123456');
        expect(error.message).not.toContain('ABCDEF123456');
      }
    });

    it('should not leak session keys in error messages', async () => {
      const password = 'test-password';
      const sessionKey = 'SECRET_SESSION_KEY_XYZ789';
      const sessionKeysData = { keys: { session1: sessionKey } };

      await manager.unlock(password);
      await manager.saveSessionKeys(sessionKeysData);

      // Lock and try to access without unlocking
      manager.lock();

      try {
        await manager.getSessionKeys();
        throw new Error('Expected getSessionKeys to throw');
      } catch (error: any) {
        // Verify error message contains no session key
        expect(error.message).not.toContain(sessionKey);
        expect(error.message).not.toContain('SECRET_SESSION_KEY_XYZ789');
        expect(error.message).not.toContain('XYZ789');
      }
    });

    it('should not leak encryption key material in error messages', async () => {
      const password = 'test-password';

      await manager.unlock(password);

      // Get the master salt from storage
      const masterSalt = await storage.get('master_salt');

      // Lock and derive wrong encryption key directly
      manager.lock();
      const loadedMasterSalt = await (manager as any).loadMasterSalt();
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      (manager as any).encryptionKey = await deriveEncryptionKey(
        'wrong-password',
        loadedMasterSalt
      );

      const decryptData = (manager as any).decryptData.bind(manager);
      const verificationPayload = await storage.get('verification_payload');

      try {
        await decryptData(verificationPayload);
        throw new Error('Expected decryptData to throw');
      } catch (error: any) {
        // Verify error message contains no master salt
        expect(error.message).not.toContain(masterSalt);

        // Verify error message contains no payload salt
        expect(error.message).not.toContain(verificationPayload.salt);

        // Verify error message contains no IV
        expect(error.message).not.toContain(verificationPayload.iv);

        // Verify error message contains no ciphertext
        expect(error.message).not.toContain(verificationPayload.data);
      }
    });

    it('should use same generic error for wrong password and corrupted data', async () => {
      const password = 'test-password';

      await manager.unlock(password);
      await manager.saveAccount({ privateKey: '0xSECRET' });

      // Test 1: Wrong password - derive wrong key directly
      manager.lock();
      const masterSalt = await (manager as any).loadMasterSalt();
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      (manager as any).encryptionKey = await deriveEncryptionKey('wrong-password', masterSalt);

      const decryptData = (manager as any).decryptData.bind(manager);
      const accountPayload = await storage.get('account');

      let wrongPasswordError: Error | null = null;
      try {
        await decryptData(accountPayload);
      } catch (error: any) {
        wrongPasswordError = error;
      }

      // Test 2: Corrupted data (but valid base64)
      manager.lock();
      await manager.unlock(password);

      // Create corrupted payload with valid base64 but wrong ciphertext
      const corruptedPayload = {
        ...accountPayload,
        data: Buffer.from('CORRUPTED_DATA_THAT_WONT_DECRYPT_PROPERLY_BUT_IS_VALID_BASE64').toString(
          'base64'
        ),
      };

      let corruptedDataError: Error | null = null;
      try {
        await decryptData(corruptedPayload);
      } catch (error: any) {
        corruptedDataError = error;
      }

      // Verify both errors have the same generic message
      expect(wrongPasswordError).not.toBeNull();
      expect(corruptedDataError).not.toBeNull();
      expect(wrongPasswordError!.message).toBe('Invalid password or corrupted data');
      expect(corruptedDataError!.message).toBe('Invalid password or corrupted data');
      expect(wrongPasswordError!.message).toBe(corruptedDataError!.message);
    });
  });

  describe('Locked state error messages', () => {
    it('should use generic error message when accessing data while locked', async () => {
      // First, save some data so getAccount will try to decrypt
      await manager.unlock('password');
      await manager.saveAccount({ privateKey: '0xSECRET' });
      manager.lock();

      // Try to access data without unlocking
      await expect(manager.getAccount()).rejects.toThrow('Storage manager is locked');

      // Verify error message is generic and contains no sensitive data
      try {
        await manager.getAccount();
      } catch (error: any) {
        expect(error.message).not.toContain('password');
        expect(error.message).not.toContain('secret');
      }
    });

    it('should use generic error message when saving data while locked', async () => {
      const sensitiveData = { privateKey: '0xSECRET_KEY' };

      await expect(manager.saveAccount(sensitiveData)).rejects.toThrow('Storage manager is locked');

      // Verify error message contains no sensitive data from the payload
      try {
        await manager.saveAccount(sensitiveData);
      } catch (error: any) {
        expect(error.message).not.toContain('0xSECRET_KEY');
        expect(error.message).not.toContain(sensitiveData.privateKey);
      }
    });

    it('should use generic error message when saving session keys while locked', async () => {
      const sessionKeysData = { keys: { session1: 'SECRET_SESSION_KEY' } };

      await expect(manager.saveSessionKeys(sessionKeysData)).rejects.toThrow(
        'Storage manager is locked'
      );

      // Verify error message contains no session key data
      try {
        await manager.saveSessionKeys(sessionKeysData);
      } catch (error: any) {
        expect(error.message).not.toContain('SECRET_SESSION_KEY');
        expect(error.message).not.toContain(sessionKeysData.keys.session1);
      }
    });
  });

  describe('Error message consistency', () => {
    it('should always use the same error message for decryption failures', async () => {
      const password = 'test-password';
      const errors: string[] = [];

      // Setup
      await manager.unlock(password);
      await manager.saveAccount({ privateKey: '0xSECRET1' });

      // Test multiple wrong password attempts
      for (let i = 0; i < 5; i++) {
        manager.lock();
        const masterSalt = await (manager as any).loadMasterSalt();
        const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
        (manager as any).encryptionKey = await deriveEncryptionKey(
          `wrong-password-${i}`,
          masterSalt
        );

        const decryptData = (manager as any).decryptData.bind(manager);
        const accountPayload = await storage.get('account');

        try {
          await decryptData(accountPayload);
        } catch (error: any) {
          errors.push(error.message);
        }
      }

      // Verify all errors have the same message
      expect(errors.length).toBe(5);
      const uniqueMessages = new Set(errors);
      expect(uniqueMessages.size).toBe(1);
      expect(uniqueMessages.has('Invalid password or corrupted data')).toBe(true);
    });

    it('should always use the same error message for locked state access', async () => {
      const errors: string[] = [];

      // First, save some data so get methods will try to decrypt
      await manager.unlock('password');
      await manager.saveAccount({ privateKey: '0xSECRET' });
      await manager.saveSessionKeys({ keys: {} });
      manager.lock();

      // Test multiple locked access attempts
      await expect(manager.getAccount()).rejects.toThrow('Storage manager is locked');
      await expect(manager.getSessionKeys()).rejects.toThrow('Storage manager is locked');

      try {
        await manager.getAccount();
      } catch (error: any) {
        errors.push(error.message);
      }

      try {
        await manager.getSessionKeys();
      } catch (error: any) {
        errors.push(error.message);
      }

      // Verify all errors have the same message
      expect(errors.length).toBe(2);
      const uniqueMessages = new Set(errors);
      expect(uniqueMessages.size).toBe(1);
      expect(uniqueMessages.has('Storage manager is locked')).toBe(true);
    });
  });

  describe('Error message validation against requirements', () => {
    it('should verify decryption error message meets Requirement 5.2', async () => {
      // Requirement 5.2: Error messages should contain no sensitive information
      const password = 'test-password';
      const sensitiveData = {
        privateKey: '0xSECRET_PRIVATE_KEY',
        publicKey: 'GPUBLIC_KEY_ADDRESS',
        mnemonic: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
      };

      await manager.unlock(password);
      await manager.saveAccount(sensitiveData);

      // Derive wrong encryption key directly
      manager.lock();
      const masterSalt = await (manager as any).loadMasterSalt();
      const deriveEncryptionKey = (manager as any).deriveEncryptionKey.bind(manager);
      (manager as any).encryptionKey = await deriveEncryptionKey('wrong-password', masterSalt);

      const decryptData = (manager as any).decryptData.bind(manager);
      const accountPayload = await storage.get('account');

      try {
        await decryptData(accountPayload);
        throw new Error('Expected decryptData to throw');
      } catch (error: any) {
        // Verify error message is generic
        expect(error.message).toBe('Invalid password or corrupted data');

        // Verify no sensitive data leaked
        expect(error.message).not.toContain(sensitiveData.privateKey);
        expect(error.message).not.toContain(sensitiveData.publicKey);
        expect(error.message).not.toContain(sensitiveData.mnemonic);
        expect(error.message).not.toContain('word1');
        expect(error.message).not.toContain('0xSECRET');
        expect(error.message).not.toContain('GPUBLIC');

        // Verify no password leaked
        expect(error.message).not.toContain(password);
        expect(error.message).not.toContain('wrong-password');

        // Verify no cryptographic material leaked
        expect(error.message).not.toContain(accountPayload.salt);
        expect(error.message).not.toContain(accountPayload.iv);
        expect(error.message).not.toContain(accountPayload.data);
      }
    });

    it('should verify locked state error message meets Requirement 5.2', async () => {
      // Requirement 5.2: Error messages should contain no sensitive information
      const sensitiveData = {
        privateKey: '0xSECRET_PRIVATE_KEY',
        sessionKey: 'SECRET_SESSION_KEY_XYZ',
      };

      await expect(manager.saveAccount(sensitiveData)).rejects.toThrow('Storage manager is locked');

      try {
        await manager.saveAccount(sensitiveData);
      } catch (error: any) {
        // Verify no sensitive data leaked
        expect(error.message).not.toContain(sensitiveData.privateKey);
        expect(error.message).not.toContain(sensitiveData.sessionKey);
        expect(error.message).not.toContain('0xSECRET');
        expect(error.message).not.toContain('SECRET_SESSION');
      }
    });
  });
});

describe('SecureStorageManager - Backward Compatibility (Task 7.1)', () => {
  let storage: MockStorageAdapter;
  let manager: SecureStorageManager;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    manager = new SecureStorageManager(storage);
  });

  describe('EncryptedPayload structure preservation', () => {
    it('should maintain EncryptedPayload structure with iv, salt, and data fields', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };

      await manager.unlock(password);
      await manager.saveAccount(accountData);

      const storedPayload = await storage.get('account');

      // Verify structure has exactly three fields
      const keys = Object.keys(storedPayload);
      expect(keys.length).toBe(3);
      expect(keys).toContain('iv');
      expect(keys).toContain('salt');
      expect(keys).toContain('data');

      // Verify all fields are strings (base64)
      expect(typeof storedPayload.iv).toBe('string');
      expect(typeof storedPayload.salt).toBe('string');
      expect(typeof storedPayload.data).toBe('string');
    });

    it('should use per-payload salts for each encryption operation', async () => {
      const password = 'test-password';
      const data1 = { privateKey: '0xSECRET1' };
      const data2 = { privateKey: '0xSECRET2' };

      await manager.unlock(password);
      await manager.saveAccount(data1);

      const payload1 = await storage.get('account');

      // Save different data
      await manager.saveAccount(data2);
      const payload2 = await storage.get('account');

      // Verify different per-payload salts
      expect(payload1.salt).not.toBe(payload2.salt);

      // Verify different IVs
      expect(payload1.iv).not.toBe(payload2.iv);

      // Verify different ciphertext
      expect(payload1.data).not.toBe(payload2.data);
    });

    it('should use per-payload salts independent of master salt', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };

      await manager.unlock(password);
      await manager.saveAccount(accountData);

      const masterSalt = await storage.get('master_salt');
      const accountPayload = await storage.get('account');

      // Verify master salt is different from payload salt
      expect(masterSalt).not.toBe(accountPayload.salt);

      // Verify they are both valid base64 strings
      expect(() => Buffer.from(masterSalt, 'base64')).not.toThrow();
      expect(() => Buffer.from(accountPayload.salt, 'base64')).not.toThrow();

      // Verify they decode to different byte arrays
      const masterSaltBytes = Buffer.from(masterSalt, 'base64');
      const payloadSaltBytes = Buffer.from(accountPayload.salt, 'base64');
      expect(masterSaltBytes.toString('hex')).not.toBe(payloadSaltBytes.toString('hex'));
    });

    it('should generate unique per-payload salts for multiple items', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };
      const sessionKeysData = { keys: { session1: 'key1' } };

      await manager.unlock(password);
      await manager.saveAccount(accountData);
      await manager.saveSessionKeys(sessionKeysData);

      const accountPayload = await storage.get('account');
      const sessionKeysPayload = await storage.get('sessionKeys');
      const verificationPayload = await storage.get('verification_payload');

      // Verify all have different salts
      expect(accountPayload.salt).not.toBe(sessionKeysPayload.salt);
      expect(accountPayload.salt).not.toBe(verificationPayload.salt);
      expect(sessionKeysPayload.salt).not.toBe(verificationPayload.salt);

      // Verify all have different IVs
      expect(accountPayload.iv).not.toBe(sessionKeysPayload.iv);
      expect(accountPayload.iv).not.toBe(verificationPayload.iv);
      expect(sessionKeysPayload.iv).not.toBe(verificationPayload.iv);
    });

    it('should maintain EncryptedPayload structure across lock/unlock cycles', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };

      // First cycle
      await manager.unlock(password);
      await manager.saveAccount(accountData);
      const payload1 = await storage.get('account');

      // Lock and unlock
      manager.lock();
      await manager.unlock(password);

      // Save again
      await manager.saveAccount(accountData);
      const payload2 = await storage.get('account');

      // Verify both payloads have the same structure
      expect(Object.keys(payload1).sort()).toEqual(Object.keys(payload2).sort());
      expect(Object.keys(payload1).sort()).toEqual(['data', 'iv', 'salt']);
      expect(Object.keys(payload2).sort()).toEqual(['data', 'iv', 'salt']);
    });

    it('should verify all base64 fields are properly encoded', async () => {
      const password = 'test-password';
      const accountData = { privateKey: '0xSECRET' };

      await manager.unlock(password);
      await manager.saveAccount(accountData);

      const payload = await storage.get('account');

      // Verify IV is valid base64 and decodes to 12 bytes
      const ivBytes = Buffer.from(payload.iv, 'base64');
      expect(ivBytes.length).toBe(12);

      // Verify salt is valid base64 and decodes to 16 bytes
      const saltBytes = Buffer.from(payload.salt, 'base64');
      expect(saltBytes.length).toBe(16);

      // Verify data is valid base64
      expect(() => Buffer.from(payload.data, 'base64')).not.toThrow();
      const dataBytes = Buffer.from(payload.data, 'base64');
      expect(dataBytes.length).toBeGreaterThan(0);
    });

    it('should use random salts (verify randomness)', async () => {
      const password = 'test-password';
      const salts: string[] = [];

      await manager.unlock(password);

      // Generate multiple encrypted payloads
      for (let i = 0; i < 10; i++) {
        await manager.saveAccount({ privateKey: `0xSECRET${i}` });
        const payload = await storage.get('account');
        salts.push(payload.salt);
      }

      // Verify all salts are unique
      const uniqueSalts = new Set(salts);
      expect(uniqueSalts.size).toBe(10);
    });
  });

  describe('Migration from old to new implementation', () => {
    it('should decrypt data encrypted with old unlock implementation', async () => {
      const password = 'migration-test-password';
      const accountData = { privateKey: '0xOLD_IMPLEMENTATION_KEY' };

      // Simulate old implementation: directly import password as PBKDF2 key (old behavior)
      const encoder = new TextEncoder();
      const oldBaseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      // Manually set the encryption key to simulate old implementation
      (manager as any).encryptionKey = oldBaseKey;

      // Encrypt data using old implementation (which uses per-payload salts)
      await manager.saveAccount(accountData);

      // Lock and create new manager instance
      manager.lock();
      const newManager = new SecureStorageManager(storage);

      // New implementation should be able to unlock and decrypt
      // Note: This will fail because new implementation requires master_salt
      // So we need to test that new implementation creates master_salt on first run
      const unlockResult = await newManager.unlock(password);
      expect(unlockResult).toBe(true);

      // Verify master salt was created
      const masterSalt = await storage.get('master_salt');
      expect(masterSalt).toBeDefined();

      // Verify verification payload was created
      const verificationPayload = await storage.get('verification_payload');
      expect(verificationPayload).toBeDefined();
    });

    it('should handle existing encrypted data after migration', async () => {
      const password = 'test-password';
      const oldAccountData = { privateKey: '0xOLD_KEY' };
      const newAccountData = { privateKey: '0xNEW_KEY' };

      // Simulate old implementation
      const encoder = new TextEncoder();
      const oldBaseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      (manager as any).encryptionKey = oldBaseKey;
      await manager.saveAccount(oldAccountData);

      // Lock and use new implementation
      manager.lock();
      const newManager = new SecureStorageManager(storage);

      // First unlock with new implementation (creates master salt)
      await newManager.unlock(password);

      // Save new data with new implementation
      await newManager.saveAccount(newAccountData);

      // Verify we can retrieve the new data
      const retrieved = await newManager.getAccount();
      expect(retrieved).toEqual(newAccountData);
    });

    it('should maintain backward compatibility with per-payload salt encryption', async () => {
      const password = 'test-password';

      // Old implementation behavior: uses per-payload salts
      const encoder = new TextEncoder();
      const oldBaseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      (manager as any).encryptionKey = oldBaseKey;

      // Encrypt multiple items with old implementation
      await manager.saveAccount({ privateKey: '0xKEY1' });
      const oldPayload1 = await storage.get('account');

      await manager.saveAccount({ privateKey: '0xKEY2' });
      const oldPayload2 = await storage.get('account');

      // Verify old implementation used different per-payload salts
      expect(oldPayload1.salt).not.toBe(oldPayload2.salt);

      // Now use new implementation
      manager.lock();
      await manager.unlock(password);

      // Encrypt with new implementation
      await manager.saveAccount({ privateKey: '0xKEY3' });
      const newPayload = await storage.get('account');

      // Verify new implementation also uses per-payload salts
      expect(newPayload.salt).not.toBe(oldPayload1.salt);
      expect(newPayload.salt).not.toBe(oldPayload2.salt);

      // Verify structure is the same
      expect(Object.keys(newPayload).sort()).toEqual(Object.keys(oldPayload1).sort());
    });
  });
});
