import { createAccountPersistence, importWallet } from '@ancore/core-sdk';

import { getSharedStorageManager } from '../security/storage-manager';

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

  // Unlock the vault with the password
  const storageManager = getSharedStorageManager();
  const unlocked = await storageManager.unlock(password);

  if (!unlocked) {
    throw new Error('Failed to unlock vault after onboarding');
  }

  // Persist account using the new unified API
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
