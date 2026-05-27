import { decryptSecretKey, type EncryptedSecretKeyPayload } from '@ancore/crypto';
import { SecureStorageManager, createStorageAdapter, type AccountData } from '@ancore/core-sdk';
import { getSharedStorageManager, resetSharedStorageManagerForTests } from './storage-manager';

export type VaultExportKind = 'privateKey' | 'mnemonic';

export interface VaultAccountData extends AccountData {
  encryptedMnemonic?: EncryptedSecretKeyPayload;
  mnemonic?: string;
}

export class VaultExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultExportError';
  }
}

type StorageManagerInstance = InstanceType<typeof SecureStorageManager>;

export function getVaultStorageManager(): StorageManagerInstance {
  return getSharedStorageManager();
}

export function resetVaultStorageManagerForTests(): void {
  resetSharedStorageManagerForTests();
}

export function zeroizeBuffer(buffer: Uint8Array): void {
  buffer.fill(0);
}

export async function verifyVaultPassword(password: string): Promise<boolean> {
  const verifier = new SecureStorageManager(createStorageAdapter());
  const unlocked = await verifier.unlock(password);
  verifier.lock();
  return unlocked;
}

async function ensureStorageAccess(
  storageManager: StorageManagerInstance,
  password: string,
  requirePassword: boolean
): Promise<void> {
  if (requirePassword) {
    if (!password) {
      throw new VaultExportError('Enter your password.');
    }

    const valid = await verifyVaultPassword(password);
    if (!valid) {
      throw new VaultExportError('Incorrect password.');
    }
  } else if (!storageManager.isUnlocked) {
    throw new VaultExportError('Wallet is locked. Unlock your wallet first.');
  }

  if (!storageManager.isUnlocked) {
    if (!password) {
      throw new VaultExportError('Wallet is locked.');
    }

    const unlocked = await storageManager.unlock(password);
    if (!unlocked) {
      throw new VaultExportError('Incorrect password.');
    }
  }
}

export async function revealVaultSecret(options: {
  kind: VaultExportKind;
  password: string;
  requirePassword: boolean;
  storageManager?: StorageManagerInstance;
}): Promise<string> {
  const { kind, password, requirePassword, storageManager = getVaultStorageManager() } = options;

  await ensureStorageAccess(storageManager, password, requirePassword);

  const account = (await storageManager.getAccount()) as VaultAccountData | null;
  if (!account) {
    throw new VaultExportError('No wallet found.');
  }

  if (kind === 'privateKey') {
    if (typeof account.privateKey !== 'string' || account.privateKey.length === 0) {
      throw new VaultExportError('Private key is unavailable.');
    }
    return account.privateKey;
  }

  if (typeof account.mnemonic === 'string' && account.mnemonic.length > 0) {
    return account.mnemonic;
  }

  if (!account.encryptedMnemonic) {
    throw new VaultExportError('Recovery phrase is unavailable.');
  }

  if (!password) {
    throw new VaultExportError('Enter your password to decrypt the recovery phrase.');
  }

  try {
    return await decryptSecretKey(account.encryptedMnemonic, password);
  } catch {
    throw new VaultExportError('Incorrect password.');
  }
}
