/**
 * dApp ↔ content script bridge.
 *
 * Freighter reference: @stellar/freighter-api/src/sendMessageToContentScript
 * https://github.com/stellar/freighter/tree/master/@stellar/freighter-api
 */

import {
  ANCORE_WALLET_REQUEST,
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
  WALLET_API_SOURCE,
  type ExternalApiMethodName,
  type ExternalResponseEnvelope,
  isExternalResponse,
} from '@ancore/wallet-shared';

const DEFAULT_TIMEOUT_MS = 30_000;

function randomRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export class WalletApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletApiError';
  }
}

export class WalletNotInstalledError extends WalletApiError {
  constructor() {
    super(
      'Ancore extension not detected. Install the Ancore Wallet extension or wait for content script support.'
    );
    this.name = 'WalletNotInstalledError';
  }
}

/**
 * Send a typed request to the extension via postMessage.
 * Resolves when the content script returns ANCORE_WALLET_RESPONSE.
 */
export function sendExternalRequest<T = unknown>(
  method: ExternalApiMethodName,
  params: Record<string, unknown> = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  if (typeof window === 'undefined') {
    return Promise.reject(new WalletApiError('wallet-api requires a browser window'));
  }

  const requestId = randomRequestId();

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new WalletApiError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (!isExternalResponse(event.data)) return;
      if (event.data.requestId !== requestId) return;

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);

      const response = event.data as ExternalResponseEnvelope;
      if (!response.ok) {
        reject(new WalletApiError(response.error ?? 'Unknown wallet error'));
        return;
      }
      resolve(response.result as T);
    }

    window.addEventListener('message', onMessage);

    window.postMessage(
      {
        type: ANCORE_WALLET_REQUEST,
        source: WALLET_API_SOURCE,
        requestId,
        method,
        params,
      },
      window.location.origin
    );
  });
}

/** @internal Test helper */
export function __parseResponse(data: unknown): ExternalResponseEnvelope | null {
  return isExternalResponse(data) ? data : null;
}

export { ANCORE_WALLET_RESPONSE, CONTENT_SCRIPT_SOURCE };
