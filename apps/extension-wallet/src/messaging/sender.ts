/**
 * Message Sender
 *
 * Used in the popup context to send typed messages to the background
 * service worker and await their typed responses.
 *
 * @example
 * ```ts
 * import { sendMessage } from '@/messaging';
 *
 * const { balance } = await sendMessage('GET_BALANCE', { publicKey: 'GABC...' });
 * ```
 */

import type {
  MessageType,
  MessageRequest,
  MessageResponse,
  MessageEnvelope,
  ResponseEnvelope,
  SendOptions,
} from './types';

// ---------------------------------------------------------------------------
// Chrome API surface needed by this module
// ---------------------------------------------------------------------------

type ChromeRuntimeSender = {
  runtime: {
    sendMessage(message: MessageEnvelope, callback: (response: ResponseEnvelope) => void): void;
    lastError?: { message?: string } | null;
  };
};

declare const chrome: ChromeRuntimeSender;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const logPrefix = '[ancore/messaging]';
const DEFAULT_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function generateId(): string {
  _idCounter = (_idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${_idCounter}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a typed message to the background service worker and return its response.
 *
 * Rejects with an Error if:
 * - The background does not respond within `timeoutMs` (default 5 s)
 * - `chrome.runtime.lastError` is set (e.g. extension context invalidated)
 * - The handler explicitly rejected / threw
 * - No listener handled the message
 *
 * @param type    - Message type key from the Messages registry
 * @param payload - Request payload matching Messages[type]['request']
 * @param options - Optional timeout override
 */
export function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageRequest<T>,
  options: SendOptions = {}
): Promise<MessageResponse<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const id = generateId();
  const envelope: MessageEnvelope = { type, id, payload };

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} → ${type}`, { id, payload });
  }

  return new Promise<MessageResponse<T>>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${logPrefix} Timeout: no response for '${type}' after ${timeoutMs} ms (id=${id})`
        )
      );
    }, timeoutMs);

    chrome.runtime.sendMessage(envelope, (response: ResponseEnvelope) => {
      clearTimeout(timer);

      // chrome.runtime.lastError must always be accessed in the callback to
      // avoid "Unchecked runtime.lastError" warnings in the console.
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? `${logPrefix} Unknown runtime error`));
        return;
      }

      if (!response) {
        reject(new Error(`${logPrefix} No response received for '${type}' (id=${id})`));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error ?? `${logPrefix} Handler rejected '${type}' (id=${id})`));
        return;
      }

      if (import.meta.env.DEV) {
        console.debug(`${logPrefix} ← ${type}`, { id, payload: response.payload });
      }

      resolve(response.payload as MessageResponse<T>);
    });
  });
}
