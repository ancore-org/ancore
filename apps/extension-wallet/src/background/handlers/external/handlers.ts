/**
 * External API Handlers
 *
 * Implementation of individual external API method handlers.
 */

import type {
  ExternalHandlerContext,
  RequestAccessResult,
  GetAddressResult,
  GetNetworkResult,
  IsConnectedResult,
  GetSmartAccountResult,
  GetPublicKeyResult,
  SignTransactionResult,
  RequestSessionKeyResult,
  SessionKeyPolicy,
} from '@ancore/types';
import { ExternalApiMethodName as MethodName } from '@ancore/types';
import { NETWORK_PASSPHRASES } from '@ancore/wallet-shared';
import { z } from 'zod';
import { AccountContract } from '@ancore/account-abstraction';
import { rpc as StellarRpc } from '@stellar/stellar-sdk';
import { isAllowed, addToAllowlist } from './allowlist';
import {
  enqueueApproval,
  registerResponseCallbacks,
  removeApproval,
  writeSessionEntry,
} from './response-queue';
import { openApprovalWindow } from '../../approval-window';
import { getSettingsState } from '@/stores/settings';
import { readChromeLocal } from '../../chrome-api';

/** chrome.storage.local key for the deployed smart-account C-address. */
const CONTRACT_ADDRESS_KEY = 'ancore_contract_address';

// ── Validation schemas (issue #1121) ────────────────────────────────────────

const signTransactionSchema = z
  .object({
    xdr: z
      .string()
      .min(1, 'xdr is required')
      .refine((v) => v.trim().length > 0, 'xdr must not be empty'),
    network: z.string().optional(),
    smartAccountId: z.string().optional(),
  })
  .passthrough();

const signAuthEntrySchema = z
  .object({
    authEntry: z
      .string()
      .min(1, 'authEntry is required')
      .refine((v) => v.trim().length > 0, 'authEntry must not be empty'),
    network: z.string().optional(),
    smartAccountId: z.string().optional(),
  })
  .passthrough();

const signMessageSchema = z
  .object({
    message: z
      .string()
      .min(1, 'message is required')
      .refine((v) => v.trim().length > 0, 'message must not be empty'),
    network: z.string().optional(),
    smartAccountId: z.string().optional(),
  })
  .passthrough();

const requestSessionKeySchema = z
  .object({
    expiresAt: z.number().int().positive('expiresAt must be a positive integer'),
    permissions: z.number().int().nonnegative('permissions must be a non-negative integer'),
    network: z.string().optional(),
    smartAccountId: z.string().optional(),
    allowedContracts: z.array(z.string()).optional(),
    maxAmountPerCall: z.string().optional(),
  })
  .passthrough();

const readFromChromeLocal = readChromeLocal;

const DEFAULT_MOCK_SMART_ACCOUNT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Soroban RPC endpoints used for contract deployment probing. */
const SOROBAN_RPC_URLS: Record<string, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  local: 'http://localhost:8000/soroban/rpc',
};

/**
 * Probe on-chain contract existence by calling get_owner via Soroban RPC.
 * Returns 'deployed' if the contract responds, 'not_deployed' if the contract
 * doesn't exist, or 'unknown' if the RPC call fails for network/infra reasons.
 */
async function probeContractDeployment(
  contractId: string,
  network: string
): Promise<'deployed' | 'not_deployed' | 'unknown'> {
  const rpcUrl = SOROBAN_RPC_URLS[network];
  if (!rpcUrl) {
    return 'unknown';
  }

  const networkPassphrase = NETWORK_PASSPHRASES[network] ?? NETWORK_PASSPHRASES['testnet'];
  const rpcServer = new StellarRpc.Server(rpcUrl);

  try {
    const contract = new AccountContract(contractId);

    // get_owner simulation succeeds only when the contract is deployed and initialized.
    // Use a placeholder owner for simulation — the RPC validates contract existence.
    const PLACEHOLDER_OWNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

    await contract.getOwner({
      server: {
        getAccount: async (accountId: string) => {
          const account = await rpcServer.getAccount(accountId);
          return { id: account.accountId(), sequence: account.sequenceNumber() };
        },
        simulateTransaction: (tx) =>
          rpcServer.simulateTransaction(
            tx as Parameters<StellarRpc.Server['simulateTransaction']>[0]
          ),
      },
      sourceAccount: PLACEHOLDER_OWNER,
      networkPassphrase,
    });

    return 'deployed';
  } catch (error: unknown) {
    // If the contract doesn't exist, simulation fails with a contract-not-found error.
    // Network/infra errors (timeouts, DNS failures) mean we can't determine status.
    if (isContractNotFoundError(error)) {
      return 'not_deployed';
    }
    return 'unknown';
  }
}

