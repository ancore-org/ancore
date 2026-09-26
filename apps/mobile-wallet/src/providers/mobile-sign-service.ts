import { Buffer } from 'buffer';
import { xdr, Keypair, TransactionBuilder, hash as stellarHash } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASES, type StellarNetwork } from '@ancore/wallet-shared';
import { createStellarClient } from '@ancore/stellar';
import type { Network } from '@ancore/types';

import { getSigningKeypair } from '../security/signing-key';
import type { SignService } from './stellar-handlers';

export interface CreateVaultSignServiceOptions {
  network?: Network;
  networkPassphrase?: string;
}

function resolveNetworkPassphrase(network: Network, override?: string): string {
  if (override) {
    return override;
  }

  if (network === 'local') {
    return NETWORK_PASSPHRASES.local;
  }

  return NETWORK_PASSPHRASES[network as StellarNetwork] ?? NETWORK_PASSPHRASES.testnet;
}

/**
 * Production WalletConnect sign service backed by the unlocked mobile vault.
 */
export function createVaultSignService(options: CreateVaultSignServiceOptions = {}): SignService {
  const network = options.network ?? 'testnet';
  const networkPassphrase = resolveNetworkPassphrase(network, options.networkPassphrase);
  const stellarClient = createStellarClient(network);

  return {
    async signTransaction(xdrPayload: string) {
      const kp: Keypair = await getSigningKeypair();
      const tx = TransactionBuilder.fromXDR(xdrPayload, networkPassphrase);
      tx.sign(kp);
      return { signedXdr: tx.toXDR() };
    },

    async submitTransaction(signedXdr: string) {
      const response = await stellarClient.submitTransaction(signedXdr);
      return { txHash: response.hash };
    },

    async signMessage(message: string) {
      if (!message) {
        throw new Error('Invalid message');
      }

      const kp = await getSigningKeypair();
      const signature = kp.sign(Buffer.from(message, 'utf8'));
      return { signature: Buffer.from(signature).toString('hex') };
    },

    async signAuthEntry(authEntry: string) {
      if (!authEntry?.trim()) {
        throw new Error('Invalid auth entry XDR');
      }

      let entry: xdr.SorobanAuthorizationEntry;
      try {
        entry = xdr.SorobanAuthorizationEntry.fromXDR(authEntry.trim(), 'base64');
      } catch {
        throw new Error('Invalid auth entry XDR');
      }

      const kp = await getSigningKeypair();
      const networkId = stellarHash(Buffer.from(networkPassphrase));
      const entryBytes = entry.toXDR();
      const payload = Buffer.concat([networkId, entryBytes]);
      const signatureHash = stellarHash(payload);
      const signature = kp.sign(signatureHash);

      return { signedAuthEntry: Buffer.from(signature).toString('base64') };
    },
  };
}
