import { xdr, Keypair, authorizeEntry } from '@stellar/stellar-sdk';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlockedAsync } from '../session-state';
import { getSigningKeypair } from '../signing-key';
import { getSettingsState } from '@/stores/settings';
import { NETWORK_PASSPHRASES, type StellarNetwork } from '@ancore/wallet-shared';

export interface SignAuthEntryParams {
  authEntryXdr: string;
  networkPassphrase?: string;
}

export interface SignAuthEntryResult {
  /** Signed authorization entry as base64-encoded SorobanAuthorizationEntry XDR. */
  signedAuthEntry: string;
}

/**
 * Validate and sign a Soroban authorization entry XDR (SEP-43).
 *
 * 1. Validates the authEntryXdr is valid base64-encoded SorobanAuthorizationEntry XDR
 * 2. Checks the wallet is unlocked
 * 3. Validates the network passphrase matches the active network
 * 4. Signs the auth entry with the owner keypair
 * 5. Returns { signedAuthEntry: string } containing the full signed entry XDR with embedded signature
 *
 * Used by both the internal popup ↔ background message path and the
 * service-worker approval resolution path.
 */
export async function signAuthEntry(params: SignAuthEntryParams): Promise<SignAuthEntryResult> {
  const { authEntryXdr, networkPassphrase } = params;

  // 1. Validate authEntryXdr is present and non-empty
  if (!authEntryXdr || typeof authEntryXdr !== 'string' || authEntryXdr.trim().length === 0) {
    throw new Error('Invalid auth entry XDR');
  }

  // 2. Check wallet unlocked
  if (!(await isBackgroundSessionUnlockedAsync())) {
    throw new Error('Wallet is locked');
  }

  // 3. Validate network passphrase matches active network
  const { network } = getSettingsState();
  const activePassphrase = NETWORK_PASSPHRASES[network as StellarNetwork];
  const defaultPassphrase = NETWORK_PASSPHRASES.testnet;
  const expectedPassphrase = networkPassphrase ?? defaultPassphrase;

  if (activePassphrase && expectedPassphrase !== activePassphrase) {
    throw new Error('Network passphrase mismatch');
  }

  // 4. Decode and validate SorobanAuthorizationEntry XDR
  let authEntry: xdr.SorobanAuthorizationEntry;
  try {
    authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryXdr.trim(), 'base64');
  } catch {
    throw new Error('Invalid auth entry XDR');
  }

  // 5. Sign the auth entry with the owner keypair.
  //
  // Uses the SDK's own `authorizeEntry` helper rather than constructing the
  // signed SorobanAuthorizationEntry by hand: the correct signature payload
  // (network id || entry XDR, hashed) and the correct on-chain signature
  // encoding (a Vec<Map> of {public_key, signature}, per Soroban's standard
  // account auth convention) are exactly what that helper already does, and
  // getting either wrong produces a signature that looks well-formed but is
  // rejected — or worse, silently mis-authorizes — at __check_auth time.
  const kp: Keypair = await getSigningKeypair();

  if (authEntry.credentials().switch().name !== 'sorobanCredentialsAddress') {
    throw new Error('Only address-based authorization entries can be signed here');
  }
  const validUntilLedgerSeq = authEntry.credentials().address().signatureExpirationLedger();

  const signedEntry = await authorizeEntry(authEntry, kp, validUntilLedgerSeq, expectedPassphrase);
  const signedAuthEntry = signedEntry.toXDR('base64');

  return { signedAuthEntry };
}

/**
 * Register the internal SIGN_AUTH_ENTRY handler for popup ↔ background messages.
 */
export function registerSignAuthEntryHandlers(): void {
  registerHandler('SIGN_AUTH_ENTRY', async (params: SignAuthEntryParams) => {
    return signAuthEntry(params);
  });
}
