import { AccountData, EncryptedPayload, SessionKeysData, StorageAdapter } from './types';

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
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Derives a temporary key from the password for memory use only.
   */
  public async unlock(password: string): Promise<void> {
    if (this.baseKey) return; // Already unlocked

    const encoder = new TextEncoder();
    this.baseKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
  }

  /**
   * Clears the in-memory keys.
   */
  public lock(): void {
    this.baseKey = null;
  }

  public get isUnlocked(): boolean {
    return this.baseKey !== null;
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
    } catch (error: any) {
      throw new Error('Invalid password or corrupted data');
    }
  }

  public async saveAccount(account: AccountData): Promise<void> {
    const payload = await this.encryptData(JSON.stringify(account));
    await this.storage.set('account', payload);
  }

  public async getAccount(): Promise<AccountData | null> {
    const payload = (await this.storage.get('account')) as EncryptedPayload | null;
    if (!payload) return null;
    const json = await this.decryptData(payload);
    return JSON.parse(json);
  }

  public async saveSessionKeys(sessionKeys: SessionKeysData): Promise<void> {
    const payload = await this.encryptData(JSON.stringify(sessionKeys));
    await this.storage.set('sessionKeys', payload);
  }

  public async getSessionKeys(): Promise<SessionKeysData | null> {
    const payload = (await this.storage.get('sessionKeys')) as EncryptedPayload | null;
    if (!payload) return null;
    const json = await this.decryptData(payload);
    return JSON.parse(json);
  }
}
