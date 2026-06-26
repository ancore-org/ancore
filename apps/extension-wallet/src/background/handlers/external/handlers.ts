/**
 * External API Handlers
 *
 * Implementation of individual external API method handlers.
 */

import type {
  ExternalHandlerContext,
  RequestAccessResult,
  GetAddressResult,
  GetSmartAccountResult,
  GetPublicKeyResult,
  GetNetworkResult,
  SignTransactionResult,
} from '@ancore/types';
import { ExternalApiMethodName as MethodName } from '@ancore/types';
import { isAllowed, addToAllowlist } from './allowlist';
import { enqueueApproval } from './response-queue';
import { openApprovalWindow } from '../../approval-window';
import { getSettingsState } from '@/stores/settings';

/** chrome.storage.local key for the deployed smart-account C-address. */
const CONTRACT_ADDRESS_KEY = 'ancore_contract_address';

/** Stellar network passphrases keyed by NetworkMode. */
const NETWORK_PASSPHRASES: Record<string, string> = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
};

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

/**
 * requestAccess handler
 * Checks allowlist; prompts approval if new origin; returns { smartAccountId, network }
 */
export async function handleRequestAccess(
  ctx: ExternalHandlerContext
): Promise<RequestAccessResult> {
  const { origin, params } = ctx;
  const typedParams = params as { network?: string; smartAccountId?: string };

  // For MVP, we'll use a default network and mock smart account ID
  // In production, these would come from the wallet state
  const network = typedParams.network || 'testnet';
  const smartAccountId =
    typedParams.smartAccountId || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Check if already allowed
  const allowed = await isAllowed(network, smartAccountId, origin);
  if (allowed) {
    return { smartAccountId, network };
  }

  // Enqueue for approval (in production, this would open a popup)
  enqueueApproval(ctx.requestId, origin, MethodName.REQUEST_ACCESS, params);

  // For MVP, auto-approve (in production, wait for user approval)
  await addToAllowlist(network, smartAccountId, origin);

  return { smartAccountId, network };
}

/**
 * getAddress handler
 * Requires allowlist; returns contract id + deployment status
 */
export async function handleGetAddress(ctx: ExternalHandlerContext): Promise<GetAddressResult> {
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

  // Return smart account address (C-address)
  return {
    address: smartAccountId,
    network,
  };
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
 * signTransaction handler
 * Enqueues in approval queue; opens /sign-transaction?requestId=; calls sendMessage('SIGN_TRANSACTION')
 * Mocked until #763 ships
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

  // Enqueue for approval
  enqueueApproval(requestId, origin, MethodName.SIGN_TRANSACTION, params);

  // Open approval window (side panel on Chrome 116+, popup fallback)
  void openApprovalWindow(requestId);

  // For MVP, return a mock signed XDR
  return {
    signedXdr: typedParams.xdr || 'AAAAAgAAAAA=',
  };
}

/**
 * signAuthEntry handler
 * Enqueues for approval; implements after signTransaction
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

  // Enqueue for approval
  enqueueApproval(requestId, origin, MethodName.SIGN_AUTH_ENTRY, params);

  // For MVP, return a mock signed auth entry
  return {
    signedAuthEntry: typedParams.authEntry || 'AAAAAgAAAAA=',
  };
}

/**
 * signMessage handler
 * Enqueues for approval; implements after signTransaction
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

  // Enqueue for approval
  enqueueApproval(requestId, origin, MethodName.SIGN_MESSAGE, params);

  // For MVP, return a mock signature
  return {
    signature: 'mock_signature_' + Date.now(),
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
