/**
 * External API Types for dApp Integration
 *
 * Defines the message types and data structures for communication
 * between dApps and the Ancore wallet extension via content scripts.
 */

/**
 * External API method names that dApps can call.
 * These correspond to the methods in @ancore/wallet-api SDK.
 */
export enum ExternalApiMethodName {
  REQUEST_ACCESS = 'requestAccess',
  GET_ADDRESS = 'getAddress',
  GET_SMART_ACCOUNT = 'getSmartAccount',
  SIGN_TRANSACTION = 'signTransaction',
  SIGN_AUTH_ENTRY = 'signAuthEntry',
  SIGN_MESSAGE = 'signMessage',
}

/**
 * Request message sent from dApp → content script → background.
 */
export interface ExternalApiRequest {
  readonly type: 'EXTERNAL_API_REQUEST';
  readonly method: ExternalApiMethodName;
  readonly requestId: string;
  readonly params: unknown;
  readonly origin: string;
}

/**
 * Response message sent from background → content script → dApp.
 */
export interface ExternalApiResponse {
  readonly type: 'EXTERNAL_API_RESPONSE';
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * Context provided to external handlers.
 */
export interface ExternalHandlerContext {
  readonly origin: string;
  readonly params: unknown;
  readonly requestId: string;
  readonly sender: {
    readonly origin?: string;
    readonly tab?: { id?: number };
    readonly id?: string;
  };
}

/**
 * Handler function for external API methods.
 */
export type ExternalHandler = (ctx: ExternalHandlerContext) => Promise<unknown>;

/**
 * Allowlist entry keyed by (network, smartAccountId, origin).
 */
export interface AllowlistEntry {
  readonly network: string;
  readonly smartAccountId: string;
  readonly origin: string;
  readonly approvedAt: number; // Unix timestamp
}

/**
 * Storage key for the allowlist.
 */
export const ALLOWLIST_STORAGE_KEY = 'ancore_allowlist';

/**
 * Approval queue entry for pending user approvals.
 */
export interface ApprovalQueueEntry {
  readonly requestId: string;
  readonly origin: string;
  readonly method: ExternalApiMethodName;
  readonly params: unknown;
  readonly timestamp: number;
}

/**
 * Result from requestAccess handler.
 */
export interface RequestAccessResult {
  readonly smartAccountId: string;
  readonly network: string;
}

/**
 * Result from getAddress handler.
 */
export interface GetAddressResult {
  readonly address: string; // Smart account C-address
  readonly network: string;
}

/**
 * Result from getSmartAccount handler.
 */
export interface GetSmartAccountResult {
  readonly contractId: string;
  readonly deploymentStatus: 'deployed' | 'pending' | 'not_deployed';
  readonly network: string;
}

/**
 * Result from signTransaction handler.
 */
export interface SignTransactionResult {
  readonly signedXdr: string;
}

/**
 * Result from signAuthEntry handler.
 */
export interface SignAuthEntryResult {
  readonly signedAuthEntry: string;
}

/**
 * Result from signMessage handler.
 */
export interface SignMessageResult {
  readonly signature: string;
}