/**
 * Detect whether an error indicates the contract was not found on-chain.
 * Soroban RPC returns contract-not-found as simulation errors with specific messages.
 */
function isContractNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const msg = error.message.toLowerCase();

  // Common Soroban RPC / simulation error patterns for missing contracts
  return (
    msg.includes('contract not found') ||
    msg.includes('no contract with this contract id') ||
    msg.includes('contractdoesnotexist') ||
    msg.includes('host object not found') ||
    msg.includes('unknown contract id') ||
    msg.includes('could not find contract')
  );
}

function resolveWalletContext(params: unknown): { network: string; smartAccountId: string } {
  const typedParams = params as { network?: string; smartAccountId?: string };
  return {
    network: typedParams.network || 'testnet',
    smartAccountId: typedParams.smartAccountId || DEFAULT_MOCK_SMART_ACCOUNT_ID,
  };
}

/**
 * requestAccess handler
 * Checks allowlist; prompts approval if new origin; returns { smartAccountId, network }
 */
export async function handleRequestAccess(
  ctx: ExternalHandlerContext
): Promise<RequestAccessResult> {
  const { origin, params } = ctx;
  const { network, smartAccountId } = resolveWalletContext(params);

  const allowed = await isAllowed(network, smartAccountId, origin);
  if (allowed) {
    return { smartAccountId, network };
  }

  enqueueApproval(ctx.requestId, origin, MethodName.REQUEST_ACCESS, params);

  await openApprovalWindow(ctx.requestId, 'grant-access');

  const approvalResult = await waitForApproval(ctx.requestId);
  if (approvalResult === undefined) {
    throw new Error('Access request was not approved.');
  }

  await addToAllowlist(network, smartAccountId, origin);

  return { smartAccountId, network };
}

export const handleConnect = handleRequestAccess;

/**
 * getAddress handler
 * Requires allowlist; returns contract id + deployment status
 */
export async function handleGetAddress(ctx: ExternalHandlerContext): Promise<GetAddressResult> {
  const { origin, params } = ctx;
  const { network, smartAccountId } = resolveWalletContext(params);

  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  return {
    address: smartAccountId,
    network,
  };
}

export async function handleIsConnected(ctx: ExternalHandlerContext): Promise<IsConnectedResult> {
  const { origin, params } = ctx;
  const { network, smartAccountId } = resolveWalletContext(params);
  const connected = await isAllowed(network, smartAccountId, origin);

  return { connected };
}

/**
 * getSmartAccount handler
 * Requires allowlist; resolves contract id from vault/storage and probes
 * Soroban RPC to determine real deployment status.
 */
export async function handleGetSmartAccount(
  ctx: ExternalHandlerContext
): Promise<GetSmartAccountResult> {
  const { origin, params } = ctx;
  const typedParams = params as { network?: string; smartAccountId?: string };

  const network = typedParams.network || getSettingsState().network || 'testnet';

  // Resolve contract id: prefer params > chrome.storage > fallback
  let smartAccountId = typedParams.smartAccountId;
  if (!smartAccountId) {
    smartAccountId = await readFromChromeLocal(CONTRACT_ADDRESS_KEY);
  }

  if (!smartAccountId) {
    throw new Error('Wallet not set up. Complete onboarding first.');
  }

  // Check allowlist
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  // Probe on-chain contract existence via Soroban RPC
  const deploymentStatus = await probeContractDeployment(smartAccountId, network);

  return {
    contractId: smartAccountId,
    deploymentStatus,
    network,
  };
}

