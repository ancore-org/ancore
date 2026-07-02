import { Keypair } from '@stellar/stellar-sdk';
import { getSharedStorageManager } from '../security/storage-manager';
import type { AccountData } from '@ancore/core-sdk';

interface VaultAccountData extends AccountData {
  privateKey?: string;
}

export async function getSigningKeypair(): Promise<Keypair> {
  const manager = getSharedStorageManager();
  const account = (await manager.getAccount()) as VaultAccountData | null;
  if (!account || !account.privateKey) {
    throw new Error('No account found in vault');
  }
  return Keypair.fromSecret(account.privateKey);
}
