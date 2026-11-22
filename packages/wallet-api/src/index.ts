/**
 * Public dApp API surface.
 *
 * Methods mirror Freighter's @stellar/freighter-api with Ancore AA extensions.
 * Handlers are implemented in the extension background — see docs/wallets/FREIGHTER_COMPARISON.md.
 */

import { ExternalApiMethod } from '@ancore/wallet-shared';
import type { RequestSessionKeyResult, SessionKeyPolicy } from '@ancore/types';
import {
  parsePolicyValidationError,
  sendExternalRequest,
  SessionKeyPolicyValidationError,
  WalletApiError,
  WalletNotInstalledError,
} from './bridge';

/**
 * Stellar networks exposed to dApps via getNetwork().
 *
 * Mirrors the `Network` union in @ancore/types — the extension supports
 * futurenet and local alongside mainnet/testnet, so narrowing this to two
 * values made getNetwork() misreport those networks to typed callers.
 */
export type WalletNetwork = 'mainnet' | 'testnet' | 'futurenet' | 'local';

const WALLET_NETWORKS: readonly WalletNetwork[] = ['mainnet', 'testnet', 'futurenet', 'local'];

/** Narrows an arbitrary background value to a supported WalletNetwork. */
export function isWalletNetwork(value: unknown): value is WalletNetwork {
  return typeof value === 'string' && (WALLET_NETWORKS as readonly string[]).includes(value);
}

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

interface BackgroundGetAddressResult {
  address: string;
  network?: string;
  ownerPublicKey?: string;
}

interface BackgroundGetNetworkResult {
  network: string;
  networkPassphrase?: string;
}

interface BackgroundIsConnectedResult {
  connected: boolean;
}

interface BackgroundRequestAccessResult {
  smartAccountId: string;
  network: string;
  ownerPublicKey?: string;
}

/**
 * Prompt user to connect the dApp to their smart account (Freighter: requestAccess).
 */
export async function requestAccess(): Promise<RequestAccessResult> {
  return sendExternalRequest<RequestAccessResult>(ExternalApiMethod.REQUEST_ACCESS);
}

/**
 * Connect the dApp to the wallet. Opens approval when not yet allowlisted.
 * Resolves with the smart account C-address on success.
 */
export async function connect(): Promise<string> {
  const result = await sendExternalRequest<BackgroundRequestAccessResult>(
    ExternalApiMethod.CONNECT
  );
  return result.smartAccountId;
}

/** Returns connected smart account C-address without prompting if already allowed. */
export async function getAddress(): Promise<GetAddressResult> {
  try {
    const result = await sendExternalRequest<BackgroundGetAddressResult>(
      ExternalApiMethod.GET_ADDRESS,
      {},
      500
    );
    return {
      smartAccountId: result.address,
      ownerPublicKey: result.ownerPublicKey,
    };
  } catch (error) {
    if (error instanceof WalletApiError && error.message.includes('timed out')) {
      throw new WalletNotInstalledError();
    }
    throw error;
  }
}

/**
 * Returns the wallet's active Stellar network.
 *
 * The background value is validated rather than cast, so an unrecognised
 * network surfaces as an error instead of a value that lies about its type.
 */
export async function getNetwork(): Promise<WalletNetwork> {
  const result = await sendExternalRequest<BackgroundGetNetworkResult>(
    ExternalApiMethod.GET_NETWORK
  );
  if (!isWalletNetwork(result.network)) {
    throw new WalletApiError(`Unsupported wallet network: ${String(result.network)}`);
  }
  return result.network;
}

/** Whether the current origin is allowlisted for the active account. */
export async function isConnected(): Promise<boolean> {
  try {
    const result = await sendExternalRequest<BackgroundIsConnectedResult>(
      ExternalApiMethod.IS_CONNECTED,
      {},
      500
    );
    return result.connected;
  } catch (error) {
    if (error instanceof WalletApiError && error.message.includes('timed out')) {
      return false;
    }
    throw error;
  }
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
}): Promise<{ signedAuthEntry: string }> {
  return sendExternalRequest(ExternalApiMethod.SIGN_AUTH_ENTRY, params);
}

/**
 * Sign an arbitrary message (SEP-53 style).
 *
 * The background resolves this with `{ signature }` (hex-encoded), not
 * `{ signedMessage }` — read the real field and re-shape it for the public
 * API so existing/future callers of `signedMessage` keep working.
 */
export async function signMessage(params: {
  message: string;
  networkPassphrase?: string;
}): Promise<{ signedMessage: string }> {
  const result = await sendExternalRequest<{ signature: string }>(
    ExternalApiMethod.SIGN_MESSAGE,
    params
  );
  return { signedMessage: result.signature };
}

export interface SessionKeyRequestPolicy extends SessionKeyPolicy {
  /** Optional cumulative spend cap per window (stroops / smallest unit string). */
  cumulativeLimit?: string;
  /** Length of the cumulative spend window in seconds when cumulativeLimit is set. */
  spendWindowSeconds?: number;
  /** Optional target network override. */
  network?: WalletNetwork;
  /** Optional smart-account contract ID override. */
  smartAccountId?: string;
}

const VALID_PERMISSION_MASK = 0b111;

