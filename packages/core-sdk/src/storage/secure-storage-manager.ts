import {
  AccountData,
  EncryptedPayload,
  PlatformStorageAdapter,
  RecentRecipientsData,
  SessionKeysData,
  StorageAdapter,
} from './types';

const MASTER_SALT_STORAGE_KEY = 'master_salt';
const VERIFICATION_PAYLOAD_STORAGE_KEY = 'verification_payload';
const DEFAULT_DATA_KEYS = ['account', 'sessionKeys', 'recentRecipients'] as const;

function toArrayBufferView(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const normalized = new Uint8Array(new ArrayBuffer(value.byteLength));
  normalized.set(value);
  return normalized;
}

interface VerificationContent {
  marker: 'KIRO_VERIFICATION_V1';
  timestamp: number;
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function isLegacyStorageAdapter(
  storage: PlatformStorageAdapter | StorageAdapter
): storage is StorageAdapter {
  return typeof (storage as StorageAdapter).remove === 'function';
}

/**
 * Parse only JSON object/array containers. Never coerce JSON scalars
 * (`true`, `null`, `1e3`, …) — those must remain plain strings so
 * round-trips stay byte-identical. Inferring JSON-ness from bare
 * `JSON.parse` success is unsafe.
 */
export function tryParseStructuredJson(value: string): object | undefined {
  const first = value.trimStart()[0];
  if (first !== '{' && first !== '[') {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Invalid JSON — keep the original string.
  }

  return undefined;
}

/**
 * Bridge a legacy `StorageAdapter` (typed `unknown` values) to the
 * string-only `PlatformStorageAdapter` surface used by SecureStorageManager.
 * Structured JSON is stored as native objects; everything else as strings.
 */
export function normalizeStorageAdapter(
  storage: PlatformStorageAdapter | StorageAdapter
): PlatformStorageAdapter {
  if (!isLegacyStorageAdapter(storage)) {
    return storage;
  }

  return {
    get: async (key) => {
      const value = await storage.get(key);
      if (value == null) {
        return null;
      }
      return typeof value === 'string' ? value : JSON.stringify(value);
    },
    set: async (key, value) => {
      const structured = tryParseStructuredJson(value);
      await storage.set(key, structured !== undefined ? structured : value);
    },
    delete: (key) => storage.remove(key),
  };
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.salt === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.data === 'string'
  );
}

