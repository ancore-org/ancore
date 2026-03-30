import { AccountData, EncryptedPayload, SessionKeysData, StorageAdapter } from './types';

const STORAGE_KEYS = {
  account: 'account',
  sessionKeys: 'sessionKeys',
} as const;

export interface SecureStorageManagerOptions {
  autoLockMs?: number;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
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

export class SecureStorageManager {
  private baseKey: CryptoKey | null = null;
  private readonly storage: StorageAdapter;
  private readonly autoLockMs: number | null;
  private autoLockTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  constructor(storage: StorageAdapter, options: SecureStorageManagerOptions = {}) {
    this.storage = storage;
    this.autoLockMs = options.autoLockMs && options.autoLockMs > 0 ? options.autoLockMs : null;
  }

  /**
   * Derives a temporary key from the password for memory use only.
   */
  public async unlock(password: string): Promise<void> {
    if (this.baseKey) {
      this.touch();
      return;
    }

    const encoder = new TextEncoder();
    this.baseKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    this.touch();
  }

  /**
   * Clears the in-memory keys.
   */
  public lock(): void {
    this.baseKey = null;
    if (this.autoLockTimer) {
      globalThis.clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  public get isUnlocked(): boolean {
    return this.baseKey !== null;
  }

  /**
   * Record activity and reset the inactivity auto-lock timer.
   */
  public touch(): void {
    if (!this.baseKey || this.autoLockMs === null) {
      return;
    }

    if (this.autoLockTimer) {
      globalThis.clearTimeout(this.autoLockTimer);
    }

    this.autoLockTimer = globalThis.setTimeout(() => {
      this.lock();
    }, this.autoLockMs);
  }

  private async deriveAesKey(salt: Uint8Array | any): Promise<CryptoKey> {
    if (!this.baseKey) throw new Error('Storage manager is locked');
    return globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      this.baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptData(plaintext: string): Promise<EncryptedPayload> {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16) as any);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12) as any);

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

    const aesKey = await this.deriveAesKey(new Uint8Array(salt) as any);

    try {
      const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) as any },
        aesKey,
        ciphertext as any
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch {
      throw new Error('Invalid password or corrupted data');
    }
  }

  public async saveAccount(account: AccountData): Promise<void> {
    this.touch();
    const payload = await this.encryptData(JSON.stringify(account));
    await this.storage.set(STORAGE_KEYS.account, payload);
  }

  public async getAccount(): Promise<AccountData | null> {
    this.touch();
    
    if (!this.baseKey) {
      throw new Error('Storage manager is locked');
    }
    
    const payload = (await this.storage.get(STORAGE_KEYS.account)) as EncryptedPayload | null;
    if (!payload) return null;
    
    // Validate payload structure
    if (!payload.salt || !payload.iv || !payload.data) {
      throw new Error('Invalid password or corrupted data');
    }
    
    try {
      const json = await this.decryptData(payload);
      const parsed = JSON.parse(json);
      
      // Validate that the parsed data has the expected AccountData structure
      if (!parsed || typeof parsed !== 'object' || !('privateKey' in parsed)) {
        throw new Error('Invalid password or corrupted data');
      }
      
      return parsed as AccountData;
    } catch (error) {
      // Re-throw decryption/parsing errors with a generic message to prevent information leakage
      if (error instanceof Error && error.message === 'Invalid password or corrupted data') {
        throw error;
      }
      throw new Error('Invalid password or corrupted data');
    }
  }

  public async saveSessionKeys(sessionKeys: SessionKeysData): Promise<void> {
    this.touch();
    const payload = await this.encryptData(JSON.stringify(sessionKeys));
    await this.storage.set(STORAGE_KEYS.sessionKeys, payload);
  }

  public async getSessionKeys(): Promise<SessionKeysData | null> {
    this.touch();
    const payload = (await this.storage.get(STORAGE_KEYS.sessionKeys)) as EncryptedPayload | null;
    if (!payload) return null;
    const json = await this.decryptData(payload);
    return JSON.parse(json);
  }
}
