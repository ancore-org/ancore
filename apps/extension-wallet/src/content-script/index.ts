/**
 * Content script — dApp ↔ extension bridge.
 *
 * Validates postMessage requests from the dApp page, filters by origin,
 * routes typed methods to the background service worker, and forwards
 * responses back to the page using the page's own requestId.
 *
 * Freighter reference:
 *   extension/src/contentScript/redirectMessagesToBackground.ts
 */

import {
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
  ExternalApiMethod,
  isExternalRequest,
  type ExternalApiMethodName,
} from '@ancore/wallet-shared';
import type { MessageType } from '@/messaging/types';

const logPrefix = '[ancore/content-script]';

type ChromeRuntime = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>;
  };
};

declare const chrome: ChromeRuntime;

// ── Origin filter ─────────────────────────────────────────────────────────────

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function isOriginPermitted(origin: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(origin).protocol);
  } catch {
    return false;
  }
}

// ── Method → typed message-type mapping ───────────────────────────────────────

const METHOD_TO_MESSAGE_TYPE: Partial<Record<ExternalApiMethodName, MessageType>> = {
  [ExternalApiMethod.REQUEST_ACCESS]: 'EXTERNAL_REQUEST_ACCESS',
  [ExternalApiMethod.CONNECT]: 'EXTERNAL_REQUEST_ACCESS',
  [ExternalApiMethod.GET_ADDRESS]: 'EXTERNAL_GET_PUBLIC_KEY',
  [ExternalApiMethod.GET_NETWORK]: 'EXTERNAL_GET_NETWORK',
  [ExternalApiMethod.IS_CONNECTED]: 'EXTERNAL_IS_CONNECTED',
  [ExternalApiMethod.GET_SMART_ACCOUNT]: 'EXTERNAL_GET_PUBLIC_KEY',
  [ExternalApiMethod.SIGN_TRANSACTION]: 'EXTERNAL_SIGN_TRANSACTION',
};

// ── Response helpers ──────────────────────────────────────────────────────────

function respond(requestId: string, ok: boolean, result?: unknown, error?: string): void {
  window.postMessage(
    {
      type: ANCORE_WALLET_RESPONSE,
      source: CONTENT_SCRIPT_SOURCE,
      requestId,
      ok,
      result,
      error,
    },
    window.location.origin
  );
}

// ── Message listener ──────────────────────────────────────────────────────────

window.addEventListener('message', (event) => {
  // Only accept messages from the same window (not iframes or other origins).
  if (event.source !== window) return;
  if (!isExternalRequest(event.data)) return;

  const { requestId, method, params } = event.data;
  const origin = window.location.origin;

  // Block requests from non-http(s) origins (file://, extensions, etc.).
  if (!isOriginPermitted(origin)) {
    respond(requestId, false, undefined, `Origin not permitted: ${origin}`);
    return;
  }

  // Map the method to a typed background message type; reject unknown methods.
  const messageType = METHOD_TO_MESSAGE_TYPE[method];
  if (!messageType) {
    respond(requestId, false, undefined, `Unknown method: ${method}`);
    return;
  }

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} ← ${method} (${messageType})`, { requestId, params });
  }

  // Generate an internal correlation ID so the background response can be
  // matched back to this page request even if multiple requests are in flight.
  const correlationId = crypto.randomUUID();

  chrome.runtime
    .sendMessage({
      type: 'EXTERNAL_API_REQUEST',
      requestId: correlationId,
      method,
      params: params ?? {},
      origin,
    })
    .then((backgroundResult: unknown) => {
      const payload = backgroundResult as { ok?: boolean; result?: unknown; error?: string };
      if (payload && typeof payload.ok === 'boolean') {
        respond(requestId, payload.ok, payload.result, payload.error);
        return;
      }
      respond(requestId, false, undefined, 'Unexpected response from background');
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      respond(requestId, false, undefined, message);
    });
});

if (import.meta.env.DEV) {
  console.info(`${logPrefix} loaded on`, window.location.origin);
}
