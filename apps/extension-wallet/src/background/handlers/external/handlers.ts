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
import { isAllowed, addToAllowlist } from './allowlist';
import { enqueueApproval, registerResponseCallbacks } from './response-queue';
import { openApprovalWindow } from '../../approval-window';
import { getSettingsState } from '@/stores/settings';

/** chrome.storage.local key for the deployed smart-account C-address. */
const CONTRACT_ADDRESS_KEY = 'ancore_contract_address';

async function readFromChromeLocal(key: string): Promise<string | null> {
  const chromeRef = (globalThis as { chrome?: any }).chrome;
  if (chromeRef?.storage?.local) {
    return new Promise((resolve) => {
      chromeRef.storage.local.get(key, (result: Record<string, unknown>) => {
        const value = result[key];
        resolve(typeof value === 'string' ? value : null);
      });
    });
  }
  return localStorage.getItem(key);
}

const DEFAULT_MOCK_SMART_ACCOUNT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

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

  // Open approval UX before the MVP auto-approval path.
  void openApprovalWindow(ctx.requestId, 'grant-access');

  // For MVP, auto-approve (in production, wait for user approval)

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
 * Requires allowlist; returns contract id + deployment status
 */
export async function handleGetSmartAccount(
  ctx: ExternalHandlerContext
): Promise<GetSmartAccountResult> {
  const { origin, params } = ctx;
  const typedParams = params as { network?: string; smartAccountId?: string };

  const network = typedParams.network || 'testnet';
  const smartAccountId =
    typedParams.smartAccountId || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Check allowlist
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  // For MVP, return a mock deployment status
  // In production, this would check the actual contract deployment status
  return {
    contractId: smartAccountId,
    deploymentStatus: 'deployed',
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
      reject(new Error('Approval request timed out.'));
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
  const typedParams = params as { xdr?: string; network?: string; smartAccountId?: string };

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
 * Enqueues an approval request, opens the approval UI, and awaits the user's
 * decision. On approval the popup resolves with { signedAuthEntry }; on
 * rejection it throws so the dApp receives a proper error.
 */
export async function handleSignAuthEntry(
  ctx: ExternalHandlerContext
): Promise<{ signedAuthEntry: string }> {
  const { origin, params, requestId } = ctx;
  const typedParams = params as { authEntry?: string; network?: string; smartAccountId?: string };

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
  const typedParams = params as { message?: string; network?: string; smartAccountId?: string };

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
  const policy = params as SessionKeyPolicy;

  if (!policy?.expiresAt || policy.expiresAt <= Date.now()) {
    throw new Error('Session key policy must include a future expiresAt timestamp.');
  }

  if (typeof policy.permissions !== 'number') {
    throw new Error('Session key policy must include permissions.');
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