function parseEncryptedPayload(serialized: string | null): EncryptedPayload | null {
  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    return isEncryptedPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface SecureStorageManagerOptions {
  autoLockMs?: number;
}

export class SecureStorageManager {
  private encryptionKey: CryptoKey | null = null;
  private readonly storage: PlatformStorageAdapter;
  private readonly autoLockMs: number | null;
  private autoLockTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  constructor(
    storage: PlatformStorageAdapter | StorageAdapter,
    options: SecureStorageManagerOptions = {}
  ) {
    this.storage = normalizeStorageAdapter(storage);
    this.autoLockMs =
      options.autoLockMs != null && options.autoLockMs > 0 ? options.autoLockMs : null;
  }

  /**
   * Unlocks the storage manager with the provided password.
   * On first run, generates a master salt and verification payload.
   * On subsequent runs, verifies the password against the stored verification payload.
   * @param password - The user's password
   * @returns true if unlock succeeds, false if password is incorrect
   */
  public async unlock(password: string): Promise<boolean> {
    // Already unlocked — refresh activity timer
    if (this.encryptionKey) {
      this.touch();
      return true;
    }

    // Check if master salt exists (first-run vs subsequent-run)
    let masterSalt = await this.loadMasterSalt();

    if (!masterSalt) {
      // First run: generate salt in memory only
      masterSalt = this.initializeMasterSalt();

      // Derive encryption key from password and master salt
      this.encryptionKey = await this.deriveEncryptionKey(password, masterSalt);

      // Store verification payload first, then persist salt last (atomic ordering)
      await this.createVerificationPayload();
      await this.storage.set(MASTER_SALT_STORAGE_KEY, bufferToBase64(masterSalt));

      this.touch();
      return true;
    }

    // Subsequent run: load master salt and verify password
    this.encryptionKey = await this.deriveEncryptionKey(password, masterSalt);

    const isValid = await this.verifyPassword();
    if (isValid) {
      this.touch();
    }
    return isValid;
  }

  /**
   * Locks the storage manager by clearing the in-memory encryption key and
   * cancelling any pending auto-lock timer. Call this when the user logs out
   * or the session should end immediately.
   *
   * @example
   * ```typescript
   * const manager = new SecureStorageManager(storage);
   * await manager.unlock('my-password');
   * // ... do work ...
   * manager.lock(); // key wiped from memory
   * console.log(manager.isUnlocked); // false
   * ```
   */
  public lock(): void {
    this.encryptionKey = null;
    if (this.autoLockTimer) {
      globalThis.clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  /**
   * Whether the storage manager is currently unlocked and ready for
   * encrypted reads/writes.
   *
   * @example
   * ```typescript
   * if (!manager.isUnlocked) {
   *   await manager.unlock(password);
   * }
   * ```
   */
  public get isUnlocked(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Checks if a vault has been created (i.e., master salt exists).
   * @returns true if a vault exists, false otherwise
   */
  public async hasVault(): Promise<boolean> {
    const salt = await this.storage.get(MASTER_SALT_STORAGE_KEY);
    return salt != null;
  }

  /**
   * Record activity and reset the inactivity auto-lock timer.
   */
  public touch(): void {
    if (!this.encryptionKey || this.autoLockMs === null) {
      return;
    }
    if (this.autoLockTimer) {
      globalThis.clearTimeout(this.autoLockTimer);
    }
    this.autoLockTimer = globalThis.setTimeout(() => {
      this.lock();
    }, this.autoLockMs);
  }

  /**
   * Generates a random 16-byte master salt and stores it in the storage adapter.
   * @returns The generated master salt as a Uint8Array
   */
  private initializeMasterSalt(): Uint8Array {
    return globalThis.crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Loads the existing master salt from storage.
   * @returns The master salt as a Uint8Array, or null if it doesn't exist
   */
  private async loadMasterSalt(): Promise<Uint8Array | null> {
    const base64Salt = await this.storage.get(MASTER_SALT_STORAGE_KEY);

    if (base64Salt == null) return null; // genuinely not initialized

    if (typeof base64Salt !== 'string') {
      return null; // treat corrupted salt as missing to allow re-initialization
    }

    try {
      const buffer = base64ToBuffer(base64Salt);
      if (buffer.byteLength !== 16) {
        return null; // expected 16 bytes
      }
      return new Uint8Array(buffer);
    } catch {
      return null; // invalid base64
    }
  }

  /**
   * Derives an encryption key from the password and master salt using PBKDF2.
   * This key is used as a base key for deriving per-payload AES keys.
   * @param password - The user's password
   * @param masterSalt - The master salt (16 bytes)
   * @returns A CryptoKey suitable for deriving per-payload AES-256-GCM keys
   */
  private async deriveEncryptionKey(password: string, masterSalt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive key material from password + master salt
    const keyMaterial = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: toArrayBufferView(masterSalt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      256 // 256 bits = 32 bytes
    );

    // Import the derived key material as a PBKDF2 key for further derivation
    return globalThis.crypto.subtle.importKey('raw', keyMaterial, { name: 'PBKDF2' }, false, [
      'deriveKey',
    ]);
  }

  /**
   * Creates and stores a verification payload for password verification.
   * The verification payload contains known plaintext that can be decrypted
   * to verify password correctness without exposing sensitive data.
   */
  private async createVerificationPayload(): Promise<void> {
    const verificationContent: VerificationContent = {
      marker: 'KIRO_VERIFICATION_V1',
      timestamp: Date.now(),
    };

    const payload = await this.encryptData(JSON.stringify(verificationContent));
    await this.storage.set(VERIFICATION_PAYLOAD_STORAGE_KEY, JSON.stringify(payload));
  }

  /**
   * Verifies the password by attempting to decrypt the verification payload.
   * @returns true if decryption succeeds, false if it fails
   */
  private async verifyPassword(): Promise<boolean> {
    const payload = await this.readEncryptedPayload(VERIFICATION_PAYLOAD_STORAGE_KEY);
    if (!payload) {
      return false;
    }

    try {
      await this.decryptData(payload);
      return true;
    } catch {
      // Decryption failed - wrong password
      this.encryptionKey = null;
      return false;
    }
  }

  private async deriveAesKey(salt: Uint8Array): Promise<CryptoKey> {
    if (!this.encryptionKey) throw new Error('Storage manager is locked');
    return globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toArrayBufferView(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      this.encryptionKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptData(plaintext: string): Promise<EncryptedPayload> {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

    const aesKey = await this.deriveAesKey(salt);
    const encoder = new TextEncoder();

    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoder.encode(plaintext)
    );

    return {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      data: bufferToBase64(ciphertext),
    };
  }

  private async decryptData(payload: EncryptedPayload): Promise<string> {
    const salt = base64ToBuffer(payload.salt);
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.data);

    const aesKey = await this.deriveAesKey(new Uint8Array(salt));

    try {
      const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        aesKey,
        ciphertext
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch {
      throw new Error('Invalid password or corrupted data');
    }
  }

  /**
   * Saves the primary account data to encrypted storage.
   * The manager must be unlocked before calling this method.
   *
   * @param account - Account data to persist (addresses, keys metadata, etc.)
   * @throws Error if the storage manager is locked
   *
   * @example
   * ```typescript
   * await manager.unlock('my-password');
   * await manager.saveAccount({ address: 'G...', contractId: 'C...' });
   * ```
   */
  public async saveAccount(account: AccountData): Promise<void> {
    await this.saveItem('account', account);
  }

  /**
   * Retrieves the primary account data from encrypted storage.
   * Returns `null` if no account has been saved yet.
   *
   * @returns The stored account data, or `null` if absent
   * @throws Error if the storage manager is locked
   *
   * @example
   * ```typescript
   * const account = await manager.getAccount();
   * if (account) {
   *   console.log(account.address);
   * }
   * ```
   */
  public async getAccount(): Promise<AccountData | null> {
    return this.getItem<AccountData>('account');
  }

  public async saveSessionKeys(sessionKeys: SessionKeysData): Promise<void> {
    await this.saveItem('sessionKeys', sessionKeys);
  }

  public async getSessionKeys(): Promise<SessionKeysData | null> {
    return (await this.getItem<SessionKeysData>('sessionKeys')) ?? { keys: {} };
  }

  public async saveRecentRecipients(data: RecentRecipientsData): Promise<void> {
    await this.saveItem('recentRecipients', data);
  }

  public async getRecentRecipients(): Promise<RecentRecipientsData | null> {
    return (await this.getItem<RecentRecipientsData>('recentRecipients')) ?? { recipients: [] };
  }

  /**
   * Encrypts and persists an arbitrary JSON-serialisable value under `key`.
   * Use typed helpers (`saveAccount`, `saveSessionKeys`, etc.) for well-known
   * keys; use this for extension-specific or adapter-specific data.
   *
   * @param key - Storage key
   * @param value - Any JSON-serialisable value
   * @throws Error if the storage manager is locked
   *
   * @example
   * ```typescript
   * await manager.saveItem('customSettings', { theme: 'dark' });
   * const settings = await manager.getItem<{ theme: string }>('customSettings');
   * ```
   */
  public async saveItem(key: string, value: unknown): Promise<void> {
    this.assertUnlocked();

    const payload = await this.encryptData(JSON.stringify(value));
    await this.storage.set(key, JSON.stringify(payload));
    this.touch();
  }

  /**
   * Decrypts and returns the value stored under `key`, cast to `T`.
   * Returns `null` if the key does not exist or the payload is unreadable.
   *
   * @param key - Storage key used in a prior `saveItem` call
   * @returns The decrypted value cast to `T`, or `null`
   * @throws Error if the storage manager is locked
   *
   * @example
   * ```typescript
   * const settings = await manager.getItem<{ theme: string }>('customSettings');
   * console.log(settings?.theme); // 'dark'
   * ```
   */
  public async getItem<T>(key: string): Promise<T | null> {
    this.assertUnlocked();

    const payload = await this.readEncryptedPayload(key);
    if (!payload) {
      return null;
    }

    try {
      const json = await this.decryptData(payload);
      this.touch();
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }

  /**
   * Deletes a single key from storage without requiring the manager to be
   * unlocked. Useful for clearing stale or corrupted entries.
   *
   * @param key - Storage key to remove
   *
   * @example
   * ```typescript
   * await manager.deleteItem('staleSessionKey');
   * ```
   */
  public async deleteItem(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  /**
   * Wipes all vault data (master salt, verification payload, account, session
   * keys, recent recipients) and any additional keys provided, then locks the
   * manager. Use this for wallet reset / account removal flows.
   *
   * @param additionalKeys - Extra storage keys to delete alongside the defaults
   *
   * @example
   * ```typescript
   * // Full wallet wipe
   * await manager.reset();
   *
   * // Wipe vault + custom adapter keys
   * await manager.reset(['myAdapterKey', 'anotherKey']);
   * ```
   */
  public async reset(additionalKeys: string[] = []): Promise<void> {
    const keys = new Set<string>([
      MASTER_SALT_STORAGE_KEY,
      VERIFICATION_PAYLOAD_STORAGE_KEY,
      ...DEFAULT_DATA_KEYS,
      ...additionalKeys,
    ]);

    await Promise.all([...keys].map((key) => this.storage.delete(key)));
    this.lock();
  }

  private async readEncryptedPayload(key: string): Promise<EncryptedPayload | null> {
    const serialized = await this.storage.get(key);
    return parseEncryptedPayload(serialized);
  }

  private assertUnlocked(): void {
    if (!this.encryptionKey) {
      throw new Error('Storage manager is locked');
    }
  }
}
