import { TransactionBuilder } from '@stellar/stellar-sdk';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../session-state';
import { getSigningKeypair } from '../signing-key';
import { getSettingsState } from '@/stores/settings';
import { NETWORK_PASSPHRASES, type StellarNetwork } from '@ancore/wallet-shared';

export function registerSignTransactionHandlers(): void {
  registerHandler('SIGN_TRANSACTION', async ({ xdr, networkPassphrase }) => {
    if (!isBackgroundSessionUnlocked()) {
      throw new Error('Wallet is locked');
    }

    const { network } = getSettingsState();
    const activePassphrase = NETWORK_PASSPHRASES[network as StellarNetwork];
    const defaultPassphrase = NETWORK_PASSPHRASES.testnet;

    const expectedPassphrase = networkPassphrase ?? defaultPassphrase;
    if (activePassphrase && expectedPassphrase !== activePassphrase) {
      throw new Error('Network passphrase mismatch');
    }

    const kp = await getSigningKeypair();
    const tx = TransactionBuilder.fromXDR(xdr, expectedPassphrase);

    // AA path: When tx targets smart account execute contract invocation envelope,
    // coordinate with @ancore/account-abstraction signing contract — document owner-key vs session-key decision

    tx.sign(kp);
    return { signedXdr: tx.toXDR() };
  });
}
