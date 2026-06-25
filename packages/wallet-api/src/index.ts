/**
 * Public dApp API surface.
 *
 * Methods mirror Freighter's @stellar/freighter-api with Ancore AA extensions.
 * Handlers are implemented in the extension background — see docs/wallets/FREIGHTER_COMPARISON.md.
 */

import { ExternalApiMethod } from '@ancore/wallet-shared';
import { sendExternalRequest } from './bridge';

export interface RequestAccessResult {
  smartAccountId: string;
  /** Owner G-address derived from mnemonic (for display / Horizon lookups). */
  ownerPublicKey?: string;
  network: string;
}

export interface GetAddressResult {
  smartAccountId: string;
  ownerPublicKey?: string;
}

export interface SignTransactionParams {
  xdr: string;
  networkPassphrase?: string;
  /** When true, submit via relayer after sign (AA path). */
  submitViaRelayer?: boolean;
}

export interface SignTransactionResult {
  signedXdr: string;
  txHash?: string;
}

/**
 * Prompt user to connect the dApp to their smart account (Freighter: requestAccess).
 */
export async function requestAccess(): Promise<RequestAccessResult> {
  return sendExternalRequest<RequestAccessResult>(ExternalApiMethod.REQUEST_ACCESS);
}

/** Returns connected smart account id without prompting if already allowed. */
export async function getAddress(): Promise<GetAddressResult> {
  return sendExternalRequest<GetAddressResult>(ExternalApiMethod.GET_ADDRESS);
}

/** Ancore-specific: full smart account metadata including deployment status. */
export async function getSmartAccount(): Promise<GetAddressResult & { deployed: boolean }> {
  return sendExternalRequest(ExternalApiMethod.GET_SMART_ACCOUNT);
}

/** Sign a transaction XDR. User approval required in extension popup/side panel. */
export async function signTransaction(
  params: SignTransactionParams
): Promise<SignTransactionResult> {
  return sendExternalRequest<SignTransactionResult>(ExternalApiMethod.SIGN_TRANSACTION, {
    xdr: params.xdr,
    networkPassphrase: params.networkPassphrase,
    submitViaRelayer: params.submitViaRelayer,
  });
}

/** Sign a Soroban auth entry (SEP-43). Required for many Soroban dApps. */
export async function signAuthEntry(params: {
  authEntryXdr: string;
  networkPassphrase?: string;
}): Promise<{ signedAuthEntryXdr: string }> {
  return sendExternalRequest(ExternalApiMethod.SIGN_AUTH_ENTRY, params);
}

/** Sign an arbitrary message (SEP-53 style). */
export async function signMessage(params: {
  message: string;
  networkPassphrase?: string;
}): Promise<{ signedMessage: string }> {
  return sendExternalRequest(ExternalApiMethod.SIGN_MESSAGE, params);
}

export { WalletApiError, WalletNotInstalledError } from './bridge';
