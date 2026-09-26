import { createAccountPersistence, importWallet } from '@ancore/core-sdk';

import { getSharedStorageManager, unlockSharedStorageManager } from '../security/storage-manager';

export interface PersistOnboardedWalletParams {
  mnemonic: string;
  password: string;
  label?: string;
  accountId?: string;
}

/**
 * Encrypts and persists wallet material after onboarding password entry.
 * Uses the shared SecureStorageManager and AccountPersistence from @ancore/core-sdk
 * to support multiple accounts and maintain feature parity with the extension.
 */
export async function persistOnboardedWallet({
  mnemonic,
  password,
  label = 'Ancore Wallet',
  accountId = 'primary',
}: PersistOnboardedWalletParams): Promise<void> {
  // Generate wallet material with encrypted mnemonic
  const wallet = await importWallet({ mnemonic, password });

  // Unlock via the migration-safe wrapper so legacy vault data is migrated
  // before account persistence reads from it (#1370).
  const unlocked = await unlockSharedStorageManager(password);

  if (!unlocked) {
    throw new Error('Failed to unlock vault after onboarding');
  }

  // Persist account using the new unified API
  const storageManager = getSharedStorageManager();
  const accountPersistence = createAccountPersistence(storageManager);
  if (!wallet.encryptedMnemonic) {
    throw new Error('Failed to encrypt mnemonic');
  }

  await accountPersistence.persistAccount({
    id: accountId,
    address: wallet.publicKey,
    label,
    keyMaterial: JSON.stringify(wallet.encryptedMnemonic),
    accountPayload: {
      publicKey: wallet.publicKey,
      contractId: wallet.contractId,
      accountIndex: wallet.accountIndex,
    },
  });
}
