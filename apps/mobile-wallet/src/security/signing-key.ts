import { deriveKeypairFromMnemonic, validateMnemonic } from '@ancore/crypto';
import { Keypair } from '@stellar/stellar-sdk';

import { getSharedStorageManager } from './storage-manager';

interface VaultAccountData {
  privateKey?: string;
  publicKey?: string;
}

/**
 * Resolve the active signing keypair from the unlocked vault.
 * Vault stores the BIP39 mnemonic as `privateKey` (extension parity).
 */
export async function getSigningKeypair(): Promise<Keypair> {
  const manager = getSharedStorageManager();

  if (!manager.isUnlocked) {
    throw new Error('Wallet is locked');
  }

  const account = (await manager.getAccount()) as VaultAccountData | null;
  if (!account?.privateKey) {
    throw new Error('No account found in vault');
  }

  const keyMaterial = account.privateKey.trim();

  if (keyMaterial.startsWith('S') && keyMaterial.length >= 56) {
    return Keypair.fromSecret(keyMaterial);
  }

  if (!validateMnemonic(keyMaterial)) {
    throw new Error('Invalid key material in vault');
  }

  return deriveKeypairFromMnemonic(keyMaterial, 0);
}
