/**
 * dApp ↔ extension postMessage protocol.
 *
 * Modeled on Freighter's content-script bridge:
 * https://github.com/stellar/freighter/tree/master/extension/src/contentScript
 *
 * Page posts ANCORE_WALLET_REQUEST; content script validates and forwards to background.
 */

/** Identifies messages from @ancore/wallet-api (dApp page). */
export const ANCORE_WALLET_REQUEST = 'ANCORE_WALLET_REQUEST' as const;

/** Identifies responses from the content script back to the dApp page. */
export const ANCORE_WALLET_RESPONSE = 'ANCORE_WALLET_RESPONSE' as const;

/** Source tag on messages emitted by the content script. */
export const CONTENT_SCRIPT_SOURCE = 'ancore-content-script@1' as const;

/** Source tag on messages emitted by the dApp page via wallet-api. */
export const WALLET_API_SOURCE = 'ancore-wallet-api@1' as const;

/**
 * External API methods exposed to dApps.
 * Freighter equivalent: requestAccess, getAddress, signTransaction, signAuthEntry, …
 * Ancore adds smart-account fields where AA differs from classic G-address wallets.
 */
export const ExternalApiMethod = {
  REQUEST_ACCESS: 'requestAccess',
  GET_ADDRESS: 'getAddress',
  GET_SMART_ACCOUNT: 'getSmartAccount',
  SIGN_TRANSACTION: 'signTransaction',
  SIGN_AUTH_ENTRY: 'signAuthEntry',
  SIGN_MESSAGE: 'signMessage',
} as const;

export type ExternalApiMethodName = (typeof ExternalApiMethod)[keyof typeof ExternalApiMethod];

/** Request envelope from dApp page → content script. */
export interface ExternalRequestEnvelope {
  type: typeof ANCORE_WALLET_REQUEST;
  source: typeof WALLET_API_SOURCE;
  /** UUID for correlating async responses (Freighter response queue pattern). */
  requestId: string;
  method: ExternalApiMethodName;
  params?: Record<string, unknown>;
}

/** Response envelope from content script → dApp page. */
export interface ExternalResponseEnvelope {
  type: typeof ANCORE_WALLET_RESPONSE;
  source: typeof CONTENT_SCRIPT_SOURCE;
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function isExternalRequest(data: unknown): data is ExternalRequestEnvelope {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Partial<ExternalRequestEnvelope>;
  return (
    msg.type === ANCORE_WALLET_REQUEST &&
    msg.source === WALLET_API_SOURCE &&
    typeof msg.requestId === 'string' &&
    typeof msg.method === 'string'
  );
}

export function isExternalResponse(data: unknown): data is ExternalResponseEnvelope {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Partial<ExternalResponseEnvelope>;
  return (
    msg.type === ANCORE_WALLET_RESPONSE &&
    msg.source === CONTENT_SCRIPT_SOURCE &&
    typeof msg.requestId === 'string' &&
    typeof msg.ok === 'boolean'
  );
}
