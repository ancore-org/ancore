import { TransactionBuilder } from '@stellar/stellar-sdk';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../session-state';
import { getSigningKeypair } from '../signing-key';
import { getSettingsState } from '@/stores/settings';
import { NETWORK_PASSPHRASES, type StellarNetwork } from '@ancore/wallet-shared';

const HARDWARE_STORE_KEY = 'ancore_hardware_wallet';

interface PersistedHardwareState {
  state?: {
    signerMode?: 'software' | 'ledger';
    ledgerPublicKey?: string;
  };
}

async function isHardwareSignerPreferred(): Promise<boolean> {
  try {
    const chromeRef = (globalThis as { chrome?: typeof chrome }).chrome;
    if (chromeRef?.storage?.local) {
      const result = await new Promise<Record<string, unknown>>((resolve) => {
        chromeRef.storage!.local.get(HARDWARE_STORE_KEY, resolve);
      });
      const raw = result[HARDWARE_STORE_KEY];
      if (typeof raw !== 'string') return false;
      const parsed = JSON.parse(raw) as PersistedHardwareState;
      return parsed.state?.signerMode === 'ledger' && Boolean(parsed.state?.ledgerPublicKey);
    }
  } catch {
    // Fall through to software signing.
  }
  return false;
}

export interface SignTransactionInput {
  xdr: string;
  networkPassphrase?: string;
}

export type SignTransactionOutput =
  | { signedXdr: string }
  | { requiresHardware: true; xdr: string; networkPassphrase: string };

/**
 * Validate and sign a transaction XDR with the account owner's real keypair.
 *
 * Used by both the internal popup ↔ background message path
 * (`registerSignTransactionHandlers`) and the external dApp approval-resolution
 * path (`service-worker.ts`'s `APPROVE_SIGN_REQUEST` listener) — mirrors the
 * shared-function shape already used by `signAuthEntry`.
 */
export async function signTransaction({
  xdr,
  networkPassphrase,
}: SignTransactionInput): Promise<SignTransactionOutput> {
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

  // Never export the software seed when Ledger is the preferred signer.
  // WebHID signing must happen in the popup / approval document.
  if (await isHardwareSignerPreferred()) {
    return {
      requiresHardware: true as const,
      xdr,
      networkPassphrase: expectedPassphrase,
    };
  }

  const kp = await getSigningKeypair();
  const tx = TransactionBuilder.fromXDR(xdr, expectedPassphrase);

  // AA path: When tx targets smart account execute contract invocation envelope,
  // coordinate with @ancore/account-abstraction signing contract — document owner-key vs session-key decision

  tx.sign(kp);
  return { signedXdr: tx.toXDR() };
}

export function registerSignTransactionHandlers(): void {
  registerHandler('SIGN_TRANSACTION', async (params) => signTransaction(params));
}
