import { webcrypto } from 'crypto';
import { MemorySecureStoreAdapter } from '../../storage';
import { MobileSecureVault } from '../mobile-secure-vault';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (!globalThis.btoa) {
  globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
}

if (!globalThis.atob) {
  globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
}

describe('MobileSecureVault', () => {
  const password = 'correct horse battery staple';

  it('persists account metadata and encrypted key material after unlock', async () => {
    const storage = new MemorySecureStoreAdapter();
    const vault = new MobileSecureVault(storage, {
      now: () => Date.parse('2026-04-23T12:00:00.000Z'),
    });

    await expect(vault.unlock(password)).resolves.toBe(true);

    const metadata = await vault.persistAccount({
      id: 'primary',
      address: 'GABC1234',
      label: 'Primary account',
      keyMaterial: 'SSECRET1234',
      accountPayload: {
        network: 'testnet',
        encryptedMemoSeed: 'memo-seed',
      },
    });

    expect(metadata).toEqual({
      id: 'primary',
      address: 'GABC1234',
      label: 'Primary account',
      createdAt: '2026-04-23T12:00:00.000Z',
      updatedAt: '2026-04-23T12:00:00.000Z',
    });

    const persistedRecords =
      await storage.get<Record<string, { encryptedSecret: { data: string } }>>(
        'mobile_vault_accounts'
      );

    expect(JSON.stringify(persistedRecords)).not.toContain('SSECRET1234');
    expect(JSON.stringify(persistedRecords)).not.toContain('memo-seed');
    expect(await vault.listAccountMetadata()).toEqual([metadata]);
    expect(await vault.loadAccount('primary')).toEqual({
      metadata,
      secret: {
        keyMaterial: 'SSECRET1234',
        accountPayload: {
          network: 'testnet',
          encryptedMemoSeed: 'memo-seed',
        },
      },
    });
  });

  it('rejects wrong passwords after the vault has been initialized', async () => {
    const storage = new MemorySecureStoreAdapter();
    const firstVault = new MobileSecureVault(storage);

    await firstVault.unlock(password);
    await firstVault.persistAccount({
      id: 'primary',
      address: 'GABC1234',
      keyMaterial: 'SSECRET1234',
      accountPayload: { network: 'testnet' },
    });
    firstVault.lock();

    const secondVault = new MobileSecureVault(storage);

    await expect(secondVault.unlock('wrong password')).resolves.toBe(false);
    expect(secondVault.isUnlocked).toBe(false);
    await expect(secondVault.loadAccount('primary')).rejects.toThrow('Vault is locked');
  });

  it('locks after the inactivity timeout elapses', async () => {
    jest.useFakeTimers();

    try {
      const storage = new MemorySecureStoreAdapter();
      const vault = new MobileSecureVault(storage, { lockTimeoutMs: 1_000 });

      await vault.unlock(password);
      expect(vault.isUnlocked).toBe(true);

      jest.advanceTimersByTime(1_001);

      expect(vault.isUnlocked).toBe(false);
      await expect(
        vault.persistAccount({
          id: 'primary',
          address: 'GABC1234',
          keyMaterial: 'SSECRET1234',
          accountPayload: {},
        })
      ).rejects.toThrow('Vault is locked');
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears persisted vault state and encrypted account data', async () => {
    const storage = new MemorySecureStoreAdapter();
    const vault = new MobileSecureVault(storage);

    await vault.unlock(password);
    await vault.persistAccount({
      id: 'primary',
      address: 'GABC1234',
      keyMaterial: 'SSECRET1234',
      accountPayload: { network: 'testnet' },
    });

    await vault.clearData();

    expect(vault.isUnlocked).toBe(false);
    await expect(storage.get('mobile_vault_state')).resolves.toBeNull();
    await expect(storage.get('mobile_vault_accounts')).resolves.toBeNull();

    const reinitializedVault = new MobileSecureVault(storage);
    await expect(reinitializedVault.unlock('new password')).resolves.toBe(true);
    await expect(reinitializedVault.listAccountMetadata()).resolves.toEqual([]);
  });
});
