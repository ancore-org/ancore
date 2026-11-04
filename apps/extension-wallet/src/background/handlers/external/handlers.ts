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
  SessionKey,
  SessionPermission,
} from '@ancore/types';
import { ExternalApiMethodName as MethodName } from '@ancore/types';
import { importFromRawEd25519Seed } from '@ancore/crypto';
import { AccountTransactionBuilder } from '@ancore/core-sdk';
import { NETWORK_PASSPHRASES } from '@ancore/wallet-shared';
import { z } from 'zod';
import {
  AccountContract,
  bitmaskToContractVec,
  bitmaskToPermissions,
  contractVecToPermissions,
  getSessionKey,
  validateSessionKeyPolicy,
  type PolicyAmount,
  type SessionKeyPolicyErrorCode,
  type SessionKeyPolicyValidationError,
} from '@ancore/account-abstraction';
import { Account, rpc as StellarRpc, StrKey } from '@stellar/stellar-sdk';
import { isAllowed, addToAllowlist } from './allowlist';
import {
  enqueueApproval,
  registerResponseCallbacks,
  removeApproval,
  writeSessionEntry,
} from './response-queue';
import { openApprovalWindow } from '../../approval-window';
import { getSigningKeypair } from '../../signing-key';
import { getSharedStorageManager } from '@/security/storage-manager';
import { getSettingsState } from '@/stores/settings';
import { useSessionKeyStore } from '@/stores/sessionKeys';
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

const VALID_PERMISSION_BITMASK = 0b111;
const PLACEHOLDER_SIMULATION_OWNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const MAX_TX_CONFIRMATION_POLLS = 10;

export class SessionKeyPolicyError extends Error {
  readonly code: SessionKeyPolicyErrorCode;
  readonly field: string;
  readonly errors: SessionKeyPolicyValidationError[];

  constructor(errors: SessionKeyPolicyValidationError[]) {
    const primary = errors[0] ?? {
      code: 'INVALID_EXPIRES_AT' as const,
      field: 'expiresAt' as const,
      message: 'Invalid session key policy',
    };
    super(`[${primary.code}] Invalid session key policy (${primary.field}): ${primary.message}`);
    this.name = 'SessionKeyPolicyError';
    this.code = primary.code;
    this.field = primary.field;
    this.errors = errors;
  }
}

interface NormalizedSessionKeyPolicy {
  expiresAtMs: number;
  expiresAtSec: number;
  contractPermissions: number[];
  uiPermissions: SessionPermission[];
  allowedContracts?: string[];
  maxAmountPerCall?: PolicyAmount;
  cumulativeLimit?: PolicyAmount;
  spendWindowSeconds: number;
  network?: string;
  smartAccountId?: string;
}

