import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptSecretKey } from '@ancore/crypto';
import { SecureStorageManager, type StorageAdapter } from '@ancore/core-sdk';

import {
  VaultExportError,
  changeVaultPassword,
  getVaultStorageManager,
  revealVaultSecret,
  resetVaultStorageManagerForTests,
  verifyVaultPassword,
  zeroizeBuffer,
} from '../vault-export';
import { getSharedStorageManager } from '../storage-manager';

class MockStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  clearStore(): void {
    this.store.clear();
  }
}

const PASSWORD = 'SecurePass123!';
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PRIVATE_KEY = 'SABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789012345678901234567890ABCD';

async function seedVaultAccount(
  storage: MockStorageAdapter,
  account: {
    privateKey: string;
    mnemonic?: string;
    encryptedMnemonic?: Awaited<ReturnType<typeof encryptSecretKey>>;
  }
): Promise<SecureStorageManager> {
  const manager = new SecureStorageManager(storage);
  const unlocked = await manager.unlock(PASSWORD);
  if (!unlocked) {
    throw new Error('seedVaultAccount: unlock failed unexpectedly');
  }
  await manager.saveAccount(account);
  manager.lock();
  return manager;
}

describe('vault-export', () => {
  let storage: MockStorageAdapter;

  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    storage = new MockStorageAdapter();
    resetVaultStorageManagerForTests(storage);
  });

  afterEach(() => {
    resetVaultStorageManagerForTests();
  });

  it('verifies the wallet password against secure storage', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });

    await expect(verifyVaultPassword(PASSWORD, { storage })).resolves.toBe(true);
    await expect(verifyVaultPassword('wrong-password', { storage })).resolves.toBe(false);
  });

  it('reveals a private key after password verification', async () => {
    const manager = await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });

    await expect(
      revealVaultSecret({
        kind: 'privateKey',
        password: PASSWORD,
        requirePassword: true,
        storageManager: manager,
      })
    ).resolves.toBe(PRIVATE_KEY);
  });

  it('reveals a stored mnemonic when secure storage is already unlocked', async () => {
    const manager = await seedVaultAccount(storage, {
      privateKey: PRIVATE_KEY,
      mnemonic: MNEMONIC,
    });

    await manager.unlock(PASSWORD);

    await expect(
      revealVaultSecret({
        kind: 'mnemonic',
        password: '',
        requirePassword: false,
        storageManager: manager,
      })
    ).resolves.toBe(MNEMONIC);
  });

  it('decrypts an encrypted mnemonic with @ancore/crypto after password verification', async () => {
    const encryptedMnemonic = await encryptSecretKey(MNEMONIC, PASSWORD);
    const manager = await seedVaultAccount(storage, {
      privateKey: PRIVATE_KEY,
      encryptedMnemonic,
    });

    await expect(
      revealVaultSecret({
        kind: 'mnemonic',
        password: PASSWORD,
        requirePassword: true,
        storageManager: manager,
      })
    ).resolves.toBe(MNEMONIC);
  });

  it('rejects incorrect passwords without exposing secret material', async () => {
    const encryptedMnemonic = await encryptSecretKey(MNEMONIC, PASSWORD);
    await seedVaultAccount(storage, {
      privateKey: PRIVATE_KEY,
      encryptedMnemonic,
    });

    await expect(
      revealVaultSecret({
        kind: 'mnemonic',
        password: 'wrong-password',
        requirePassword: true,
        storageManager: new SecureStorageManager(storage),
      })
    ).rejects.toMatchObject({
      name: 'VaultExportError',
      message: 'Incorrect password.',
    });
  });

  it('requires an unlocked wallet when password checks are disabled', async () => {
    await seedVaultAccount(storage, {
      privateKey: PRIVATE_KEY,
      mnemonic: MNEMONIC,
    });

    await expect(
      revealVaultSecret({
        kind: 'mnemonic',
        password: '',
        requirePassword: false,
        storageManager: new SecureStorageManager(storage),
      })
    ).rejects.toBeInstanceOf(VaultExportError);
  });

  it('uses the shared unlocked storage manager when password checks are disabled', async () => {
    resetVaultStorageManagerForTests(storage);
    const manager = getSharedStorageManager();
    await manager.unlock(PASSWORD);
    await manager.saveAccount({
      privateKey: PRIVATE_KEY,
      mnemonic: MNEMONIC,
    });

    await expect(
      revealVaultSecret({
        kind: 'privateKey',
        password: '',
        requirePassword: false,
        storageManager: manager,
      })
    ).resolves.toBe(PRIVATE_KEY);
  });

  it('zeroizes every byte of a non-empty buffer', () => {
    const buffer = new Uint8Array([1, 2, 3, 255]);

    zeroizeBuffer(buffer);

    expect(Array.from(buffer)).toEqual([0, 0, 0, 0]);
  });

  it('zeroizes an empty buffer without throwing', () => {
    const buffer = new Uint8Array(0);

    expect(() => zeroizeBuffer(buffer)).not.toThrow();
    expect(buffer.length).toBe(0);
  });

  it('locks the temporary verifier after a successful password check', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });

    await expect(verifyVaultPassword(PASSWORD, { storage })).resolves.toBe(true);

    const verifier = new SecureStorageManager(storage);
    expect(verifier.isUnlocked()).toBe(false);
  });

  it('locks the temporary verifier after a failed password check', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });

    await expect(verifyVaultPassword('wrong-password', { storage })).resolves.toBe(false);

    const verifier = new SecureStorageManager(storage);
    expect(verifier.isUnlocked()).toBe(false);
  });

  it('changes the vault password when the current password is correct', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });
    const newPassword = 'NewSecurePass456!';

    await expect(
      changeVaultPassword({
        currentPassword: PASSWORD,
        newPassword,
        storage,
      })
    ).resolves.toBeUndefined();

    await expect(verifyVaultPassword(newPassword, { storage })).resolves.toBe(true);
    await expect(verifyVaultPassword(PASSWORD, { storage })).resolves.toBe(false);
  });

  it('wraps errors from changeVaultPassword in VaultExportError', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });

    await expect(
      changeVaultPassword({
        currentPassword: 'wrong-password',
        newPassword: 'NewSecurePass456!',
        storage,
      })
    ).rejects.toBeInstanceOf(VaultExportError);
  });

  it('wraps thrown errors from the storage manager in VaultExportError', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });
    const manager = new SecureStorageManager(storage);
    manager.changePassword = async () => {
      throw new Error('boom');
    };

    await expect(
      changeVaultPassword({
        currentPassword: PASSWORD,
        newPassword: 'NewSecurePass456!',
        storageManager: manager,
      })
    ).rejects.toBeInstanceOf(VaultExportError);
  });

  it('rejects an empty password when a password is required', async () => {
    await seedVaultAccount(storage, { privateKey: PRIVATE_KEY });

    await expect(
      revealVaultSecret({
        kind: 'privateKey',
        password: '',
        requirePassword: true,
        storageManager: new SecureStorageManager(storage),
      })
    ).rejects.toMatchObject({
      name: 'VaultExportError',
      message: 'Enter your password.',
    });
  });

  it('returns the shared vault storage manager instance', () => {
    const first = getVaultStorageManager();
    const second = getVaultStorageManager();

    expect(first).toBe(second);
    expect(first).toBe(getSharedStorageManager());
  });
});
