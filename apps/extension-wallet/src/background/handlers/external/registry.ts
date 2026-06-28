/**
 * External Handler Registry
 *
 * Typed registry of external API method handlers.
 * Maps ExternalApiMethodName to handler functions.
 */

import type { ExternalApiMethodName, ExternalHandler, ExternalHandlerContext } from '@ancore/types';

const handlers = new Map<ExternalApiMethodName, ExternalHandler>();

/**
 * Register a handler for an external API method.
 */
export function registerExternalHandler(
  method: ExternalApiMethodName,
  handler: ExternalHandler
): void {
  handlers.set(method, handler);
}

/**
 * Unregister a handler for an external API method.
 */
export function unregisterExternalHandler(method: ExternalApiMethodName): void {
  handlers.delete(method);
}

/**
 * Get a handler for an external API method.
 */
export function getExternalHandler(method: ExternalApiMethodName): ExternalHandler | undefined {
  return handlers.get(method);
}

/**
 * Check if a handler is registered for a method.
 */
export function hasExternalHandler(method: ExternalApiMethodName): boolean {
  return handlers.has(method);
}

/**
 * Get all registered method names.
 */
export function getRegisteredMethods(): ExternalApiMethodName[] {
  return Array.from(handlers.keys());
}

/**
 * Dispatch a request to the appropriate handler.
 */
export async function dispatchExternalRequest(
  method: ExternalApiMethodName,
  ctx: ExternalHandlerContext
): Promise<unknown> {
  const handler = handlers.get(method);
  if (!handler) {
    throw new Error(`Unknown external API method: ${method}`);
  }
  return handler(ctx);
}

/**
 * Clear all handlers (for testing).
 */
export function clearExternalHandlers(): void {
  handlers.clear();
}