function normalizeSessionKeyPolicy(params: unknown): NormalizedSessionKeyPolicy {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new SessionKeyPolicyError([
      {
        code: 'INVALID_EXPIRES_AT',
        field: 'expiresAt',
        message: 'Policy must be a valid object',
      },
    ]);
  }

  const raw = params as Record<string, unknown>;
  const errors: SessionKeyPolicyValidationError[] = [];

  if (typeof raw.expiresAt !== 'number' || !Number.isInteger(raw.expiresAt) || raw.expiresAt <= 0) {
    errors.push({
      code: 'INVALID_EXPIRES_AT',
      field: 'expiresAt',
      message: 'expiresAt must be a positive integer Unix timestamp',
    });
  }

  let contractPermissions: number[] = [];
  let uiPermissions: SessionPermission[] = [];
  let permissionsForValidator: number | number[] = -1;

  if (Array.isArray(raw.permissions)) {
    if (raw.permissions.length === 0) {
      errors.push({
        code: 'INVALID_PERMISSION',
        field: 'permissions',
        message: 'permissions must include at least one permission',
      });
    } else if (!raw.permissions.every((p) => typeof p === 'number' && Number.isInteger(p))) {
      errors.push({
        code: 'INVALID_PERMISSION',
        field: 'permissions',
        message: 'permissions array must contain integer permission indices',
      });
    } else {
      permissionsForValidator = raw.permissions as number[];
      contractPermissions = [...new Set(permissionsForValidator)].sort((a, b) => a - b);
      uiPermissions = contractVecToPermissions(contractPermissions);
    }
  } else if (
    typeof raw.permissions === 'number' &&
    Number.isInteger(raw.permissions) &&
    raw.permissions > 0 &&
    (raw.permissions & ~VALID_PERMISSION_BITMASK) === 0
  ) {
    contractPermissions = bitmaskToContractVec(raw.permissions);
    uiPermissions = bitmaskToPermissions(raw.permissions);
    permissionsForValidator = contractPermissions;
  } else {
    errors.push({
      code: 'INVALID_PERMISSION',
      field: 'permissions',
      message: 'permissions must be a non-zero permission bitmask within supported bounds',
    });
  }

  if (errors.length > 0) {
    throw new SessionKeyPolicyError(errors);
  }

  const expiresAtInput = raw.expiresAt as number;
  const validation = validateSessionKeyPolicy({
    expiresAt: expiresAtInput,
    permissions: permissionsForValidator,
    allowedContracts: raw.allowedContracts as string[] | undefined,
    maxAmountPerCall: raw.maxAmountPerCall as PolicyAmount | null | undefined,
    cumulativeLimit: raw.cumulativeLimit as PolicyAmount | null | undefined,
    spendWindowSeconds: raw.spendWindowSeconds as number | undefined,
  });

  if (!validation.valid) {
    throw new SessionKeyPolicyError(validation.errors);
  }

  let allowedContracts: string[] | undefined;
  if (raw.allowedContracts !== undefined) {
    const list = raw.allowedContracts as string[];
    for (const contractId of list) {
      if (!StrKey.isValidContract(contractId)) {
        throw new SessionKeyPolicyError([
          {
            code: 'INVALID_ALLOWED_CONTRACTS',
            field: 'allowedContracts',
            message: `Invalid contract address in allowlist: ${contractId}`,
          },
        ]);
      }
    }
    allowedContracts = [...list];
  }

  const isMs = expiresAtInput > 1e11;
  const expiresAtSec = isMs ? Math.floor(expiresAtInput / 1000) : expiresAtInput;
  const expiresAtMs = isMs ? expiresAtInput : expiresAtInput * 1000;

  return {
    expiresAtMs,
    expiresAtSec,
    contractPermissions,
    uiPermissions,
    allowedContracts,
    maxAmountPerCall:
      raw.maxAmountPerCall !== undefined && raw.maxAmountPerCall !== null
        ? (raw.maxAmountPerCall as PolicyAmount)
        : undefined,
    cumulativeLimit:
      raw.cumulativeLimit !== undefined && raw.cumulativeLimit !== null
        ? (raw.cumulativeLimit as PolicyAmount)
        : undefined,
    spendWindowSeconds: typeof raw.spendWindowSeconds === 'number' ? raw.spendWindowSeconds : 0,
    network: typeof raw.network === 'string' ? raw.network : undefined,
    smartAccountId: typeof raw.smartAccountId === 'string' ? raw.smartAccountId : undefined,
  };
}

async function confirmSubmittedTransaction(
  rpcServer: StellarRpc.Server,
  sendResponse: StellarRpc.Api.SendTransactionResponse
): Promise<void> {
  if (sendResponse.status === 'ERROR' || sendResponse.status === 'TRY_AGAIN_LATER') {
    throw new Error(`Failed to submit add_session_key transaction (${sendResponse.status}).`);
  }

  if (
    sendResponse.status === 'PENDING' &&
    typeof (rpcServer as Partial<StellarRpc.Server>).getTransaction === 'function'
  ) {
    for (let attempt = 0; attempt < MAX_TX_CONFIRMATION_POLLS; attempt += 1) {
      const txStatus = await rpcServer.getTransaction(sendResponse.hash);
      if (txStatus.status === 'SUCCESS') {
        return;
      }
      if (txStatus.status === 'FAILED') {
        throw new Error(`On-chain add_session_key transaction failed (${sendResponse.hash}).`);
      }
    }
    throw new Error(`Timed out waiting for add_session_key confirmation (${sendResponse.hash}).`);
  }
}

/**
 * Query a registered session key directly from the smart-account contract via Soroban RPC.
 */