/**
 * Wait for the approval popup/side-panel to resolve or reject a request.
 * The popup calls resolveRequest / rejectRequest from response-queue, which
 * in turn trigger the promise registered here.
 *
 * A 5-minute timeout guards against orphaned requests (e.g. popup closed
 * without responding).
 */
function waitForApproval(requestId: string, timeoutMs = 5 * 60 * 1000): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Clean up in-memory queue so the approval UI no longer shows a stale entry
      removeApproval(requestId);
      // Persist the timed-out status so the content script / popup can detect
      // expiry without a long-lived port — the session entry is read by the
      // approval UI to display a "Request expired" message.
      writeSessionEntry({ requestId, status: 'timed-out' });
      reject(
        new Error(
          'Approval request expired after 5 minutes. Please reconnect to the dApp and try again.'
        )
      );
    }, timeoutMs);

    registerResponseCallbacks(
      requestId,
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * signTransaction handler
 * Enqueues an approval request, opens the approval UI, and awaits the user's
 * decision. On approval the popup resolves with { signedXdr }; on rejection it
 * throws so the dApp receives a proper error.
 */
export async function handleSignTransaction(
  ctx: ExternalHandlerContext
): Promise<SignTransactionResult> {
  const { origin, params, requestId } = ctx;
  const parsed = signTransactionSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(
      `Invalid signTransaction params: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    );
  }
  const typedParams = parsed.data as { xdr: string; network?: string; smartAccountId?: string };

  const network = typedParams.network || 'testnet';
  const smartAccountId =
    typedParams.smartAccountId || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Check allowlist
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  // Enqueue and open the approval UI, then await the user's decision.
  enqueueApproval(requestId, origin, MethodName.SIGN_TRANSACTION, params);
  await openApprovalWindow(requestId);

  const result = await waitForApproval(requestId);
  return result as SignTransactionResult;
}

/**
 * signAuthEntry handler
 * Validates the auth entry XDR before enqueuing approval. Enqueues an approval
 * request, opens the approval UI, and awaits the user's decision. On approval
 * the popup resolves with { signedAuthEntry }; on rejection it throws so the
 * dApp receives a proper error.
 */
export async function handleSignAuthEntry(
  ctx: ExternalHandlerContext
): Promise<{ signedAuthEntry: string }> {
  const { origin, params, requestId } = ctx;
  const parsed = signAuthEntrySchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(
      `Invalid signAuthEntry params: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    );
  }
  const typedParams = parsed.data as {
    authEntry: string;
    network?: string;
    smartAccountId?: string;
  };

  // Validate the auth entry XDR before opening any UI.
  // Invalid XDR → error returned without opening the popup (AC).
  if (
    !typedParams.authEntry ||
    typeof typedParams.authEntry !== 'string' ||
    typedParams.authEntry.trim().length === 0
  ) {
    throw new Error('Invalid auth entry XDR');
  }

  // Quick base64 decode check — reject obviously invalid payloads early.
  try {
    const decoded = Buffer.from(typedParams.authEntry.trim(), 'base64');
    if (decoded.length === 0) {
      throw new Error('Invalid auth entry XDR');
    }
  } catch {
    throw new Error('Invalid auth entry XDR');
  }

  const network = typedParams.network || 'testnet';
  const smartAccountId =
    typedParams.smartAccountId || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Check allowlist
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  // Enqueue and open the approval UI, then await the user's decision.
  enqueueApproval(requestId, origin, MethodName.SIGN_AUTH_ENTRY, params);
  await openApprovalWindow(requestId, 'sign-auth-entry');

  const result = await waitForApproval(requestId);
  return result as { signedAuthEntry: string };
}

/**
 * signMessage handler
 * Enqueues an approval request, opens the approval UI, and awaits the user's
 * decision. On approval the popup resolves with { signature }; on rejection it
 * throws so the dApp receives a proper error.
 */
