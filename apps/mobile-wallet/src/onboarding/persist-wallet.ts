import { importWallet } from '@ancore/core-sdk';

import { getSharedStorageManager } from '../security/storage-manager';

export interface PersistOnboardedWalletParams {
  mnemonic: string;
  password: string;
  label?: string;
}

/**
 * Encrypts and persists wallet material after onboarding password entry.
 * Mirrors the extension vault write in `useOnboarding.deployAccount`.
 */
export async function persistOnboardedWallet({
  mnemonic,
  password,
  label = 'Ancore Wallet',
}: PersistOnboardedWalletParams): Promise<void> {
  const wallet = await importWallet({ mnemonic, password });
  const vault = getSharedStorageManager();
  const unlocked = await vault.unlock(password);

  if (!unlocked) {
    throw new Error('Failed to unlock vault after onboarding');
  }

  await vault.saveAccount({
    privateKey: mnemonic,
    publicKey: wallet.publicKey,
    contractId: wallet.contractId,
    address: wallet.publicKey,
    label,
  });
}
