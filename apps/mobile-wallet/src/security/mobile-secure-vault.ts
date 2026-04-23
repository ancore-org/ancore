import {
  AccountMetadata,
  AccountSecretPayload,
  EncryptedPayload,
  PersistedAccountRecord,
  PersistedVaultState,
  SecureStoreAdapter,
} from '../storage';
import { base64ToBytes, bufferToBase64, toBufferSource } from './encoding';

const VAULT_STATE_KEY = 'mobile_vault_state';
const VAULT_ACCOUNTS_KEY = 'mobile_vault_accounts';
const VERIFICATION_MARKER = 'ANCORE_MOBILE_VAULT_V1';
const PBKDF2_ITERATIONS = 100_000;

interface VerificationPayload {
  marker: typeof VERIFICATION_MARKER;
  createdAt: string;
}

export interface MobileVaultOptions {
  lockTimeoutMs?: number;
  now?: () => number;
}

export interface PersistAccountInput {
  id: string;
  address: string;
  label?: string;
  keyMaterial: string;
  accountPayload: Record<string, unknown>;
}

export interface StoredAccount {
  metadata: AccountMetadata;
  secret: AccountSecretPayload;
}

export class MobileSecureVault {
  private readonly storage: SecureStoreAdapter;
  private readonly lockTimeoutMs: number | null;
  private readonly now: () => number;
  private baseKey: CryptoKey | null = null;
  private lockTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  constructor(storage: SecureStoreAdapter, options: MobileVaultOptions = {}) {
    this.storage = storage;
    this.lockTimeoutMs =
      options.lockTimeoutMs != null && options.lockTimeoutMs > 0 ? options.lockTimeoutMs : null;
    this.now = options.now ?? (() => Date.now());
  }

  get isUnlocked(): boolean {
    return this.baseKey !== null;
  }

  async unlock(password: string): Promise<boolean> {
    if (this.baseKey) {
      this.touch();
      return true;
    }

    const state = await this.storage.get<PersistedVaultState>(VAULT_STATE_KEY);

    if (!state) {
      const masterSalt = globalThis.crypto.getRandomValues(new Uint8Array(16));
      this.baseKey = await this.deriveBaseKey(password, masterSalt);

      const verification = await this.encryptJson<VerificationPayload>({
        marker: VERIFICATION_MARKER,
        createdAt: new Date(this.now()).toISOString(),
      });

      await this.storage.set<PersistedVaultState>(VAULT_STATE_KEY, {
        version: 1,
        masterSalt: bufferToBase64(masterSalt),
        verification,
      });

      this.touch();
      return true;
    }

    this.baseKey = await this.deriveBaseKey(password, base64ToBytes(state.masterSalt));

    try {
      const verification = await this.decryptJson<VerificationPayload>(state.verification);
      const isValid = verification.marker === VERIFICATION_MARKER;

      if (!isValid) {
        this.lock();
        return false;
      }

      this.touch();
      return true;
    } catch {
      this.lock();
      return false;
    }
  }

  lock(): void {
    this.baseKey = null;

    if (this.lockTimer) {
      globalThis.clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  touch(): void {
    if (!this.baseKey || this.lockTimeoutMs === null) {
      return;
    }

    if (this.lockTimer) {
      globalThis.clearTimeout(this.lockTimer);
    }

    this.lockTimer = globalThis.setTimeout(() => {
      this.lock();
    }, this.lockTimeoutMs);
  }

  async persistAccount(input: PersistAccountInput): Promise<AccountMetadata> {
    this.ensureUnlocked();

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
      encryptedSecret: await this.encryptJson<AccountSecretPayload>({
        keyMaterial: input.keyMaterial,
        accountPayload: input.accountPayload,
      }),
    };

    await this.storage.set<Record<string, PersistedAccountRecord>>(VAULT_ACCOUNTS_KEY, records);
    this.touch();

    return metadata;
  }

  async listAccountMetadata(): Promise<AccountMetadata[]> {
    const records = await this.loadAccountRecords();

    return Object.values(records)
      .map((record) => record.metadata)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async loadAccount(accountId: string): Promise<StoredAccount | null> {
    this.ensureUnlocked();

    const records = await this.loadAccountRecords();
    const record = records[accountId];

    if (!record) {
      return null;
    }

    const secret = await this.decryptJson<AccountSecretPayload>(record.encryptedSecret);
    this.touch();

    return {
      metadata: record.metadata,
      secret,
    };
  }

  async clearData(): Promise<void> {
    await this.storage.remove(VAULT_STATE_KEY);
    await this.storage.remove(VAULT_ACCOUNTS_KEY);
    this.lock();
  }

  private async loadAccountRecords(): Promise<Record<string, PersistedAccountRecord>> {
    return (
      (await this.storage.get<Record<string, PersistedAccountRecord>>(VAULT_ACCOUNTS_KEY)) ?? {}
    );
  }

  private ensureUnlocked(): void {
    if (!this.baseKey) {
      throw new Error('Vault is locked');
    }
  }

  private async deriveBaseKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordKey = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const keyMaterial = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: toBufferSource(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      passwordKey,
      256
    );

    return globalThis.crypto.subtle.importKey('raw', keyMaterial, { name: 'HKDF' }, false, [
      'deriveKey',
    ]);
  }

  private async encryptJson<T>(value: T): Promise<EncryptedPayload> {
    this.ensureUnlocked();

    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await this.deriveRecordKey(salt);
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      aesKey,
      plaintext
    );

    return {
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
      data: bufferToBase64(ciphertext),
    };
  }

  private async decryptJson<T>(payload: EncryptedPayload): Promise<T> {
    this.ensureUnlocked();

    const aesKey = await this.deriveRecordKey(base64ToBytes(payload.salt));
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBufferSource(base64ToBytes(payload.iv)) },
      aesKey,
      toBufferSource(base64ToBytes(payload.data))
    );

    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  }

  private async deriveRecordKey(salt: Uint8Array): Promise<CryptoKey> {
    this.ensureUnlocked();

    return globalThis.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: toBufferSource(salt),
        info: new TextEncoder().encode('ancore-mobile-vault-record'),
      },
      this.baseKey as CryptoKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}
