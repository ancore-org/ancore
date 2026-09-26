import { xdr, Keypair, hash as stellarHash } from '@stellar/stellar-sdk';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlocked } from '../session-state';
import { getSigningKeypair } from '../signing-key';
import { getSettingsState } from '@/stores/settings';
import { NETWORK_PASSPHRASES, type StellarNetwork } from '@ancore/wallet-shared';

// Buffer is provided by the extension polyfill (see polyfills.ts).
// In tests, vitest runs in a Node environment where Buffer is native.
declare const Buffer: typeof import('buffer').Buffer;

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
  if (!isBackgroundSessionUnlocked()) {
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

  // 5. Sign the auth entry with the owner keypair
  const kp: Keypair = await getSigningKeypair();

  // Sign the hash of (networkId || authEntry bytes) — the SEP-43 signature payload.
  const networkId = stellarHash(Buffer.from(expectedPassphrase));
  const entryBytes = authEntry.toXDR();
  const payload = Buffer.concat([networkId, entryBytes]);
  const signatureHash = stellarHash(payload);
  const signature = kp.sign(signatureHash);

  // Build a fully-formed SorobanAuthorizationEntry with embedded signature
  const signatureXdr = xdr.ScVal.scvBytes(signature);
  const addressCredentials = xdr.SorobanAddressCredentials.sorobanAddressCredentialsSignature(signatureXdr);
  const credentials = xdr.SorobanCredentials.sorobanCredentialsAddress(addressCredentials);
  
  // Create new signed entry with the credentials
  const signedEntry = new xdr.SorobanAuthorizationEntry({
    credentials,
    rootInvocation: authEntry.rootInvocation(),
  });

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
