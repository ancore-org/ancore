/**
 * External Handler Index
 *
 * Exports and registers all external API handlers.
 */

import { registerExternalHandler } from './registry';
import {
  handleRequestAccess,
  handleGetAddress,
  handleGetSmartAccount,
  handleSignTransaction,
  handleSignAuthEntry,
  handleSignMessage,
} from './handlers';
import { ExternalApiMethodName } from '@ancore/types';

/**
 * Register all external API handlers.
 */
export function registerAllExternalHandlers(): void {
  registerExternalHandler(ExternalApiMethodName.REQUEST_ACCESS, handleRequestAccess);
  registerExternalHandler(ExternalApiMethodName.GET_ADDRESS, handleGetAddress);
  registerExternalHandler(ExternalApiMethodName.GET_SMART_ACCOUNT, handleGetSmartAccount);
  registerExternalHandler(ExternalApiMethodName.SIGN_TRANSACTION, handleSignTransaction);
  registerExternalHandler(ExternalApiMethodName.SIGN_AUTH_ENTRY, handleSignAuthEntry);
  registerExternalHandler(ExternalApiMethodName.SIGN_MESSAGE, handleSignMessage);
}

export * from './registry';
export * from './allowlist';
export * from './response-queue';
export * from './handlers';
