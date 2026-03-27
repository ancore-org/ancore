export interface EncryptedPayload {
  /** Base64-encoded Initialization Vector */
  iv: string;
  /** Base64-encoded Salt used for PBKDF2 */
  salt: string;
  /** Base64-encoded encrypted data (ciphertext + auth tag) */
  data: string;
}

export interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface AccountData {
  privateKey: string;
  [key: string]: any;
}

export interface SessionKeysData {
  keys: Record<string, string>;
  [key: string]: any;
}
