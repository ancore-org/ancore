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
  SignTransactionResult,
} from '@ancore/types';
import { ExternalApiMethodName as MethodName } from '@ancore/types';
import { isAllowed, addToAllowlist } from './allowlist';
import { enqueueApproval } from './response-queue';
import { openApprovalWindow } from '../../approval-window';

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