export async function queryRegisteredSessionKey(
  publicKey: string,
  options: { network?: string; smartAccountId?: string } = {}
): Promise<SessionKey | null> {
  const network = options.network || getSettingsState().network || 'testnet';
  const rpcUrl = SOROBAN_RPC_URLS[network];
  if (!rpcUrl) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const smartAccountId =
    options.smartAccountId || (await readFromChromeLocal(CONTRACT_ADDRESS_KEY));
  if (!smartAccountId) {
    throw new Error('Wallet not set up. Complete onboarding first.');
  }

  const networkPassphrase = NETWORK_PASSPHRASES[network] ?? NETWORK_PASSPHRASES['testnet'];
  const rpcServer = new StellarRpc.Server(rpcUrl, { allowHttp: network === 'local' });

  return getSessionKey(smartAccountId, publicKey, {
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
    sourceAccount: PLACEHOLDER_SIMULATION_OWNER,
    networkPassphrase,
  });
}

/**
 * requestSessionKey handler (#958)
 * Validates policy upfront, awaits explicit user approval, generates a real Ed25519
 * session keypair via @ancore/crypto, registers it on-chain via add_session_key,
 * and persists encrypted secret material plus public store metadata.
 */
export async function handleRequestSessionKey(
  ctx: ExternalHandlerContext
): Promise<RequestSessionKeyResult> {
  const { origin, params, requestId } = ctx;
  const normalized = normalizeSessionKeyPolicy(params);

  const network = normalized.network || getSettingsState().network || 'testnet';
  const rpcUrl = SOROBAN_RPC_URLS[network];
  if (!rpcUrl) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const smartAccountId =
    normalized.smartAccountId || (await readFromChromeLocal(CONTRACT_ADDRESS_KEY));
  if (!smartAccountId) {
    throw new Error('Wallet not set up. Complete onboarding first.');
  }
  if (!StrKey.isValidContract(smartAccountId)) {
    throw new Error('Invalid smart account contract ID.');
  }

  const allowed = await isAllowed(network, smartAccountId, origin);
  if (!allowed) {
    throw new Error('Origin not allowed. Call requestAccess first.');
  }

  enqueueApproval(requestId, origin, MethodName.REQUEST_SESSION_KEY, params);
  await openApprovalWindow(requestId, 'request-session-key');

  const approval = await waitForApproval(requestId);
  if (approval === undefined) {
    throw new Error('Session key request was not approved.');
  }

  const ownerKeypair = await getSigningKeypair();
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);

  let publicKey: string;
  let secretKey: string;
  try {
    const sessionKeypair = importFromRawEd25519Seed(seed);
    publicKey = sessionKeypair.publicKey();
    secretKey = sessionKeypair.secret();
  } finally {
    seed.fill(0);
  }

  const networkPassphrase = NETWORK_PASSPHRASES[network] ?? NETWORK_PASSPHRASES['testnet'];
  const rpcServer = new StellarRpc.Server(rpcUrl, { allowHttp: network === 'local' });
  const accountResponse = await rpcServer.getAccount(ownerKeypair.publicKey());
  const sourceAccount = new Account(accountResponse.accountId(), accountResponse.sequenceNumber());

  const txBuilder = new AccountTransactionBuilder(sourceAccount, {
    server: rpcServer,
    accountContractId: smartAccountId,
    networkPassphrase,
  });

  txBuilder.addSessionKey(
    publicKey,
    normalized.expiresAtSec,
    normalized.contractPermissions,
    normalized.allowedContracts,
    normalized.maxAmountPerCall,
    normalized.cumulativeLimit,
    normalized.spendWindowSeconds
  );

  const preparedTx = await txBuilder.build();
  preparedTx.sign(ownerKeypair);

  const sendResponse = await rpcServer.sendTransaction(preparedTx);
  await confirmSubmittedTransaction(rpcServer, sendResponse);

  const storageManager = getSharedStorageManager();
  if (
    storageManager.isUnlocked &&
    typeof storageManager.getSessionKeys === 'function' &&
    typeof storageManager.saveSessionKeys === 'function'
  ) {
    const existing = (await storageManager.getSessionKeys()) ?? { keys: {} };
    await storageManager.saveSessionKeys({
      ...existing,
      keys: {
        ...existing.keys,
        [publicKey]: secretKey,
      },
    });
  }

  useSessionKeyStore.getState().addKey({
    publicKey,
    permissions: normalized.uiPermissions,
    expiresAt: normalized.expiresAtMs,
    label: origin,
  });

  return {
    publicKey,
    expiresAt: normalized.expiresAtMs,
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
