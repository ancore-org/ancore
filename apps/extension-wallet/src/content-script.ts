/**
 * Content Script
 *
 * Forwards external API requests from dApps to the background service worker.
 * Listens for window.postMessage events from dApps and forwards them as
 * chrome.runtime.sendMessage with type EXTERNAL_API_REQUEST.
 */

import type { ExternalApiRequest, ExternalApiResponse, ExternalApiMethodName } from '@ancore/types';

const ANCORE_WALLET_REQUEST = 'ANCORE_WALLET_REQUEST';

/**
 * Check if a message is from a valid Ancore wallet request.
 */
function isValidWalletRequest(data: unknown): data is { method: string; params: unknown } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'method' in data &&
    typeof data.method === 'string' &&
    'params' in data
  );
}

/**
 * Forward a request to the background service worker.
 */
async function forwardToBackground(
  method: ExternalApiMethodName,
  params: unknown,
  origin: string
): Promise<ExternalApiResponse> {
  const requestId = crypto.randomUUID();

  const request: ExternalApiRequest = {
    type: 'EXTERNAL_API_REQUEST',
    method,
    requestId,
    params,
    origin,
  };

  return new Promise((resolve, reject) => {
    const chromeRef = (globalThis as { chrome?: any }).chrome;
    if (!chromeRef?.runtime?.sendMessage) {
      reject(new Error('Chrome runtime not available'));
      return;
    }

    chromeRef.runtime.sendMessage(request, (response: ExternalApiResponse) => {
      if (chromeRef.runtime.lastError) {
        reject(new Error(chromeRef.runtime.lastError.message));
        return;
      }

      if (response.ok) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Listen for window.postMessage events from dApps.
 */
window.addEventListener('message', (event) => {
  // Only accept messages from same-origin or trusted sources
  if (event.source !== window) {
    return;
  }

  const { data } = event;

  // Check if this is an Ancore wallet request
  if (data?.type !== ANCORE_WALLET_REQUEST) {
    return;
  }

  if (!isValidWalletRequest(data)) {
    console.error('[Ancore Content Script] Invalid wallet request format', data);
    return;
  }

  const { method, params } = data;

  // Validate method name
  const validMethods: ExternalApiMethodName[] = [
    'requestAccess',
    'getAddress',
    'getSmartAccount',
    'signTransaction',
    'signAuthEntry',
    'signMessage',
  ];

  if (!validMethods.includes(method as ExternalApiMethodName)) {
    console.error('[Ancore Content Script] Unknown method:', method);
    return;
  }

  // Get origin from the page
  const origin = window.location.origin;

  // Forward to background
  forwardToBackground(method as ExternalApiMethodName, params, origin)
    .then((response) => {
      // Send response back to dApp
      window.postMessage(
        {
          type: ANCORE_WALLET_REQUEST,
          method,
          requestId: response.requestId,
          ok: response.ok,
          result: response.result,
          error: response.error,
        },
        origin
      );
    })
    .catch((error) => {
      // Send error response back to dApp
      window.postMessage(
        {
          type: ANCORE_WALLET_REQUEST,
          method,
          ok: false,
          error: error.message,
        },
        origin
      );
    });
});

console.info('[Ancore Content Script] Loaded');