export async function handleSignMessage(
  ctx: ExternalHandlerContext
): Promise<{ signature: string }> {
  const { origin, params, requestId } = ctx;
  const parsed = signMessageSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(
      `Invalid signMessage params: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    );
  }
  const typedParams = parsed.data as { message: string; network?: string; smartAccountId?: string };

  const network = typedParams.network || 'testnet';
  const smartAccountId =
    typedParams.smartAccountId || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Check allowlist
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  // Enqueue and open the approval UI, then await the user's decision.
  enqueueApproval(requestId, origin, MethodName.SIGN_MESSAGE, params);
  await openApprovalWindow(requestId, 'sign-transaction');

  const result = await waitForApproval(requestId);
  return result as { signature: string };
}

/**
 * signRelayPayload handler (issue #1213)
 * Enqueues an approval request, opens the approval UI, and awaits the user's
 * decision. On approval the popup resolves with { sessionKey, signature } —
 * the wallet's real relay-envelope signature — on rejection it throws so the
 * dApp receives a proper error.
 */
export async function handleSignRelayPayload(
  ctx: ExternalHandlerContext
): Promise<{ sessionKey: string; signature: string }> {
  const { origin, params, requestId } = ctx;
  const typedParams = params as { operation?: string; network?: string; smartAccountId?: string };

  const network = typedParams.network || 'testnet';
  const smartAccountId =
    typedParams.smartAccountId || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Check allowlist
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  // Enqueue and open the approval UI, then await the user's decision.
  enqueueApproval(requestId, origin, MethodName.SIGN_RELAY_PAYLOAD, params);
  await openApprovalWindow(requestId, 'sign-transaction');

  const result = await waitForApproval(requestId);
  return result as { sessionKey: string; signature: string };
}

function generateSessionKeyPair(): { publicKey: string; secretKey: string } {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let publicKey = 'G';
  const bytes = new Uint8Array(55);
  crypto.getRandomValues(bytes);
  for (const b of bytes) publicKey += alphabet[b % alphabet.length];

  let secretKey = 'S';
  const secretBytes = new Uint8Array(55);
  crypto.getRandomValues(secretBytes);
  for (const b of secretBytes) secretKey += alphabet[b % alphabet.length];

  return { publicKey, secretKey };
}

/**
 * requestSessionKey handler (#873)
 * Enqueues approval for dApp session key policy; returns key material on approval (MVP mock on-chain).
 */
export async function handleRequestSessionKey(
  ctx: ExternalHandlerContext
): Promise<RequestSessionKeyResult> {
  const { origin, params, requestId } = ctx;
  const parsed = requestSessionKeySchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(
      `Invalid session key params: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    );
  }
  const policy = parsed.data as SessionKeyPolicy;
  if (policy.expiresAt <= Date.now()) {
    throw new Error('Session key policy must include a future expiresAt timestamp.');
  }

  const { network, smartAccountId } = resolveWalletContext(params);

  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  enqueueApproval(requestId, origin, MethodName.REQUEST_SESSION_KEY, params);
  void openApprovalWindow(requestId, 'request-session-key');

  const { publicKey } = generateSessionKeyPair();

  return {
    publicKey,
    expiresAt: policy.expiresAt,
  };
}

/**
 * getPublicKey handler (#809)
 * Reads the deployed smart-account C-address from chrome.storage.local and
 * returns it as the wallet's public key. Requires prior requestAccess approval.
 */
export async function handleGetPublicKey(ctx: ExternalHandlerContext): Promise<GetPublicKeyResult> {
  const { origin } = ctx;

  const publicKey = await readFromChromeLocal(CONTRACT_ADDRESS_KEY);
  if (!publicKey) {
    throw new Error('Wallet not set up. Complete onboarding first.');
  }

  const { network } = getSettingsState();
  const allowed = await isAllowed(network, publicKey, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  return { publicKey };
}

/**
 * getNetwork handler (#809)
 * Returns the active Stellar network and its passphrase.
 * Requires prior requestAccess approval.
 */
export async function handleGetNetwork(ctx: ExternalHandlerContext): Promise<GetNetworkResult> {
  const { origin } = ctx;

  const publicKey = await readFromChromeLocal(CONTRACT_ADDRESS_KEY);
  const { network } = getSettingsState();

  const smartAccountId = publicKey ?? 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  const networkPassphrase = NETWORK_PASSPHRASES[network] ?? NETWORK_PASSPHRASES['testnet'];
  return { network, networkPassphrase };
}
