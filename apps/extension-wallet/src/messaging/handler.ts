/**
 * Message Handler Registry
 *
 * Used in the background service worker to register typed handlers for
 * messages sent from the popup (or other extension contexts).
 *
 * Call `installMessageDispatcher()` once when the service worker boots.
 *
 * @example
 * ```ts
 * import { registerHandler, installMessageDispatcher } from '@/messaging';
 *
 * registerHandler('GET_BALANCE', async ({ publicKey }) => {
 *   const balance = await getBalance(publicKey);
 *   return { balance };
 * });
 *
 * installMessageDispatcher();
 * ```
 */

import type { MessageType, MessageHandler, MessageEnvelope, ResponseEnvelope } from './types';

// ---------------------------------------------------------------------------
// Chrome API surface needed by this module
// ---------------------------------------------------------------------------

type ChromeRuntimeListener = {
  runtime: {
    onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: object,
          sendResponse: (response: ResponseEnvelope) => void
        ) => boolean | void
      ): void;
    };
  };
};

declare const chrome: ChromeRuntimeListener;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const logPrefix = '[ancore/messaging]';

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

// Stored as a plain Map with loose types so we avoid unsound indexed-access
// issues on the mapped type. Type-safety is enforced at registration time
// via the generic overload of registerHandler.
const registry = new Map<string, (request: unknown) => Promise<unknown>>();

// Guard against calling installMessageDispatcher more than once.
let dispatcherInstalled = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a handler for `type`.
 * Replaces any previously registered handler for the same type.
 *
 * @param type    - Message type key from the Messages registry
 * @param handler - Async function that receives the request and returns the response
 */
export function registerHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
  registry.set(type, handler as (request: unknown) => Promise<unknown>);

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} registered handler for '${type}'`);
  }
}

/**
 * Remove the handler registered for `type`.
 * Silently does nothing if no handler is registered for that type.
 */
export function unregisterHandler(type: MessageType): void {
  registry.delete(type);
}

/**
 * Install the message dispatcher on `chrome.runtime.onMessage`.
 *
 * Must be called once in the background service worker after all handlers
 * have been registered (or at least before any messages are expected).
 * Calling this more than once is a no-op.
 */
export function installMessageDispatcher(): void {
  if (dispatcherInstalled) {
    return;
  }
  dispatcherInstalled = true;

  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: object,
      sendResponse: (response: ResponseEnvelope) => void
    ): boolean | void => {
      const envelope = message as Partial<MessageEnvelope>;

      // Ignore messages that aren't part of our protocol.
      if (!envelope || typeof envelope.type !== 'string' || typeof envelope.id !== 'string') {
        return;
      }

      const handler = registry.get(envelope.type);

      if (!handler) {
        if (import.meta.env.DEV) {
          console.debug(`${logPrefix} no handler for '${envelope.type}' — ignoring`);
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.debug(`${logPrefix} ← ${envelope.type}`, {
          id: envelope.id,
          payload: envelope.payload,
        });
      }

      handler(envelope.payload)
        .then((result) => {
          const response: ResponseEnvelope = {
            id: envelope.id!,
            ok: true,
            payload: result,
          };

          if (import.meta.env.DEV) {
            console.debug(`${logPrefix} → ${envelope.type}`, {
              id: envelope.id,
              payload: result,
            });
          }

          sendResponse(response);
        })
        .catch((error: unknown) => {
          const errMsg = error instanceof Error ? error.message : String(error);

          console.error(`${logPrefix} handler error for '${envelope.type}'`, errMsg);

          sendResponse({
            id: envelope.id!,
            ok: false,
            error: errMsg,
          });
        });

      // Return true to keep the message channel open for the async response.
      return true;
    }
  );
}

/**
 * Remove all registered handlers and reset the dispatcher install guard.
 *
 * @internal Intended for use in tests only.
 */
export function _resetHandlers(): void {
  registry.clear();
  dispatcherInstalled = false;
}