function validateSessionKeyRequestPolicy(policy: SessionKeyRequestPolicy): void {
  if (!policy || typeof policy !== 'object') {
    throw new SessionKeyPolicyValidationError(
      'INVALID_EXPIRES_AT',
      'Policy must be a valid object',
      'expiresAt'
    );
  }

  if (
    typeof policy.expiresAt !== 'number' ||
    !Number.isInteger(policy.expiresAt) ||
    policy.expiresAt <= 0
  ) {
    throw new SessionKeyPolicyValidationError(
      'INVALID_EXPIRES_AT',
      'expiresAt must be a positive integer Unix timestamp',
      'expiresAt'
    );
  }

  const expiresAtSec =
    policy.expiresAt > 1e11 ? Math.floor(policy.expiresAt / 1000) : policy.expiresAt;
  if (expiresAtSec <= Date.now() / 1000) {
    throw new SessionKeyPolicyValidationError(
      'EXPIRED',
      'expiresAt must be in the future',
      'expiresAt'
    );
  }

  if (
    typeof policy.permissions !== 'number' ||
    !Number.isInteger(policy.permissions) ||
    policy.permissions <= 0 ||
    (policy.permissions & ~VALID_PERMISSION_MASK) !== 0
  ) {
    throw new SessionKeyPolicyValidationError(
      'INVALID_PERMISSION',
      'permissions must be a non-zero permission bitmask within supported bounds',
      'permissions'
    );
  }

  if (policy.allowedContracts !== undefined) {
    if (!Array.isArray(policy.allowedContracts)) {
      throw new SessionKeyPolicyValidationError(
        'INVALID_ALLOWED_CONTRACTS',
        'allowedContracts must be an array of contract IDs',
        'allowedContracts'
      );
    }
    for (const contractId of policy.allowedContracts) {
      if (typeof contractId !== 'string' || !/^C[A-Z2-7]{55}$/.test(contractId)) {
        throw new SessionKeyPolicyValidationError(
          'INVALID_ALLOWED_CONTRACTS',
          `Invalid contract address in allowlist: ${String(contractId)}`,
          'allowedContracts'
        );
      }
    }
  }

  const checkPositiveIntString = (
    value: string | undefined,
    field: 'maxAmountPerCall' | 'cumulativeLimit'
  ): void => {
    if (value === undefined) return;
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim()) || BigInt(value.trim()) <= 0n) {
      throw new SessionKeyPolicyValidationError(
        'INVALID_AMOUNT',
        `${field} must be a positive integer amount`,
        field
      );
    }
  };
  checkPositiveIntString(policy.maxAmountPerCall, 'maxAmountPerCall');
  checkPositiveIntString(policy.cumulativeLimit, 'cumulativeLimit');

  const hasCumulativeLimit = policy.cumulativeLimit !== undefined;
  if (policy.spendWindowSeconds !== undefined) {
    if (!Number.isInteger(policy.spendWindowSeconds) || policy.spendWindowSeconds < 0) {
      throw new SessionKeyPolicyValidationError(
        'INVALID_SPEND_WINDOW',
        'spendWindowSeconds must be a non-negative integer',
        'spendWindowSeconds'
      );
    }
    if (policy.spendWindowSeconds > 0 && !hasCumulativeLimit) {
      throw new SessionKeyPolicyValidationError(
        'INVALID_SPEND_WINDOW',
        'spendWindowSeconds requires cumulativeLimit',
        'spendWindowSeconds'
      );
    }
    if (policy.spendWindowSeconds === 0 && hasCumulativeLimit) {
      throw new SessionKeyPolicyValidationError(
        'INVALID_SPEND_WINDOW',
        'spendWindowSeconds must be greater than 0 when cumulativeLimit is set',
        'spendWindowSeconds'
      );
    }
  } else if (hasCumulativeLimit) {
    throw new SessionKeyPolicyValidationError(
      'INVALID_SPEND_WINDOW',
      'spendWindowSeconds must be greater than 0 when cumulativeLimit is set',
      'spendWindowSeconds'
    );
  }
}

/**
 * Request a scoped session key from the user's smart account.
 * Opens an approval screen showing duration, allowed contracts, and spend limits.
 */
export async function requestSessionKey(
  policy: SessionKeyRequestPolicy
): Promise<RequestSessionKeyResult> {
  validateSessionKeyRequestPolicy(policy);
  try {
    return await sendExternalRequest<RequestSessionKeyResult>(
      ExternalApiMethod.REQUEST_SESSION_KEY,
      policy as unknown as Record<string, unknown>
    );
  } catch (error) {
    if (error instanceof WalletApiError && !(error instanceof SessionKeyPolicyValidationError)) {
      const typedError = parsePolicyValidationError(error.message);
      if (typedError) {
        throw typedError;
      }
    }
    throw error;
  }
}

/**
 * Sign a relay envelope for the platform relayer's `/relay/execute` endpoint
 * (issue #1213). The wallet computes its own sessionKey (its real public
 * key) and canonical payload internally, signs it, and returns both fields
 * atomically — the caller never needs a separate "get my public key" step.
 */
export async function signRelayPayload(params: {
  operation: string;
  nonce: number;
  to: string;
  amount: string;
  asset: string;
}): Promise<{ sessionKey: string; signature: string }> {
  return sendExternalRequest(ExternalApiMethod.SIGN_RELAY_PAYLOAD, params);
}

export type { SessionKeyPolicy, RequestSessionKeyResult } from '@ancore/types';

export {
  SessionKeyPolicyValidationError,
  type SessionKeyPolicyErrorCode,
  WalletApiError,
  WalletNotInstalledError,
} from './bridge';
